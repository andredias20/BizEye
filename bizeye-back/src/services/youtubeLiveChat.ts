import { randomUUID } from 'node:crypto';
import { getYouTubeApiMode } from '../config/env.js';
import { fetchYouTubeJson } from './youtube.js';

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const DEFAULT_CHAT_MAX_RESULTS = 200;
const MAX_CHAT_MAX_RESULTS = 2000;
const DEFAULT_STREAM_POLL_MS = 5_000;

type YouTubeVideosChatResponse = {
  items?: Array<{
    id?: string;
    liveStreamingDetails?: {
      activeLiveChatId?: string;
      actualEndTime?: string;
      actualStartTime?: string;
    };
    snippet?: {
      liveBroadcastContent?: 'live' | 'none' | 'upcoming';
      title?: string;
    };
  }>;
};

type YouTubeLiveChatMessagesResponse = {
  items?: Array<{
    authorDetails?: {
      channelId?: string;
      displayName?: string;
      isChatModerator?: boolean;
      isChatOwner?: boolean;
      isChatSponsor?: boolean;
      profileImageUrl?: string;
    };
    id?: string;
    snippet?: {
      displayMessage?: string;
      publishedAt?: string;
      textMessageDetails?: {
        messageText?: string;
      };
      type?: string;
    };
  }>;
  nextPageToken?: string;
  offlineAt?: string;
  pollingIntervalMillis?: number;
};

export type YouTubeChatSourceInput = {
  liveChatId?: string;
  pageToken?: string;
  title?: string;
  videoId: string;
};

export type YouTubeChatSourceStatus = 'live' | 'offline' | 'not_found' | 'chat_unavailable' | 'error';

export type YouTubeChatSourceState = {
  error?: string;
  liveChatId?: string;
  nextPageToken?: string;
  pollingIntervalMillis: number;
  status: YouTubeChatSourceStatus;
  title?: string;
  videoId: string;
};

export type YouTubeMergedChatMessage = {
  authorChannelId?: string;
  authorName: string;
  authorProfileImageUrl?: string;
  id: string;
  isModerator?: boolean;
  isOwner?: boolean;
  isSponsor?: boolean;
  liveChatId: string;
  message: string;
  publishedAt: string;
  sourceTitle?: string;
  type?: string;
  videoId: string;
};

export type YouTubeMergedChatBatch = {
  batchId: string;
  createdAt: string;
  messages: YouTubeMergedChatMessage[];
  sources: YouTubeChatSourceState[];
};

export type FetchMergedChatOptions = {
  maxResults?: number;
  sources: YouTubeChatSourceInput[];
};

export const isYouTubeVideoId = (value: string) => YOUTUBE_VIDEO_ID_PATTERN.test(value);

const nowIso = () => new Date().toISOString();

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeMaxResults = (maxResults?: number) => {
  const value = Number.isFinite(maxResults) ? Number(maxResults) : DEFAULT_CHAT_MAX_RESULTS;
  const min = getYouTubeApiMode() === 'mock' ? 1 : DEFAULT_CHAT_MAX_RESULTS;

  return clamp(Math.trunc(value), min, MAX_CHAT_MAX_RESULTS);
};

const sanitizeError = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected YouTube chat error';
};

const compareMessages = (a: YouTubeMergedChatMessage, b: YouTubeMergedChatMessage) => {
  const aTime = Date.parse(a.publishedAt);
  const bTime = Date.parse(b.publishedAt);

  if (aTime !== bTime) return aTime - bTime;
  return `${a.videoId}:${a.id}`.localeCompare(`${b.videoId}:${b.id}`);
};

export const resolveActiveLiveChat = async (videoId: string): Promise<YouTubeChatSourceState> => {
  if (!isYouTubeVideoId(videoId)) {
    return {
      error: 'invalid_video_id',
      pollingIntervalMillis: DEFAULT_STREAM_POLL_MS,
      status: 'error',
      videoId,
    };
  }

  const data = await fetchYouTubeJson<YouTubeVideosChatResponse>({
    path: '/videos',
    params: {
      id: videoId,
      part: 'snippet,liveStreamingDetails',
    },
  });

  const video = data.items?.[0];
  if (!video) {
    return {
      pollingIntervalMillis: DEFAULT_STREAM_POLL_MS,
      status: 'not_found',
      videoId,
    };
  }

  const isLive =
    video.snippet?.liveBroadcastContent === 'live' &&
    Boolean(video.liveStreamingDetails?.actualStartTime) &&
    !video.liveStreamingDetails?.actualEndTime;

  if (!isLive) {
    return {
      pollingIntervalMillis: DEFAULT_STREAM_POLL_MS,
      status: 'offline',
      title: video.snippet?.title,
      videoId,
    };
  }

  const liveChatId = video.liveStreamingDetails?.activeLiveChatId;
  if (!liveChatId) {
    return {
      pollingIntervalMillis: DEFAULT_STREAM_POLL_MS,
      status: 'chat_unavailable',
      title: video.snippet?.title,
      videoId,
    };
  }

  return {
    liveChatId,
    pollingIntervalMillis: DEFAULT_STREAM_POLL_MS,
    status: 'live',
    title: video.snippet?.title,
    videoId,
  };
};

