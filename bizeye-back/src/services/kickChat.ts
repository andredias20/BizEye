import { randomUUID } from 'node:crypto';
import WebSocket, { type RawData } from 'ws';
import { getKickChatMode } from '../config/env.js';
import type {
  StreamChatMessageDraft,
  StreamChatSourceInput,
  StreamChatSourceState,
} from './streamChat.js';

const DEFAULT_POLL_MS = 5_000;
const KICK_PUSHER_APP_KEY = process.env.KICK_PUSHER_APP_KEY || '32cbd69e4b950bf97679';
const KICK_PUSHER_URL = `wss://ws-us2.pusher.com/app/${KICK_PUSHER_APP_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

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

const isMockMode = () => getKickChatMode() === 'mock';

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

const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

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

const resolveKickChatroom = async (source: StreamChatSourceInput): Promise<KickChatroomResolution> => {
  const directChatroomId = getDirectChatroomId(source.identifier);
  if (directChatroomId) return { chatroomId: directChatroomId, title: source.title };

  if (isMockMode()) {
    const channel = findMockKickChannel(source.identifier);
    if (!channel) throw new Error('kick_mock_channel_not_found');
    return { chatroomId: channel.chatroomId, title: source.title || channel.title };
  }

  const slug = normalizeKickIdentifier(source.identifier);
  const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
    headers: {
      accept: 'application/json',
      'user-agent': 'BizEye/0.1 (+https://bizeye.local)',
    },
  });

  if (!response.ok) {
    throw new Error(`kick_channel_lookup_failed_${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const chatroom = data.chatroom && typeof data.chatroom === 'object'
    ? (data.chatroom as Record<string, unknown>)
    : {};
  const chatroomId = getString(chatroom.id) ?? getString(data.chatroom_id);
  const user = data.user && typeof data.user === 'object' ? (data.user as Record<string, unknown>) : {};

  if (!chatroomId) throw new Error('kick_chatroom_not_found');

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
      source: sourceState(source, 'error', { error: sanitizeError(error) }),
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
    updateSource(sourceState(source, 'error', { error: sanitizeError(error) }));
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
