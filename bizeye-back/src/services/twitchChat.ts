import { randomUUID } from 'node:crypto';
import WebSocket, { type RawData } from 'ws';
import { getTwitchChatMode } from '../config/env.js';
import type {
  StreamChatMessageDraft,
  StreamChatSourceInput,
  StreamChatSourceState,
} from './streamChat.js';

const DEFAULT_POLL_MS = 5_000;
const TWITCH_IRC_WEBSOCKET_URL = process.env.TWITCH_IRC_WEBSOCKET_URL || 'wss://irc-ws.chat.twitch.tv:443';

type TwitchChatContext = {
  maxResults: number;
  publish: (message: StreamChatMessageDraft) => void;
  signal: AbortSignal;
  source: StreamChatSourceInput;
  updateSource: (state: StreamChatSourceState) => void;
};

type TwitchChatMessageFixture = {
  authorName: string;
  id: string;
  message: string;
  publishedAt: string;
};

export type TwitchIrcMessage = {
  command: string;
  params: string[];
  prefix?: string;
  tags: Record<string, string>;
  trailing?: string;
};

class TwitchSourceStateError extends Error {
  readonly status: StreamChatSourceState['status'];
  readonly title?: string;

  constructor(message: string, status: StreamChatSourceState['status'], title?: string) {
    super(message);
    this.name = 'TwitchSourceStateError';
    this.status = status;
    this.title = title;
  }
}

const mockTwitchChannels: Array<{
  aliases: string[];
  messages: TwitchChatMessageFixture[];
  title: string;
}> = [
  {
    aliases: ['gaules', 'twitchfixture', 'twitch-mock'],
    messages: [
      {
        authorName: 'Twitch Viewer',
        id: 'twitch-gaules-chat-001',
        message: 'Mensagem chegando pela Twitch.',
        publishedAt: '2026-06-14T21:00:03Z',
      },
      {
        authorName: 'Twitch Ops',
        id: 'twitch-gaules-chat-002',
        message: 'Adapter Twitch no merge unificado.',
        publishedAt: '2026-06-14T21:00:09Z',
      },
    ],
    title: 'Gaules Twitch',
  },
];

const sanitizeError = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected Twitch chat error';
};

const sourceStateFromError = (source: StreamChatSourceInput, error: unknown) => {
  if (error instanceof TwitchSourceStateError) {
    return sourceState(source, error.status, {
      error: error.message,
      title: error.title || source.title,
    });
  }

  return sourceState(source, 'error', { error: sanitizeError(error) });
};

const isMockMode = () => getTwitchChatMode() === 'mock';

