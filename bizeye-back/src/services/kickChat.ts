import { randomUUID } from 'node:crypto';
import WebSocket, { type RawData } from 'ws';
import { getKickChatMode } from '../config/env.js';
import type {
  StreamChatMessageDraft,
  StreamChatSourceInput,
  StreamChatSourceState,
} from './streamChat.js';

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_KICK_ACCEPT_LANGUAGE = 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';
const DEFAULT_KICK_SEC_CH_UA = '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"';
const DEFAULT_KICK_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const KICK_PUSHER_APP_KEY = process.env.KICK_PUSHER_APP_KEY || '32cbd69e4b950bf97679';
const KICK_PUSHER_URL = `wss://ws-us2.pusher.com/app/${KICK_PUSHER_APP_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

type KickHttpProfile = 'browser-fetch' | 'browser-navigation';

type KickChatContext = {
  maxResults: number;
  publish: (message: StreamChatMessageDraft) => void;
  signal: AbortSignal;
  source: StreamChatSourceInput;
  updateSource: (state: StreamChatSourceState) => void;
};

type KickChatMessageFixture = {
  authorName: string;
  id: string;
  message: string;
  publishedAt: string;
};

type KickChatroomResolution = {
  chatroomId: string;
  title?: string;
};

class KickSourceStateError extends Error {
  readonly status: StreamChatSourceState['status'];
  readonly title?: string;

  constructor(message: string, status: StreamChatSourceState['status'], title?: string) {
    super(message);
    this.name = 'KickSourceStateError';
    this.status = status;
    this.title = title;
  }
}

const mockKickChannels: Array<{
  aliases: string[];
  chatroomId: string;
  messages: KickChatMessageFixture[];
  title: string;
}> = [
  {
    aliases: ['gaules', 'kickfixture', 'kick-mock', '12345'],
    chatroomId: '12345',
    messages: [
      {
        authorName: 'Kick Viewer',
        id: 'kick-gaules-chat-001',
        message: 'Mensagem chegando pela Kick.',
        publishedAt: '2026-06-14T21:00:01Z',
      },
      {
        authorName: 'Kick Ops',
        id: 'kick-gaules-chat-002',
        message: 'Adapter Kick no merge unificado.',
        publishedAt: '2026-06-14T21:00:07Z',
      },
    ],
    title: 'Gaules Kick',
  },
];

const sanitizeError = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected Kick chat error';
};

const sourceStateFromError = (source: StreamChatSourceInput, error: unknown) => {
  if (error instanceof KickSourceStateError) {
    return sourceState(source, error.status, {
      error: error.message,
      title: error.title || source.title,
    });
  }

  return sourceState(source, 'error', { error: sanitizeError(error) });
};

const isMockMode = () => getKickChatMode() === 'mock';

const getEnvValue = (name: string, fallback: string) => process.env[name]?.trim() || fallback;

const getKickBrowserHeaders = (profile: KickHttpProfile): Record<string, string> => {
  const headers: Record<string, string> = {
    'accept-language': getEnvValue('KICK_ACCEPT_LANGUAGE', DEFAULT_KICK_ACCEPT_LANGUAGE),
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'sec-ch-ua': getEnvValue('KICK_SEC_CH_UA', DEFAULT_KICK_SEC_CH_UA),
    'sec-ch-ua-mobile': getEnvValue('KICK_SEC_CH_UA_MOBILE', '?0'),
    'sec-ch-ua-platform': getEnvValue('KICK_SEC_CH_UA_PLATFORM', '"Windows"'),
    'user-agent': getEnvValue('KICK_USER_AGENT', DEFAULT_KICK_USER_AGENT),
  };

  if (profile === 'browser-navigation') {
    return {
      ...headers,
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    };
  }

  return {
    ...headers,
    accept: 'application/json,text/plain,*/*',
    origin: 'https://kick.com',
    referer: 'https://kick.com/',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
  };
};

const normalizeKickIdentifier = (value: string) => {
  const trimmed = value.trim();
  const withoutUrl = trimmed.replace(/^https?:\/\/(?:www\.)?kick\.com\//i, '');
  return withoutUrl.split(/[/?#]/)[0]?.replace(/^@/, '').trim() || trimmed;
};

const getDirectChatroomId = (identifier: string) => {
  const normalized = normalizeKickIdentifier(identifier);
  const directMatch = normalized.match(/^(?:chatroom:)?(\d+)$/i);
  return directMatch?.[1] ?? null;
};

const getChatroomOverride = (identifier: string) => {
  const normalized = normalizeKickIdentifier(identifier).toLowerCase();
  const entries = (process.env.KICK_CHATROOM_OVERRIDES || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const [rawSlug, rawChatroomId] = entry.split(':');
    const slug = rawSlug?.trim().toLowerCase();
    const chatroomId = rawChatroomId?.trim();

    if (slug === normalized && chatroomId && /^\d+$/.test(chatroomId)) {
      return chatroomId;
    }
  }

  return null;
};

const findMockKickChannel = (identifier: string) => {
  const normalized = normalizeKickIdentifier(identifier).toLowerCase();
  return mockKickChannels.find((channel) => channel.aliases.includes(normalized));
};

const sourceState = (
  source: StreamChatSourceInput,
  status: StreamChatSourceState['status'],
  fields: Partial<StreamChatSourceState> = {},
): StreamChatSourceState => ({
  identifier: source.identifier,
  platform: 'kick',
  pollingIntervalMillis: DEFAULT_POLL_MS,
  status,
  title: source.title,
  ...fields,
});

const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const parsePusherMessage = (raw: RawData) => {
  return JSON.parse(raw.toString()) as {
    channel?: string;
    data?: unknown;
    event?: string;
  };
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: getKickBrowserHeaders('browser-fetch'),
  });

  return {
    data: response.ok ? ((await response.json()) as Record<string, unknown>) : null,
    status: response.status,
  };
};

const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const getScalarString = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const getSender = (payload: Record<string, unknown>) => {
  const sender = payload.sender ?? payload.user;
  return sender && typeof sender === 'object' ? (sender as Record<string, unknown>) : {};
};

const hasBadge = (sender: Record<string, unknown>, badgeType: string) => {
  const identity = sender.identity;
  if (!identity || typeof identity !== 'object') return false;

  const badges = (identity as Record<string, unknown>).badges;
  if (!Array.isArray(badges)) return false;

  return badges.some((badge) => {
    if (!badge || typeof badge !== 'object') return false;
    const type = (badge as Record<string, unknown>).type;
    return typeof type === 'string' && type.toLowerCase() === badgeType;
  });
};

const toKickMessageDraft = (
  source: StreamChatSourceInput,
  payloadValue: unknown,
): StreamChatMessageDraft | null => {
  const payload = parseJson(payloadValue);
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const nestedMessage = record.message && typeof record.message === 'object'
    ? (record.message as Record<string, unknown>)
    : null;
  const sender = getSender(record);
  const content =
    getString(record.content) ??
    getString(record.message) ??
    (nestedMessage ? getString(nestedMessage.message) : null) ??
    (nestedMessage ? getString(nestedMessage.content) : null);

  if (!content) return null;

  const id =
    getString(record.message_id) ??
    getString(record.id) ??
    (nestedMessage ? getString(nestedMessage.id) : null) ??
    randomUUID();
  const publishedAt =
    getString(record.created_at) ??
    (nestedMessage ? getString(nestedMessage.created_at) : null) ??
    undefined;
  const authorName =
    getString(sender.username) ??
    getString(sender.name) ??
    getString(record.username) ??
    'Kick Viewer';
  const authorChannelId = getString(sender.channel_slug) ?? getString(sender.user_id) ?? getString(sender.id) ?? undefined;

  return {
    authorChannelId,
    authorName,
    authorProfileImageUrl: getString(sender.profile_picture) ?? undefined,
    id,
    identifier: source.identifier,
    isModerator: hasBadge(sender, 'moderator') || hasBadge(sender, 'staff'),
    isSponsor: hasBadge(sender, 'subscriber'),
    message: content,
    platform: 'kick',
    publishedAt,
    sourceTitle: source.title,
    type: getString(record.type) ?? (nestedMessage ? getString(nestedMessage.type) : null) ?? undefined,
  };
};

const getPrivateChannelTitle = (data: Record<string, unknown> | null, source: StreamChatSourceInput) => {
  const payload = data?.data && typeof data.data === 'object' ? (data.data as Record<string, unknown>) : {};
  const account = payload.account && typeof payload.account === 'object' ? (payload.account as Record<string, unknown>) : {};
  const user = account.user && typeof account.user === 'object' ? (account.user as Record<string, unknown>) : {};
  const channel = account.channel && typeof account.channel === 'object' ? (account.channel as Record<string, unknown>) : {};

  return getString(user.username) ?? getString(channel.slug) ?? source.title;
};

const resolveKickPrivateChannelFallback = async (
  source: StreamChatSourceInput,
  slug: string,
  blockedStatus: number,
): Promise<never> => {
  const channelResult = await fetchJson(`https://api.kick.com/private/v1/channels/${encodeURIComponent(slug)}`);

  if (channelResult.status === 404) {
    throw new KickSourceStateError('kick_channel_not_found', 'not_found', source.title);
  }

  if (!channelResult.data) {
    throw new KickSourceStateError(
      `kick_channel_lookup_failed_${blockedStatus}_private_${channelResult.status}`,
      'error',
      source.title,
    );
  }

  const title = getPrivateChannelTitle(channelResult.data, source);
  const livestreamResult = await fetchJson(
    `https://api.kick.com/private/v1/channels/${encodeURIComponent(slug)}/livestream`,
  );
  const livestreamData = livestreamResult.data?.data && typeof livestreamResult.data.data === 'object'
    ? (livestreamResult.data.data as Record<string, unknown>)
    : {};

  if (livestreamResult.data && livestreamData.livestream === null) {
    throw new KickSourceStateError('kick_channel_offline', 'offline', title);
  }

  throw new KickSourceStateError(`kick_chatroom_lookup_blocked_${blockedStatus}`, 'error', title);
};

