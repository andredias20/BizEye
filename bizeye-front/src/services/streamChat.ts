const DEFAULT_DEV_RESOLVER_BASE_URL = 'http://127.0.0.1:3000';
const RESOLVER_BASE_URL = (
  import.meta.env.VITE_RESOLVER_BASE_URL ||
  (import.meta.env.DEV ? DEFAULT_DEV_RESOLVER_BASE_URL : '')
).replace(/\/+$/, '');

export type StreamChatPlatform = 'kick' | 'twitch' | 'youtube';
export type StreamChatTransport = 'sse' | 'websocket';

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
      type: 'error' | 'ready';
    };

const toWebSocketUrl = (baseUrl: string) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/stream/chat/merge/ws';
  url.search = '';
  return url.toString();
};

const getUniqueSources = (sources: StreamChatSourceInput[]) => [
  ...new Map(
    sources
      .filter((source) => source.identifier && source.platform)
      .map((source) => [
        `${source.platform}:${source.platform === 'kick' || source.platform === 'twitch' ? source.chatIdentifier || source.identifier : source.identifier}`,
        source,
      ]),
  ).values(),
];

const toSseUrl = (baseUrl: string, sources: StreamChatSourceInput[]) => {
  const url = new URL(baseUrl);
  url.pathname = '/stream/chat/merge/stream';
  url.searchParams.set('sources', JSON.stringify(sources));
  return url.toString();
};

export const canOpenMergedStreamChat = () => Boolean(RESOLVER_BASE_URL) && typeof WebSocket !== 'undefined';

export const canOpenMergedStreamChatSse = () => Boolean(RESOLVER_BASE_URL) && typeof EventSource !== 'undefined';

export const canOpenMergedStreamChatTransport = (transport: StreamChatTransport) => {
  return transport === 'websocket' ? canOpenMergedStreamChat() : canOpenMergedStreamChatSse();
};

export const openMergedStreamChatWebSocket = (
  sources: StreamChatSourceInput[],
  onEvent: (event: StreamChatServerEvent) => void,
  onError?: (error: Event) => void,
) => {
  if (!canOpenMergedStreamChat()) return null;

  const uniqueSources = getUniqueSources(sources);

  if (uniqueSources.length === 0) return null;

  const socket = new WebSocket(toWebSocketUrl(RESOLVER_BASE_URL));

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      payload: {
        sources: uniqueSources,
      },
      type: 'subscribe',
    }));
  });

  socket.addEventListener('message', (event) => {
    try {
      onEvent(JSON.parse(event.data) as StreamChatServerEvent);
    } catch (error) {
      console.warn('bizeye-chat-merge: invalid WebSocket payload.', error);
    }
  });

  socket.addEventListener('error', (event) => {
    onError?.(event);
  });

  return () => socket.close();
};

export const openMergedStreamChatSse = (
  sources: StreamChatSourceInput[],
  onEvent: (event: StreamChatServerEvent) => void,
  onError?: (error: Event) => void,
) => {
  if (!canOpenMergedStreamChatSse()) return null;

  const uniqueSources = getUniqueSources(sources);
  if (uniqueSources.length === 0) return null;

  const stream = new EventSource(toSseUrl(RESOLVER_BASE_URL, uniqueSources));

  stream.addEventListener('stream-chat', (event) => {
    try {
      onEvent(JSON.parse(event.data) as StreamChatServerEvent);
    } catch (error) {
      console.warn('bizeye-chat-merge: invalid SSE payload.', error);
    }
  });

  stream.addEventListener('error', (event) => {
    onError?.(event);
  });

  return () => stream.close();
};

export const openMergedStreamChat = (
  transport: StreamChatTransport,
  sources: StreamChatSourceInput[],
  onEvent: (event: StreamChatServerEvent) => void,
  onError?: (error: Event) => void,
) => {
  return transport === 'websocket'
    ? openMergedStreamChatWebSocket(sources, onEvent, onError)
    : openMergedStreamChatSse(sources, onEvent, onError);
};
