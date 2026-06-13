import { BIZEYE_RESOLVE_FLAG_KEY, getBizeyeResolveFlagValue } from '../flags';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';
const RESOLVER_BASE_URL = (import.meta.env.VITE_RESOLVER_BASE_URL || '').replace(/\/+$/, '');

export type YoutubeChannelResult = {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
};

export type YoutubeResolvedInput = {
  id: string;
  title: string;
};

export type YoutubeLiveStatus = 'live' | 'offline' | 'unknown' | 'quota_limited' | 'error';

export type YoutubeLiveStatusResult = {
  channelId: string;
  checkedAt?: string | null;
  embeddable?: boolean;
  expiresAt?: string | null;
  source?: 'cache' | 'youtube' | 'stale_cache' | 'unknown';
  status: YoutubeLiveStatus;
  title?: string;
  videoId?: string | null;
};

type YoutubeSearchResponse = {
  items?: Array<{
    id?: {
      channelId?: string;
    };
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: {
        medium?: {
          url?: string;
        };
      };
    };
  }>;
};

type YoutubeChannelListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
    };
  }>;
};

type YoutubeLiveSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
  }>;
};

type BackendSearchResponse = {
  items?: YoutubeChannelResult[];
};

type BackendLiveResponse = {
  status?: YoutubeLiveStatus;
  videoId?: string | null;
};

type BackendLiveStatusesResponse = {
  items?: YoutubeLiveStatusResult[];
};

const shouldUseBackendResolver = async () => {
  return Boolean(RESOLVER_BASE_URL) && (await getBizeyeResolveFlagValue());
};

const warnAndFallback = (operation: string, error: unknown) => {
  console.warn(`${BIZEYE_RESOLVE_FLAG_KEY}: backend ${operation} failed; falling back to Google APIs.`, error);
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const buildGoogleApisUrl = (path: string, params: Record<string, string | number>) => {
  const url = new URL(`${YOUTUBE_API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
};

const requireYoutubeApiKey = () => {
  if (!YOUTUBE_API_KEY) {
    throw new Error('Configure VITE_YOUTUBE_API_KEY para usar o fallback direto no Google APIs.');
  }
};

const extractDirectYoutubeId = (input: string): YoutubeResolvedInput | null => {
  if (input.includes('youtube.com/watch') || input.includes('youtu.be/')) {
    try {
      const url = new URL(input.includes('http') ? input : `https://${input}`);

      if (url.hostname.includes('youtu.be')) {
        const id = url.pathname.slice(1);
        return id ? { id, title: id } : null;
      }

      const videoId = url.searchParams.get('v');
      if (videoId) return { id: videoId, title: videoId };
    } catch {
      return null;
    }
  }

  const ucMatch = input.match(/UC[a-zA-Z0-9_-]{22}/);
  if (ucMatch) return { id: ucMatch[0], title: ucMatch[0] };

  return null;
};

const extractYoutubeHandle = (input: string) => {
  let handle = '';

  if (input.includes('youtube.com/')) {
    try {
      const url = new URL(input.includes('http') ? input : `https://${input}`);
      const pathParts = url.pathname
        .split('/')
        .filter((part) => !['c', 'user', 'channel'].includes(part) && part !== '');
      handle = pathParts[0] || '';
    } catch {
      handle = input.split('/').pop() || '';
    }
  } else {
    handle = input;
  }

  if (handle && !handle.startsWith('@') && !handle.startsWith('UC')) {
    handle = `@${handle}`;
  }

  return handle;
};

const searchChannelsWithBackend = async (query: string, maxResults: number) => {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: query,
  });
  const data = await fetchJson<BackendSearchResponse>(`${RESOLVER_BASE_URL}/youtube/channels/search?${params}`);

  return data.items || [];
};

const searchChannelsWithGoogleApis = async (query: string, maxResults: number) => {
  requireYoutubeApiKey();

  const data = await fetchJson<YoutubeSearchResponse>(
    buildGoogleApisUrl('/search', {
      key: YOUTUBE_API_KEY,
      maxResults,
      part: 'snippet',
      q: query,
      type: 'channel',
    }),
  );

  return (
    data.items
      ?.map((item): YoutubeChannelResult | null => {
        const id = item.id?.channelId;
        if (!id) return null;

        return {
          id,
          title: item.snippet?.title || id,
          description: item.snippet?.description || 'Canal do YouTube',
          thumbnail: item.snippet?.thumbnails?.medium?.url,
        };
      })
      .filter((item): item is YoutubeChannelResult => Boolean(item)) || []
  );
};