const resolveKickChatroom = async (source: StreamChatSourceInput): Promise<KickChatroomResolution> => {
  const chatIdentifier = source.chatIdentifier?.trim();
  const directChatroomId = chatIdentifier ? getDirectChatroomId(chatIdentifier) : getDirectChatroomId(source.identifier);
  if (directChatroomId) return { chatroomId: directChatroomId, title: source.title };

  const chatroomOverride = getChatroomOverride(source.identifier);
  if (chatroomOverride) return { chatroomId: chatroomOverride, title: source.title };

  if (isMockMode()) {
    const channel = findMockKickChannel(source.identifier);
    if (!channel) throw new Error('kick_mock_channel_not_found');
    return { chatroomId: channel.chatroomId, title: source.title || channel.title };
  }

  const slug = normalizeKickIdentifier(source.identifier);
  const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
    headers: getKickBrowserHeaders('browser-navigation'),
  });

  if (!response.ok) {
    if (response.status === 403) {
      return resolveKickPrivateChannelFallback(source, slug, response.status);
    }

    throw new KickSourceStateError(`kick_channel_lookup_failed_${response.status}`, 'error', source.title);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const chatroom = data.chatroom && typeof data.chatroom === 'object'
    ? (data.chatroom as Record<string, unknown>)
    : {};
  const chatroomId = getScalarString(chatroom.id) ?? getScalarString(data.chatroom_id);
  const user = data.user && typeof data.user === 'object' ? (data.user as Record<string, unknown>) : {};

  if (!chatroomId) throw new KickSourceStateError('kick_chatroom_not_found', 'not_found', source.title);

  return {
    chatroomId,
    title: getString(user.username) ?? getString(data.slug) ?? source.title,
  };
};

