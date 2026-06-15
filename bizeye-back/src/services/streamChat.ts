import { randomUUID } from 'node:crypto';
import {
  fetchYouTubeLiveChatForSource,
  isYouTubeVideoId,
  type YouTubeChatSourceInput,
} from './youtubeLiveChat.js';
import { fetchKickChatSnapshot, runKickChat } from './kickChat.js';
import { fetchTwitchChatSnapshot, runTwitchChat } from './twitchChat.js';

const DEFAULT_MAX_RESULTS_PER_SOURCE = 200;
const DEFAULT_POLL_MS = 5_000;
const MAX_QUEUE_MESSAGES = 500;

export type StreamChatPlatform = 'kick' | 'twitch' | 'youtube';

export type StreamChatSourceInput = {
  chatIdentifier?: string;
  identifier: string;
  platform: StreamChatPlatform;
  title?: string;
};

export type StreamChatSourceStatus =
  | 'chat_unavailable'
  | 'error'
  | 'live'
  | 'not_found'
  | 'offline'
  | 'unsupported';

export type StreamChatSourceState = {
  error?: string;
  identifier: string;
  platform: StreamChatPlatform;
  pollingIntervalMillis: number;
  status: StreamChatSourceStatus;
  title?: string;
};

export type StreamChatMessage = {
  authorChannelId?: string;
  authorName: string;
  authorProfileImageUrl?: string;
  id: string;
  identifier: string;
  isModerator?: boolean;
  isOwner?: boolean;
  isSponsor?: boolean;
  message: string;
  platform: StreamChatPlatform;
  publishedAt: string;
  receivedAt: string;
  sequence: number;
  sourceTitle?: string;
  type?: string;
};

export type StreamChatSnapshot = {
  createdAt: string;
  messages: StreamChatMessage[];
  snapshotId: string;
  sources: StreamChatSourceState[];
};

export type StreamChatClientPayload = {
  maxResults?: number;
  sources: StreamChatSourceInput[];
};

export type StreamChatServerEvent =
  | {
      sessionId: string;
      type: 'connected';
    }
  | {
      message: StreamChatMessage;
      sessionId: string;
      type: 'chat-message';
    }
  | {
      sessionId: string;
      sources: StreamChatSourceState[];
      type: 'source-state';
    }
  | {
      message: string;
      sessionId: string;
      type: 'error';
    };

type Publisher = (event: StreamChatServerEvent) => void;

type AdapterContext = {
  maxResults: number;
  publish: (message: StreamChatMessageDraft) => void;
  signal: AbortSignal;
  source: StreamChatSourceInput;
  updateSource: (state: StreamChatSourceState) => void;
};

export type StreamChatMessageDraft = Omit<StreamChatMessage, 'publishedAt' | 'receivedAt' | 'sequence'> & {
  publishedAt?: string;
};

const waitFor = async (milliseconds: number, signal: AbortSignal) => {
  if (signal.aborted) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
};

const nowIso = () => new Date().toISOString();

const sanitizeError = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected stream chat error';
};

const normalizeIdentifier = (value: string) => value.trim();