export const normalizeTwitchIdentifier = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (/(^|\.)twitch\.tv$/i.test(url.hostname)) {
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts[0]?.toLowerCase() === 'popout' && pathParts[1]) {
        return pathParts[1].replace(/^[@#]/, '').trim().toLowerCase();
      }

      return pathParts[0]?.replace(/^[@#]/, '').trim().toLowerCase() || '';
    }
  } catch {
    // Fall back to lightweight string cleanup below.
  }

  const withoutUrl = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?twitch\.tv\//i, '');
  return withoutUrl.split(/[/?#]/)[0]?.replace(/^[@#]/, '').trim().toLowerCase() || '';
};

const normalizeTwitchChatIdentifier = (value: string) => {
  const trimmed = value.trim();
  const roomId = trimmed.match(/^room-id:(\d+)$/i);

  if (roomId) return '';

  return normalizeTwitchIdentifier(trimmed.replace(/^(?:chat|channel):/i, ''));
};

const resolveTwitchChatChannel = (source: StreamChatSourceInput) => {
  const chatIdentifier = source.chatIdentifier?.trim();
  const channel = (
    chatIdentifier ? normalizeTwitchChatIdentifier(chatIdentifier) : ''
  ) || normalizeTwitchIdentifier(source.identifier);

  if (!channel) {
    throw new TwitchSourceStateError('twitch_channel_identifier_required', 'error', source.title);
  }

  if (!/^[a-z0-9_]{1,25}$/.test(channel)) {
    throw new TwitchSourceStateError('twitch_channel_identifier_invalid', 'error', source.title || channel);
  }

  return channel;
};

const findMockTwitchChannel = (identifier: string, chatIdentifier?: string) => {
  const normalized = normalizeTwitchChatIdentifier(chatIdentifier || '') || normalizeTwitchIdentifier(identifier);
  return mockTwitchChannels.find((channel) => channel.aliases.includes(normalized));
};

const sourceState = (
  source: StreamChatSourceInput,
  status: StreamChatSourceState['status'],
  fields: Partial<StreamChatSourceState> = {},
): StreamChatSourceState => ({
  identifier: source.identifier,
  platform: 'twitch',
  pollingIntervalMillis: DEFAULT_POLL_MS,
  status,
  title: source.title,
  ...fields,
});

const parseIrcTagValue = (value: string) => {
  const escapes: Record<string, string> = {
    ':': ';',
    '\\': '\\',
    n: '\n',
    r: '\r',
    s: ' ',
  };

  return value.replace(/\\([snr:\\])/g, (_match, key: string) => escapes[key] ?? key);
};

const parseIrcTags = (rawTags: string) => {
  const tags: Record<string, string> = {};

  for (const entry of rawTags.split(';')) {
    const [rawKey, ...rawValue] = entry.split('=');
    const key = rawKey.trim();
    if (!key) continue;

    tags[key] = parseIrcTagValue(rawValue.join('='));
  }

  return tags;
};

export const parseTwitchIrcLine = (line: string): TwitchIrcMessage | null => {
  let rest = line.trim();
  if (!rest) return null;

  let tags: Record<string, string> = {};
  let prefix: string | undefined;

  if (rest.startsWith('@')) {
    const tagsEnd = rest.indexOf(' ');
    if (tagsEnd === -1) return null;

    tags = parseIrcTags(rest.slice(1, tagsEnd));
    rest = rest.slice(tagsEnd + 1);
  }

  if (rest.startsWith(':')) {
    const prefixEnd = rest.indexOf(' ');
    if (prefixEnd === -1) return null;

    prefix = rest.slice(1, prefixEnd);
    rest = rest.slice(prefixEnd + 1);
  }

  const trailingStart = rest.indexOf(' :');
  const trailing = trailingStart === -1 ? undefined : rest.slice(trailingStart + 2);
  const commandAndParams = trailingStart === -1 ? rest : rest.slice(0, trailingStart);
  const [rawCommand, ...params] = commandAndParams.split(' ').filter(Boolean);
  if (!rawCommand) return null;

  return {
    command: rawCommand.toUpperCase(),
    params,
    prefix,
    tags,
    trailing,
  };
};

const parseTwitchIrcPayload = (raw: RawData) => {
  return raw.toString().split(/\r?\n/).map(parseTwitchIrcLine).filter((line): line is TwitchIrcMessage => Boolean(line));
};

const getPrefixLogin = (prefix?: string) => {
  if (!prefix) return null;
  const [login] = prefix.split('!');
  return login?.trim() || null;
};

const getBadgeNames = (badges: string | undefined) => {
  if (!badges) return new Set<string>();

  return new Set(
    badges
      .split(',')
      .map((badge) => badge.split('/')[0]?.trim().toLowerCase())
      .filter((badge): badge is string => Boolean(badge)),
  );
};

const getPublishedAt = (value: string | undefined) => {
  if (!value) return undefined;

  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return undefined;

  return new Date(timestamp).toISOString();
};

const normalizeActionMessage = (message: string) => {
  const actionMatch = message.match(/^\u0001ACTION\s+(.+)\u0001$/);

  return {
    message: actionMatch?.[1] ?? message,
    type: actionMatch ? 'action' : 'privmsg',
  };
};

export const toTwitchMessageDraft = (
  source: StreamChatSourceInput,
  ircMessage: TwitchIrcMessage,
): StreamChatMessageDraft | null => {
  if (ircMessage.command !== 'PRIVMSG' || !ircMessage.trailing) return null;

  const channel = ircMessage.params[0]?.replace(/^#/, '') || normalizeTwitchIdentifier(source.identifier);
  const badges = getBadgeNames(ircMessage.tags.badges);
  const normalizedMessage = normalizeActionMessage(ircMessage.trailing);
  const authorName = ircMessage.tags['display-name'] || getPrefixLogin(ircMessage.prefix) || 'Twitch Viewer';

  return {
    authorChannelId: ircMessage.tags['user-id'] || undefined,
    authorName,
    id: ircMessage.tags.id || randomUUID(),
    identifier: source.identifier,
    isModerator:
      ircMessage.tags.mod === '1' ||
      badges.has('moderator') ||
      badges.has('staff') ||
      badges.has('admin') ||
      badges.has('global_mod'),
    isOwner: badges.has('broadcaster'),
    isSponsor: ircMessage.tags.subscriber === '1' || badges.has('subscriber') || badges.has('founder'),
    message: normalizedMessage.message,
    platform: 'twitch',
    publishedAt: getPublishedAt(ircMessage.tags['tmi-sent-ts']),
    sourceTitle: source.title || channel,
    type: normalizedMessage.type,
  };
};

const getNoticeError = (source: StreamChatSourceInput, ircMessage: TwitchIrcMessage) => {
  const msgId = ircMessage.tags['msg-id'];
  const notice = ircMessage.trailing || '';

  if (msgId === 'msg_channel_suspended') {
    return new TwitchSourceStateError('twitch_channel_suspended', 'not_found', source.title);
  }

  if (/Login authentication failed|Improperly formatted auth/i.test(notice)) {
    return new TwitchSourceStateError('twitch_auth_failed', 'error', source.title);
  }

  if (msgId === 'msg_banned' || msgId === 'msg_timedout') {
    return new TwitchSourceStateError(`twitch_notice_${msgId}`, 'chat_unavailable', source.title);
  }

  return null;
};

const getTwitchCredentials = () => {
  const token = process.env.TWITCH_CHAT_OAUTH_TOKEN?.trim();
  const username = process.env.TWITCH_CHAT_USERNAME?.trim().toLowerCase();

  if (token && username) {
    return {
      nick: username,
      pass: token.startsWith('oauth:') ? token : `oauth:${token}`,
    };
  }

  return {
    nick: `justinfan${Math.floor(Math.random() * 100_000)}`,
    pass: undefined,
  };
};

const sendIrc = (socket: WebSocket, command: string) => {
  socket.send(`${command}\r\n`);
};

export const fetchTwitchChatSnapshot = async (
  source: StreamChatSourceInput,
  maxResults: number,
): Promise<{ messages: StreamChatMessageDraft[]; source: StreamChatSourceState }> => {
  if (isMockMode()) {
    const channel = findMockTwitchChannel(source.identifier, source.chatIdentifier);
    if (!channel) {
      return {
        messages: [],
        source: sourceState(source, 'not_found', { error: 'twitch_mock_channel_not_found' }),
      };
    }

    return {
      messages: channel.messages.slice(0, maxResults).map((message) => ({
        authorName: message.authorName,
        id: message.id,
        identifier: source.identifier,
        message: message.message,
        platform: 'twitch',
        publishedAt: message.publishedAt,
        sourceTitle: source.title || channel.title,
        type: 'privmsg',
      })),
      source: sourceState(source, 'live', { title: source.title || channel.title }),
    };
  }

  try {
    const channel = resolveTwitchChatChannel(source);
    return {
      messages: [],
      source: sourceState(source, 'live', { title: source.title || channel }),
    };
  } catch (error) {
    return {
      messages: [],
      source: sourceStateFromError(source, error),
    };
  }
};

const runMockTwitchChat = async ({ maxResults, publish, signal, source, updateSource }: TwitchChatContext) => {
  const result = await fetchTwitchChatSnapshot(source, maxResults);
  updateSource(result.source);

  for (const message of result.messages) {
    if (signal.aborted) return;
    publish(message);
  }
};

export const runTwitchChat = async ({ maxResults, publish, signal, source, updateSource }: TwitchChatContext) => {
  if (isMockMode()) {
    await runMockTwitchChat({ maxResults, publish, signal, source, updateSource });
    return;
  }

  let channel: string;

  try {
    channel = resolveTwitchChatChannel(source);
  } catch (error) {
    updateSource(sourceStateFromError(source, error));
    return;
  }

  const socket = new WebSocket(TWITCH_IRC_WEBSOCKET_URL);
  const closeSocket = () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };

  signal.addEventListener('abort', closeSocket, { once: true });

  await new Promise<void>((resolve) => {
    let hasJoined = false;

    socket.on('open', () => {
      const credentials = getTwitchCredentials();

      sendIrc(socket, 'CAP REQ :twitch.tv/tags twitch.tv/commands');
      if (credentials.pass) sendIrc(socket, `PASS ${credentials.pass}`);
      sendIrc(socket, `NICK ${credentials.nick}`);
      sendIrc(socket, `JOIN #${channel}`);
    });

    socket.on('message', (raw) => {
      try {
        for (const ircMessage of parseTwitchIrcPayload(raw)) {
          if (ircMessage.command === 'PING') {
            sendIrc(socket, `PONG :${ircMessage.trailing || 'tmi.twitch.tv'}`);
            continue;
          }

          if (ircMessage.command === 'NOTICE') {
            const noticeError = getNoticeError(source, ircMessage);
            if (noticeError) updateSource(sourceStateFromError(source, noticeError));
            continue;
          }

          if (ircMessage.command === 'ROOMSTATE') {
            hasJoined = true;
            updateSource(sourceState(source, 'live', { title: source.title || channel }));
            continue;
          }

          const draft = toTwitchMessageDraft(source, ircMessage);
          if (!draft) continue;

          if (!hasJoined) {
            hasJoined = true;
            updateSource(sourceState(source, 'live', { title: source.title || channel }));
          }

          publish(draft);
        }
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
