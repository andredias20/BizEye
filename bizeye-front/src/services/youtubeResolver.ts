import { BIZEYE_RESOLVE_FLAG_KEY, getBizeyeResolveFlagValue } from '../flags';

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

const warnBackendUnavailable = (operation: string, error: unknown) => {
  console.warn(`${BIZEYE_RESOLVE_FLAG_KEY}: backend ${operation} failed.`, error);
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
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

const searchChannelsWithBackend = async (query: string, maxResults: number) => {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: query,
  });
  const data = await fetchJson<BackendSearchResponse>(`${RESOLVER_BASE_URL}/youtube/channels/search?${params}`);

  return data.items || [];
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

export const searchYoutubeChannels = async (query: string, maxResults = 6) => {
  if (await shouldUseBackendResolver()) {
    try {
      return await searchChannelsWithBackend(query, maxResults);
    } catch (error) {
      warnBackendUnavailable('channel search', error);
    }
  }

  throw new Error('Backend resolver unavailable.');
};

export const resolveYoutubeInput = async (input: string) => {
  const cleanInput = input.trim();
  const direct = extractDirectYoutubeId(cleanInput);
  if (direct) return direct;

  if (await shouldUseBackendResolver()) {
    try {
      return await resolveInputWithBackend(cleanInput);
    } catch (error) {
      warnBackendUnavailable('channel resolve', error);
    }
  }

  throw new Error('Backend resolver unavailable.');
};

export const fetchYoutubeLiveVideoId = async (channelId: string) => {
  if (await shouldUseBackendResolver()) {
    try {
      return await fetchLiveVideoIdWithBackend(channelId);
    } catch (error) {
      warnBackendUnavailable('live lookup', error);
    }
  }

  return null;
};

export const fetchYoutubeLiveStatuses = async (channelIds: string[]) => {
  const uniqueChannelIds = [...new Set(channelIds.filter(Boolean))];
  if (uniqueChannelIds.length === 0) return [];

  if (await shouldUseBackendResolver()) {
    try {
      return await fetchLiveStatusesWithBackend(uniqueChannelIds);
    } catch (error) {
      warnBackendUnavailable('live status batch', error);
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