const toChatMessage = (
  item: NonNullable<YouTubeLiveChatMessagesResponse['items']>[number],
  source: YouTubeChatSourceState,
): YouTubeMergedChatMessage | null => {
  const id = item.id;
  const publishedAt = item.snippet?.publishedAt;
  const message = item.snippet?.displayMessage || item.snippet?.textMessageDetails?.messageText;
  const liveChatId = source.liveChatId;

  if (!id || !publishedAt || !message || !liveChatId) return null;

  return {
    authorChannelId: item.authorDetails?.channelId,
    authorName: item.authorDetails?.displayName || 'YouTube',
    authorProfileImageUrl: item.authorDetails?.profileImageUrl,
    id,
    isModerator: item.authorDetails?.isChatModerator,
    isOwner: item.authorDetails?.isChatOwner,
    isSponsor: item.authorDetails?.isChatSponsor,
    liveChatId,
    message,
    publishedAt,
    sourceTitle: source.title,
    type: item.snippet?.type,
    videoId: source.videoId,
  };
};

export const fetchYouTubeLiveChatForSource = async (
  input: YouTubeChatSourceInput,
  maxResults: number,
): Promise<{ messages: YouTubeMergedChatMessage[]; source: YouTubeChatSourceState }> => {
  const source = input.liveChatId
    ? {
        liveChatId: input.liveChatId,
        pollingIntervalMillis: DEFAULT_STREAM_POLL_MS,
        status: 'live' as const,
        title: input.title,
        videoId: input.videoId,
      }
    : await resolveActiveLiveChat(input.videoId);

  if (source.status !== 'live' || !source.liveChatId) {
    return { messages: [], source };
  }

  const data = await fetchYouTubeJson<YouTubeLiveChatMessagesResponse>({
    path: '/liveChat/messages',
    params: {
      liveChatId: source.liveChatId,
      maxResults,
      pageToken: input.pageToken,
      part: 'snippet,authorDetails',
      profileImageSize: 48,
    },
  });

  const nextSource = {
    ...source,
    nextPageToken: data.nextPageToken,
    pollingIntervalMillis: data.pollingIntervalMillis ?? DEFAULT_STREAM_POLL_MS,
  };

  const messages =
    data.items
      ?.map((item) => toChatMessage(item, nextSource))
      .filter((item): item is YouTubeMergedChatMessage => Boolean(item)) ?? [];

  return {
    messages,
    source: nextSource,
  };
};

const uniqueSources = (sources: YouTubeChatSourceInput[]) => {
  const byVideoId = new Map<string, YouTubeChatSourceInput>();

  for (const source of sources) {
    const videoId = source.videoId.trim();
    if (!isYouTubeVideoId(videoId) || byVideoId.has(videoId)) continue;

    byVideoId.set(videoId, {
      liveChatId: source.liveChatId?.trim() || undefined,
      pageToken: source.pageToken?.trim() || undefined,
      title: source.title?.trim() || undefined,
      videoId,
    });
  }

  return [...byVideoId.values()];
};

export const fetchMergedYouTubeLiveChat = async ({
  maxResults,
  sources,
}: FetchMergedChatOptions): Promise<YouTubeMergedChatBatch> => {
  const perSourceMaxResults = normalizeMaxResults(maxResults);
  const safeSources = uniqueSources(sources).slice(0, 6);

  const settled = await Promise.all(
    safeSources.map((source) =>
      fetchYouTubeLiveChatForSource(source, perSourceMaxResults).catch((error): {
        messages: YouTubeMergedChatMessage[];
        source: YouTubeChatSourceState;
      } => ({
        messages: [],
        source: {
          error: sanitizeError(error),
          pollingIntervalMillis: DEFAULT_STREAM_POLL_MS,
          status: 'error',
          title: source.title,
          videoId: source.videoId,
        },
      })),
    ),
  );

  return {
    batchId: randomUUID(),
    createdAt: nowIso(),
    messages: settled.flatMap((item) => item.messages).sort(compareMessages),
    sources: settled.map((item) => item.source),
  };
};

export const getMergedChatNextPollMs = (batch: Pick<YouTubeMergedChatBatch, 'sources'>) => {
  const liveIntervals = batch.sources
    .filter((source) => source.status === 'live')
    .map((source) => source.pollingIntervalMillis)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (liveIntervals.length === 0) return DEFAULT_STREAM_POLL_MS;

  return clamp(Math.min(...liveIntervals), 500, 30_000);
};