const resolveInputWithBackend = async (input: string) => {
  return fetchJson<YoutubeResolvedInput>(`${RESOLVER_BASE_URL}/youtube/channels/resolve`, {
    body: JSON.stringify({ input }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
};

const resolveInputWithGoogleApis = async (input: string): Promise<YoutubeResolvedInput> => {
  const cleanInput = input.trim();
  const direct = extractDirectYoutubeId(cleanInput);
  if (direct) return direct;

  const handle = extractYoutubeHandle(cleanInput);
  if (!handle) {
    throw new Error('Could not identify a YouTube handle or ID in the input.');
  }

  requireYoutubeApiKey();

  const handleData = await fetchJson<YoutubeChannelListResponse>(
    buildGoogleApisUrl('/channels', {
      forHandle: handle,
      key: YOUTUBE_API_KEY,
      part: 'id,snippet',
    }),
  );

  const channel = handleData.items?.[0];
  if (channel?.id) {
    return {
      id: channel.id,
      title: channel.snippet?.title || handle,
    };
  }

  const searchData = await fetchJson<YoutubeSearchResponse>(
    buildGoogleApisUrl('/search', {
      key: YOUTUBE_API_KEY,
      maxResults: 1,
      part: 'snippet',
      q: handle,
      type: 'channel',
    }),
  );

  const searchResult = searchData.items?.[0];
  const channelId = searchResult?.id?.channelId;

  if (channelId) {
    return {
      id: channelId,
      title: searchResult.snippet?.title || handle,
    };
  }

  throw new Error(`Channel not found for: ${handle}. Try using the full Channel URL.`);
};

const fetchLiveVideoIdWithBackend = async (channelId: string) => {
  const data = await fetchJson<BackendLiveResponse>(
    `${RESOLVER_BASE_URL}/youtube/channels/${encodeURIComponent(channelId)}/live`,
  );

  return data.videoId || null;
};

const fetchLiveStatusesWithBackend = async (channelIds: string[]) => {
  const data = await fetchJson<BackendLiveStatusesResponse>(`${RESOLVER_BASE_URL}/youtube/channels/live-status`, {
    body: JSON.stringify({ channelIds }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  return data.items || [];
};

const recordLiveVideoWithBackend = async (channelId: string, videoId: string) => {
  return fetchJson<YoutubeLiveStatusResult>(`${RESOLVER_BASE_URL}/youtube/channels/${encodeURIComponent(channelId)}/live`, {
    body: JSON.stringify({ videoId }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
};

const fetchLiveVideoIdWithGoogleApis = async (channelId: string) => {
  if (!YOUTUBE_API_KEY) return null;

  const data = await fetchJson<YoutubeLiveSearchResponse>(
    buildGoogleApisUrl('/search', {
      channelId,
      eventType: 'live',
      key: YOUTUBE_API_KEY,
      part: 'snippet',
      type: 'video',
    }),
  );

  return data.items?.[0]?.id?.videoId || null;
};

export const searchYoutubeChannels = async (query: string, maxResults = 6) => {
  if (await shouldUseBackendResolver()) {
    try {
      return await searchChannelsWithBackend(query, maxResults);
    } catch (error) {
      warnAndFallback('channel search', error);
    }
  }

  return searchChannelsWithGoogleApis(query, maxResults);
};

export const resolveYoutubeInput = async (input: string) => {
  const cleanInput = input.trim();
  const direct = extractDirectYoutubeId(cleanInput);
  if (direct) return direct;

  if (await shouldUseBackendResolver()) {
    try {
      return await resolveInputWithBackend(cleanInput);
    } catch (error) {
      warnAndFallback('channel resolve', error);
    }
  }

  return resolveInputWithGoogleApis(cleanInput);
};

export const fetchYoutubeLiveVideoId = async (channelId: string) => {
  if (await shouldUseBackendResolver()) {
    try {
      return await fetchLiveVideoIdWithBackend(channelId);
    } catch (error) {
      warnAndFallback('live lookup', error);
    }
  }

  try {
    return await fetchLiveVideoIdWithGoogleApis(channelId);
  } catch (error) {
    console.error('Error fetching YouTube live video ID:', error);
    return null;
  }
};

export const fetchYoutubeLiveStatuses = async (channelIds: string[]) => {
  const uniqueChannelIds = [...new Set(channelIds.filter(Boolean))];
  if (uniqueChannelIds.length === 0) return [];

  if (await shouldUseBackendResolver()) {
    try {
      return await fetchLiveStatusesWithBackend(uniqueChannelIds);
    } catch (error) {
      warnAndFallback('live status batch', error);
    }
  }

  return [];
};

export const recordYoutubeLiveVideoId = async (channelId: string, videoId: string) => {
  if (!(await shouldUseBackendResolver())) return null;

  try {
    return await recordLiveVideoWithBackend(channelId, videoId);
  } catch (error) {
    console.warn(`${BIZEYE_RESOLVE_FLAG_KEY}: failed to record live video observation.`, error);
    return null;
  }
};
