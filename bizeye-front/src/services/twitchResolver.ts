export type TwitchResolvedInput = {
  chatIdentifier?: string;
  id: string;
  title: string;
};

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
    // Fall back to string cleanup for plain usernames and partial URLs.
  }

  const withoutUrl = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?twitch\.tv\//i, '');
  return withoutUrl.split(/[/?#]/)[0]?.replace(/^[@#]/, '').trim().toLowerCase() || '';
};

const normalizeTwitchChatIdentifier = (value: string) => {
  const trimmed = value.trim();
  const roomId = trimmed.match(/^room-id:(\d+)$/i);

  if (roomId) return `room-id:${roomId[1]}`;

  const channel = normalizeTwitchIdentifier(trimmed.replace(/^(?:chat|channel):/i, ''));
  return channel ? `channel:${channel}` : undefined;
};

const parseExplicitChatIdentifier = (value: string) => {
  const trimmed = value.trim();
  const pipeIndex = trimmed.indexOf('|');

  if (pipeIndex !== -1) {
    return {
      rawChatIdentifier: trimmed.slice(pipeIndex + 1),
      rawIdentifier: trimmed.slice(0, pipeIndex),
    };
  }

  const suffixMatch = trimmed.match(/^(.+?)\s+((?:chat|channel|room-id):.+)$/i);
  if (!suffixMatch) return null;

  return {
    rawChatIdentifier: suffixMatch[2] || '',
    rawIdentifier: suffixMatch[1] || '',
  };
};

export const resolveTwitchInput = (input: string): TwitchResolvedInput => {
  const explicit = parseExplicitChatIdentifier(input);

  if (explicit) {
    const id = normalizeTwitchIdentifier(explicit.rawIdentifier);
    const chatIdentifier = normalizeTwitchChatIdentifier(explicit.rawChatIdentifier);

    if (!id) throw new Error('Please enter a Twitch username or link');

    return {
      chatIdentifier,
      id,
      title: id,
    };
  }

  const id = normalizeTwitchIdentifier(input);
  if (!id) throw new Error('Please enter a Twitch username or link');

  return {
    id,
    title: id,
  };
};
