import {
  createLiveResolutionStore,
  type LiveResolutionRow,
  type LiveResolutionPayload,
  type LiveResolutionSource,
  type LiveResolutionStatus,
  type LiveResolutionStore,
} from './liveResolutionStore.js';
import { fetchYouTubeJson } from './youtube.js';

const LIVE_CACHE_TTL_MS = 60 * 1000;
const OFFLINE_CACHE_TTL_MS = 10 * 60 * 1000;
const ERROR_BACKOFF_MS = 5 * 60 * 1000;

type YouTubeLiveSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
    };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      liveBroadcastContent?: 'live' | 'none' | 'upcoming';
      title?: string;
    };
    liveStreamingDetails?: {
      actualEndTime?: string;
      actualStartTime?: string;
    };
    status?: {
      embeddable?: boolean;
    };
  }>;
};

export type YouTubeLiveResolution = {
  channelId: string;
  checkedAt: string | null;
  embeddable?: boolean;
  error?: string;
  expiresAt: string | null;
  source: LiveResolutionSource;
  status: LiveResolutionStatus;
  title?: string;
  videoId: string | null;
};

type ResolveOptions = {
  allowDiscovery?: boolean;
};

const isYouTubeChannelId = (value: string) => /^UC[a-zA-Z0-9_-]{22}$/.test(value);
const isYouTubeVideoId = (value: string) => /^[a-zA-Z0-9_-]{11}$/.test(value) && value !== 'live_stream';

const addMilliseconds = (milliseconds: number) => new Date(Date.now() + milliseconds).toISOString();
const nowIso = () => new Date().toISOString();

const isFresh = (expiresAt: string | null) => {
  return Boolean(expiresAt && Date.parse(expiresAt) > Date.now());
};

const toResolution = (row: LiveResolutionRow, source: LiveResolutionSource = 'cache'): YouTubeLiveResolution => ({
  channelId: row.channel_id,
  checkedAt: row.checked_at,
  expiresAt: row.expires_at,
  source,
  status: row.status,
  videoId: row.video_id,
});

const writeResolution = async (
  store: LiveResolutionStore,
  resolution: {
    channelId: string;
    error?: string | null;
    source: LiveResolutionSource;
    status: LiveResolutionStatus;
    title?: string;
    videoId: string | null;
  },
) => {
  const checkedAt = nowIso();
  const ttl = resolution.status === 'live' ? LIVE_CACHE_TTL_MS : OFFLINE_CACHE_TTL_MS;
  const expiresAt = addMilliseconds(resolution.status === 'error' ? ERROR_BACKOFF_MS : ttl);

  await store.ensureChannel(resolution.channelId, resolution.title);

  const payload: LiveResolutionPayload = {
    channel_id: resolution.channelId,
    checked_at: checkedAt,
    expires_at: expiresAt,
    last_error: resolution.error ?? null,
    next_discovery_at: expiresAt,
    source: resolution.source,
    status: resolution.status,
    video_id: resolution.videoId,
  };

  if (resolution.status === 'live') {
    payload.last_live_at = checkedAt;
    payload.failure_count = 0;
  }

  if (resolution.status === 'error') {
    payload.failure_count = 1;
  }

  await store.upsertResolution(payload);

  return {
    channelId: resolution.channelId,
    checkedAt,
    expiresAt,
    source: resolution.source,
    status: resolution.status,
    title: resolution.title,
    videoId: resolution.videoId,
  } satisfies YouTubeLiveResolution;
};

const validateCachedVideo = async (store: LiveResolutionStore, channelId: string, videoId: string) => {
  const data = await fetchYouTubeJson<YouTubeVideosResponse>({
    path: '/videos',
    params: {
      id: videoId,
      part: 'snippet,liveStreamingDetails,status',
    },
  });

  const video = data.items?.[0];
  const isLive =
    video?.snippet?.liveBroadcastContent === 'live' &&
    Boolean(video.liveStreamingDetails?.actualStartTime) &&
    !video.liveStreamingDetails?.actualEndTime;

  if (!video || !isLive) {
    return writeResolution(store, {
      channelId,
      source: 'youtube',
      status: 'offline',
      videoId: null,
    });
  }

  const resolution = await writeResolution(store, {
    channelId,
    source: 'youtube',
    status: 'live',
    title: video.snippet?.title,
    videoId,
  });

  return {
    ...resolution,
    embeddable: video.status?.embeddable,
  };
};

const discoverLiveVideo = async (store: LiveResolutionStore, channelId: string) => {
  const data = await fetchYouTubeJson<YouTubeLiveSearchResponse>({
    path: '/search',
    params: {
      channelId,
      eventType: 'live',
      maxResults: 1,
      part: 'snippet',
      type: 'video',
    },
  });

  const item = data.items?.[0];
  const videoId = item?.id?.videoId;

  if (!videoId) {
    return writeResolution(store, {
      channelId,
      source: 'youtube',
      status: 'offline',
      videoId: null,
    });
  }

  return writeResolution(store, {
    channelId,
    source: 'youtube',
    status: 'live',
    title: item.snippet?.title,
    videoId,
  });
};

export const resolveLiveForChannel = async (
  channelId: string,
  { allowDiscovery = true }: ResolveOptions = {},
): Promise<YouTubeLiveResolution> => {
  if (!isYouTubeChannelId(channelId)) {
    throw new Error(`Invalid YouTube channel ID: ${channelId}`);
  }

  const store = createLiveResolutionStore();
  await store.ensureChannel(channelId);

  const cached = await store.readCachedResolution(channelId);

  if (cached?.status === 'live' && cached.video_id && isFresh(cached.expires_at)) {
    return toResolution(cached);
  }

  if (cached?.status === 'offline' && isFresh(cached.expires_at)) {
    return toResolution(cached);
  }

  if (cached?.status === 'live' && cached.video_id) {
    const validation = await validateCachedVideo(store, channelId, cached.video_id);
    if (validation.status === 'live' || !allowDiscovery) return validation;
  }

  if (!allowDiscovery) {
    return cached
      ? toResolution(cached, 'stale_cache')
      : {
          channelId,
          checkedAt: null,
          expiresAt: null,
          source: 'unknown',
          status: 'unknown',
          videoId: null,
        };
  }

  return discoverLiveVideo(store, channelId);
};

export const resolveLiveStatuses = async (channelIds: string[]) => {
  const uniqueChannelIds = [...new Set(channelIds.filter(isYouTubeChannelId))];

  return Promise.all(
    uniqueChannelIds.map(async (channelId) =>
      resolveLiveForChannel(channelId).catch(() => ({
        channelId,
        checkedAt: null,
        error: 'live_status_unavailable',
        expiresAt: null,
        source: 'unknown',
        status: 'error',
        videoId: null,
      })),
    ),
  );
};

export const recordObservedLiveVideo = async (channelId: string, videoId: string) => {
  if (!isYouTubeChannelId(channelId)) {
    throw new Error(`Invalid YouTube channel ID: ${channelId}`);
  }

  if (!isYouTubeVideoId(videoId)) {
    throw new Error(`Invalid YouTube video ID: ${videoId}`);
  }

  const store = createLiveResolutionStore();

  return writeResolution(store, {
    channelId,
    source: 'youtube',
    status: 'live',
    videoId,
  });
};
