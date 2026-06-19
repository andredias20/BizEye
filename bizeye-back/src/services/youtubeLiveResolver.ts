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
const OFFLINE_CACHE_TTL_MS = 60 * 1000;
const ERROR_BACKOFF_MS = 5 * 60 * 1000;
const YOUTUBE_WEB_BASE_URL = 'https://www.youtube.com';

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
      channelId?: string;
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

const isRecent = (checkedAt: string | null, ttlMs: number) => {
  return Boolean(checkedAt && Date.parse(checkedAt) + ttlMs > Date.now());
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
    video?.snippet?.channelId === channelId &&
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

const extractLivePageVideoId = (html: string) => {
  const canonicalVideoId = html.match(
    /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/,
  )?.[1];

  if (canonicalVideoId && html.includes('"isLiveContent":true')) {
    return canonicalVideoId;
  }

  const videoDetailsMatch = html.match(
    /"videoDetails":\{.*?"videoId":"([a-zA-Z0-9_-]{11})".*?"isLiveContent":true/s,
  );

  return videoDetailsMatch?.[1] ?? null;
};

const discoverLiveVideoFromLivePage = async (channelId: string) => {
  const response = await fetch(`${YOUTUBE_WEB_BASE_URL}/channel/${channelId}/live`, {
    headers: {
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  });

  if (!response.ok) return null;

  return extractLivePageVideoId(await response.text());
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
    const livePageVideoId = await discoverLiveVideoFromLivePage(channelId).catch(() => null);
    if (livePageVideoId) {
      return validateCachedVideo(store, channelId, livePageVideoId);
    }

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

  if (cached?.status === 'offline' && isFresh(cached.expires_at) && isRecent(cached.checked_at, OFFLINE_CACHE_TTL_MS)) {
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

  const validated = await validateCachedVideo(store, channelId, videoId);
  if (validated.status !== 'live') {
    throw new Error('Observed video is not an active live for this channel.');
  }

  return validated;
};
