export type KickResolvedInput = {
  chatIdentifier?: string;
  id: string;
  title: string;
};

type KickChannelResponse = {
  chatroom?: {
    id?: number | string | null;
  } | null;
  chatroom_id?: number | string | null;
  slug?: string | null;
  user?: {
    username?: string | null;
  } | null;
};

const KICK_CHANNEL_API_BASE_URL = 'https://kick.com/api/v2/channels';

const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const getScalarString = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const toChatIdentifier = (chatroomId: string) => `chatroom:${chatroomId}`;

export const normalizeKickIdentifier = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withoutUrl = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?kick\.com\//i, '');
  return withoutUrl.split(/[/?#]/)[0]?.replace(/^@/, '').trim() || trimmed;
};

const parseExplicitChatroom = (value: string) => {
  const match = value.trim().match(/^(.+?)(?:\||\s+chatroom:)(\d+)$/i);
  if (!match) return null;

  const id = normalizeKickIdentifier(match[1] || '');
  const chatroomId = match[2];

  if (!id || !chatroomId) return null;

  return {
    chatIdentifier: toChatIdentifier(chatroomId),
    id,
    title: id,
  };
};

const fetchKickChatroomFromBrowser = async (id: string): Promise<KickResolvedInput | null> => {
  const response = await fetch(`${KICK_CHANNEL_API_BASE_URL}/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) return null;

  const data = await response.json() as KickChannelResponse;
  const chatroomId = getScalarString(data.chatroom?.id) ?? getScalarString(data.chatroom_id);
  if (!chatroomId) return null;

  return {
    chatIdentifier: toChatIdentifier(chatroomId),
    id,
    title: getString(data.user?.username) ?? getString(data.slug) ?? id,
  };
};

export const resolveKickInput = async (input: string): Promise<KickResolvedInput> => {
  const explicit = parseExplicitChatroom(input);
  if (explicit) return explicit;

  const id = normalizeKickIdentifier(input);
  if (!id) throw new Error('Please enter a Kick username or link');

  try {
    const resolved = await fetchKickChatroomFromBrowser(id);
    if (resolved) return resolved;
  } catch (error) {
    console.warn('bizeye-kick-resolve: browser lookup failed; keeping channel slug only.', error);
  }

  return {
    id,
    title: id,
  };
};
