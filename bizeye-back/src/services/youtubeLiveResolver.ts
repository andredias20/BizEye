import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '../lib/supabase.js';
import { fetchYouTubeJson } from './youtube.js';

const LIVE_CACHE_TTL_MS = 60 * 1000;
const OFFLINE_CACHE_TTL_MS = 10 * 60 * 1000;
const ERROR_BACKOFF_MS = 5 * 60 * 1000;

export type LiveResolutionStatus = 'live' | 'offline' | 'unknown' | 'quota_limited' | 'error';
export type LiveResolutionSource = 'cache' | 'youtube' | 'stale_cache' | 'unknown';

type LiveResolutionRow = {
  channel_id: string;
  video_id: string | null;
  status: LiveResolutionStatus;
  source: LiveResolutionSource;
  checked_at: string | null;
  expires_at: string | null;
  next_discovery_at: string | null;
  last_error: string | null;
};

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

const ensureChannel = async (client: SupabaseClient, channelId: string, title?: string) => {
  const payload: Record<string, string> = { channel_id: channelId };
  if (title) payload.title = title;

  const { error } = await client.from('youtube_channels').upsert(payload, {
    onConflict: 'channel_id',
  });

  if (error) {
    throw new Error(`Failed to cache YouTube channel ${channelId}: ${error.message}`);
  }
};

const readCachedResolution = async (client: SupabaseClient, channelId: string) => {
  const { data, error } = await client
    .from('youtube_live_resolutions')
    .select('channel_id, video_id, status, source, checked_at, expires_at, next_discovery_at, last_error')
    .eq('channel_id', channelId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read live cache for ${channelId}: ${error.message}`);
  }

  return data as LiveResolutionRow | null;
};

const writeResolution = async (
  client: SupabaseClient,
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

  await ensureChannel(client, resolution.channelId, resolution.title);

  const payload: Record<string, unknown> = {
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

  const { error } = await client.from('youtube_live_resolutions').upsert(payload, {
    onConflict: 'channel_id',
  });

  if (error) {
    throw new Error(`Failed to cache live resolution for ${resolution.channelId}: ${error.message}`);
  }

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

const validateCachedVideo = async (client: SupabaseClient, channelId: string, videoId: string) => {
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
    return writeResolution(client, {
      channelId,
      source: 'youtube',
      status: 'offline',
      videoId: null,
    });
  }

  const resolution = await writeResolution(client, {
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

const discoverLiveVideo = async (client: SupabaseClient, channelId: string) => {
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
    return writeResolution(client, {
      channelId,
      source: 'youtube',
      status: 'offline',
      videoId: null,
    });
  }

  return writeResolution(client, {
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

  const client = createSupabaseAdminClient();
  await ensureChannel(client, channelId);

  const cached = await readCachedResolution(client, channelId);

  if (cached?.status === 'live' && cached.video_id && isFresh(cached.expires_at)) {
    return toResolution(cached);
  }

  if (cached?.status === 'offline' && isFresh(cached.expires_at)) {
    return toResolution(cached);
  }

  if (cached?.status === 'live' && cached.video_id) {
    const validation = await validateCachedVideo(client, channelId, cached.video_id);
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

  return discoverLiveVideo(client, channelId);
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

  const client = createSupabaseAdminClient();

  return writeResolution(client, {
    channelId,
    source: 'youtube',
    status: 'live',
    videoId,
  });
};