export const fetchKickChatSnapshot = async (
  source: StreamChatSourceInput,
  maxResults: number,
): Promise<{ messages: StreamChatMessageDraft[]; source: StreamChatSourceState }> => {
  if (isMockMode()) {
    const channel = findMockKickChannel(source.identifier);
    if (!channel) {
      return {
        messages: [],
        source: sourceState(source, 'not_found', { error: 'kick_mock_channel_not_found' }),
      };
    }

    return {
      messages: channel.messages.slice(0, maxResults).map((message) => ({
        authorName: message.authorName,
        id: message.id,
        identifier: source.identifier,
        message: message.message,
        platform: 'kick',
        publishedAt: message.publishedAt,
        sourceTitle: source.title || channel.title,
        type: 'textMessageEvent',
      })),
      source: sourceState(source, 'live', { title: source.title || channel.title }),
    };
  }

  try {
    const resolution = await resolveKickChatroom(source);
    return {
      messages: [],
      source: sourceState(source, 'live', { title: resolution.title }),
    };
  } catch (error) {
    return {
      messages: [],
      source: sourceStateFromError(source, error),
    };
  }
};

const runMockKickChat = async ({ maxResults, publish, signal, source, updateSource }: KickChatContext) => {
  const result = await fetchKickChatSnapshot(source, maxResults);
  updateSource(result.source);

  for (const message of result.messages) {
    if (signal.aborted) return;
    publish(message);
  }
};

export const runKickChat = async ({ maxResults, publish, signal, source, updateSource }: KickChatContext) => {
  if (isMockMode()) {
    await runMockKickChat({ maxResults, publish, signal, source, updateSource });
    return;
  }

  let resolution: KickChatroomResolution;

  try {
    resolution = await resolveKickChatroom(source);
  } catch (error) {
    updateSource(sourceStateFromError(source, error));
    return;
  }

  const channel = `chatrooms.${resolution.chatroomId}.v2`;
  const socket = new WebSocket(KICK_PUSHER_URL);

  const closeSocket = () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };

  signal.addEventListener('abort', closeSocket, { once: true });

  await new Promise<void>((resolve) => {
    socket.on('open', () => {
      socket.send(JSON.stringify({
        data: {
          auth: '',
          channel,
        },
        event: 'pusher:subscribe',
      }));
    });

    socket.on('message', (raw) => {
      try {
        const event = parsePusherMessage(raw);

        if (event.event === 'pusher:ping') {
          socket.send(JSON.stringify({ event: 'pusher:pong' }));
          return;
        }

        if (event.event === 'pusher_internal:subscription_succeeded') {
          updateSource(sourceState(source, 'live', { title: resolution.title || source.title }));
          return;
        }

        if (event.event !== 'App\\Events\\ChatMessageEvent' && event.event !== 'App\\Events\\ChatMessageSentEvent') {
          return;
        }

        const draft = toKickMessageDraft(source, event.data);
        if (draft) publish({
          ...draft,
          sourceTitle: draft.sourceTitle || resolution.title || source.title,
        });
      } catch (error) {
        updateSource(sourceState(source, 'error', { error: sanitizeError(error) }));
      }
    });

    socket.on('error', (error) => {
      updateSource(sourceState(source, 'error', { error: sanitizeError(error) }));
    });

    socket.on('close', () => {
      signal.removeEventListener('abort', closeSocket);
      resolve();
    });
  });
};