const uniqueSources = (sources: StreamChatSourceInput[]) => {
  const byKey = new Map<string, StreamChatSourceInput>();

  for (const source of sources) {
    const identifier = normalizeIdentifier(source.identifier);
    if (!identifier) continue;

    const chatIdentifier = source.chatIdentifier?.trim() || undefined;
    const platform = source.platform;
    const keyIdentifier = platform === 'kick' || platform === 'twitch' ? chatIdentifier || identifier : identifier;
    const key = `${platform}:${keyIdentifier}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      chatIdentifier,
      identifier,
      platform,
      title: source.title?.trim() || undefined,
    });
  }

  return [...byKey.values()];
};

const normalizeMaxResults = (maxResults?: number) => {
  if (!Number.isFinite(maxResults)) return DEFAULT_MAX_RESULTS_PER_SOURCE;

  return Math.min(Math.max(Math.trunc(Number(maxResults)), 1), 2000);
};

const injectMachineMilliseconds = (value: string | undefined, receivedAt: Date) => {
  if (!value) return receivedAt.toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return receivedAt.toISOString();

  if (/\.\d{1,3}(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    return parsed.toISOString();
  }

  parsed.setUTCMilliseconds(receivedAt.getUTCMilliseconds());
  return parsed.toISOString();
};

const unsupportedSourceState = (source: StreamChatSourceInput): StreamChatSourceState => ({
  identifier: source.identifier,
  platform: source.platform,
  pollingIntervalMillis: DEFAULT_POLL_MS,
  status: 'unsupported',
  title: source.title,
});

export class StreamChatQueue {
  private lastReceivedAt = 0;
  private messages: StreamChatMessage[] = [];
  private seen = new Set<string>();
  private sequence = 0;

  enqueue(draft: StreamChatMessageDraft) {
    const key = `${draft.platform}:${draft.identifier}:${draft.id}`;
    if (this.seen.has(key)) return null;

    const timestamp = Math.max(Date.now(), this.lastReceivedAt + 1);
    this.lastReceivedAt = timestamp;

    const receivedAt = new Date(timestamp);
    const message: StreamChatMessage = {
      ...draft,
      publishedAt: injectMachineMilliseconds(draft.publishedAt, receivedAt),
      receivedAt: receivedAt.toISOString(),
      sequence: ++this.sequence,
    };

    this.seen.add(key);
    this.messages.push(message);
    this.messages = this.messages.slice(-MAX_QUEUE_MESSAGES);

    return message;
  }

  snapshot() {
    return [...this.messages];
  }
}

const pollYouTubeChat = async ({ maxResults, publish, signal, source, updateSource }: AdapterContext) => {
  if (!isYouTubeVideoId(source.identifier)) {
    updateSource({
      error: 'youtube_identifier_must_be_video_id',
      identifier: source.identifier,
      platform: 'youtube',
      pollingIntervalMillis: DEFAULT_POLL_MS,
      status: 'error',
      title: source.title,
    });
    return;
  }

  let nextSource: YouTubeChatSourceInput = {
    title: source.title,
    videoId: source.identifier,
  };

  while (!signal.aborted) {
    try {
      const result = await fetchYouTubeLiveChatForSource(nextSource, maxResults);

      updateSource({
        error: result.source.error,
        identifier: source.identifier,
        platform: 'youtube',
        pollingIntervalMillis: result.source.pollingIntervalMillis,
        status: result.source.status,
        title: result.source.title || source.title,
      });

      for (const message of result.messages) {
        publish({
          authorChannelId: message.authorChannelId,
          authorName: message.authorName,
          authorProfileImageUrl: message.authorProfileImageUrl,
          id: message.id,
          identifier: source.identifier,
          isModerator: message.isModerator,
          isOwner: message.isOwner,
          isSponsor: message.isSponsor,
          message: message.message,
          platform: 'youtube',
          publishedAt: message.publishedAt,
          sourceTitle: message.sourceTitle || source.title,
          type: message.type,
        });
      }

      nextSource = {
        liveChatId: result.source.liveChatId,
        pageToken: result.source.nextPageToken,
        title: result.source.title || source.title,
        videoId: source.identifier,
      };

      await waitFor(result.source.pollingIntervalMillis || DEFAULT_POLL_MS, signal);
    } catch (error) {
      updateSource({
        error: sanitizeError(error),
        identifier: source.identifier,
        platform: 'youtube',
        pollingIntervalMillis: DEFAULT_POLL_MS,
        status: 'error',
        title: source.title,
      });
      await waitFor(DEFAULT_POLL_MS, signal);
    }
  }
};

const runUnsupportedChat = ({ source, updateSource }: AdapterContext) => {
  updateSource(unsupportedSourceState(source));
};

const runSource = (context: AdapterContext) => {
  if (context.source.platform === 'youtube') {
    void pollYouTubeChat(context);
    return;
  }

  if (context.source.platform === 'kick') {
    void runKickChat(context);
    return;
  }

  if (context.source.platform === 'twitch') {
    void runTwitchChat(context);
    return;
  }

  runUnsupportedChat(context);
};

export const fetchStreamChatSnapshot = async ({
  maxResults,
  sources,
}: StreamChatClientPayload): Promise<StreamChatSnapshot> => {
  const queue = new StreamChatQueue();
  const safeSources = uniqueSources(sources);
  const sourceStates: StreamChatSourceState[] = [];
  const maxResultsPerSource = normalizeMaxResults(maxResults);

  for (const source of safeSources) {
    if (source.platform === 'kick') {
      const result = await fetchKickChatSnapshot(source, maxResultsPerSource);
      sourceStates.push(result.source);

      for (const message of result.messages) {
        queue.enqueue(message);
      }

      continue;
    }

    if (source.platform === 'twitch') {
      const result = await fetchTwitchChatSnapshot(source, maxResultsPerSource);
      sourceStates.push(result.source);

      for (const message of result.messages) {
        queue.enqueue(message);
      }

      continue;
    }

    if (source.platform !== 'youtube') {
      sourceStates.push(unsupportedSourceState(source));
      continue;
    }

    if (!isYouTubeVideoId(source.identifier)) {
      sourceStates.push({
        error: 'youtube_identifier_must_be_video_id',
        identifier: source.identifier,
        platform: 'youtube',
        pollingIntervalMillis: DEFAULT_POLL_MS,
        status: 'error',
        title: source.title,
      });
      continue;
    }

    const result = await fetchYouTubeLiveChatForSource(
      {
        title: source.title,
        videoId: source.identifier,
      },
      maxResultsPerSource,
    );

    sourceStates.push({
      error: result.source.error,
      identifier: source.identifier,
      platform: 'youtube',
      pollingIntervalMillis: result.source.pollingIntervalMillis,
      status: result.source.status,
      title: result.source.title || source.title,
    });

    for (const message of result.messages) {
      queue.enqueue({
        authorChannelId: message.authorChannelId,
        authorName: message.authorName,
        authorProfileImageUrl: message.authorProfileImageUrl,
        id: message.id,
        identifier: source.identifier,
        isModerator: message.isModerator,
        isOwner: message.isOwner,
        isSponsor: message.isSponsor,
        message: message.message,
        platform: 'youtube',
        publishedAt: message.publishedAt,
        sourceTitle: message.sourceTitle || source.title,
        type: message.type,
      });
    }
  }

  return {
    createdAt: nowIso(),
    messages: queue.snapshot(),
    snapshotId: randomUUID(),
    sources: sourceStates,
  };
};

export const createStreamChatSession = (payload: StreamChatClientPayload, publish: Publisher) => {
  const abortController = new AbortController();
  const queue = new StreamChatQueue();
  const safeSources = uniqueSources(payload.sources);
  const sourceStates = new Map<string, StreamChatSourceState>();
  const sessionId = randomUUID();
  const maxResults = normalizeMaxResults(payload.maxResults);

  const publishSourceState = () => {
    publish({
      sessionId,
      sources: [...sourceStates.values()],
      type: 'source-state',
    });
  };

  const updateSource = (state: StreamChatSourceState) => {
    sourceStates.set(`${state.platform}:${state.identifier}`, state);
    publishSourceState();
  };

  const publishMessage = (draft: StreamChatMessageDraft) => {
    const message = queue.enqueue(draft);
    if (!message) return;

    publish({
      message,
      sessionId,
      type: 'chat-message',
    });
  };

  return {
    sessionId,
    start() {
      publish({ sessionId, type: 'connected' });

      for (const source of safeSources) {
        runSource({
          maxResults,
          publish: publishMessage,
          signal: abortController.signal,
          source,
          updateSource,
        });
      }
    },
    stop() {
      abortController.abort();
    },
  };
};
