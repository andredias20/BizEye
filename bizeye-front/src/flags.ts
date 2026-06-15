import type { FlagDefinitionsType, FlagValuesType } from 'flags';
import type { ChatTransport } from './types';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);
const CHAT_TRANSPORT_VALUES = new Set<ChatTransport>(['sse', 'websocket']);

export const BIZEYE_RESOLVE_FLAG_KEY = 'bizeye-resolve';
export const BIZEYE_CHAT_MERGE_FLAG_KEY = 'bizeye-chat-merge';
export const BIZEYE_CHAT_TRANSPORT_FLAG_KEY = 'bizeye-chat-transport';

export const flagDefinitions: FlagDefinitionsType = {
  [BIZEYE_RESOLVE_FLAG_KEY]: {
    declaredInCode: true,
    defaultValue: false,
    description: 'Ativa o uso do backend para cache',
    options: [
      { value: false, label: 'Off' },
      { value: true, label: 'On' },
    ],
    origin: 'https://vercel.com/andredias20s-projects/biz-eye/flag/bizeye-resolve',
  },
  [BIZEYE_CHAT_MERGE_FLAG_KEY]: {
    declaredInCode: true,
    defaultValue: false,
    description: 'Ativa o painel de merge de chats YouTube',
    options: [
      { value: false, label: 'Off' },
      { value: true, label: 'On' },
    ],
  },
  [BIZEYE_CHAT_TRANSPORT_FLAG_KEY]: {
    declaredInCode: true,
    defaultValue: 'sse',
    description: 'Define o transporte do chat merge',
    options: [
      { value: 'sse', label: 'SSE' },
      { value: 'websocket', label: 'WebSocket' },
    ],
  },
};

type FlagsApiResponse = {
  flags?: Record<string, unknown>;
};

let cachedBizeyeResolve: Promise<boolean> | null = null;
let cachedBizeyeChatMerge: Promise<boolean> | null = null;
let cachedBizeyeChatTransport: Promise<ChatTransport> | null = null;

const parseFlagValue = (value: string | boolean | undefined | null) => {
  if (typeof value === 'boolean') return value;
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return null;
};

const parseChatTransportValue = (value: unknown): ChatTransport | null => {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  return CHAT_TRANSPORT_VALUES.has(normalized as ChatTransport) ? (normalized as ChatTransport) : null;
};

const getBuildTimeDefault = () => {
  return parseFlagValue(import.meta.env.VITE_FEATURE_BIZEYE_RESOLVE) ?? false;
};

const getBuildTimeChatMergeDefault = () => {
  return parseFlagValue(import.meta.env.VITE_FEATURE_BIZEYE_CHAT_MERGE) ?? false;
};

const getBuildTimeChatTransportDefault = (): ChatTransport => {
  return parseChatTransportValue(import.meta.env.VITE_FEATURE_BIZEYE_CHAT_TRANSPORT) ?? 'sse';
};

const getBrowserOverride = (key: string) => {
  if (typeof window === 'undefined') return null;

  try {
    return parseFlagValue(window.localStorage.getItem(key));
  } catch {
    return null;
  }
};

const getBrowserChatTransportOverride = () => {
  if (typeof window === 'undefined') return null;

  try {
    return parseChatTransportValue(window.localStorage.getItem(BIZEYE_CHAT_TRANSPORT_FLAG_KEY));
  } catch {
    return null;
  }
};

export const getInitialBizeyeResolveFlagValue = () => {
  return getBrowserOverride(BIZEYE_RESOLVE_FLAG_KEY) ?? getBuildTimeDefault();
};

export const getInitialBizeyeChatMergeFlagValue = () => {
  return getBrowserOverride(BIZEYE_CHAT_MERGE_FLAG_KEY) ?? getBuildTimeChatMergeDefault();
};

export const getInitialBizeyeChatTransportFlagValue = () => {
  return getBrowserChatTransportOverride() ?? getBuildTimeChatTransportDefault();
};

export const getFlagValues = (
  bizeyeResolve = getInitialBizeyeResolveFlagValue(),
  bizeyeChatMerge = getInitialBizeyeChatMergeFlagValue(),
  bizeyeChatTransport = getInitialBizeyeChatTransportFlagValue(),
): FlagValuesType => {
  return {
    [BIZEYE_CHAT_MERGE_FLAG_KEY]: bizeyeChatMerge,
    [BIZEYE_CHAT_TRANSPORT_FLAG_KEY]: bizeyeChatTransport,
    [BIZEYE_RESOLVE_FLAG_KEY]: bizeyeResolve,
  };
};

const fetchFlagValue = async <T,>(
  key: string,
  fallback: T,
  parse: (value: unknown) => T | null,
) => {
  const response = await fetch('/api/flags', {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Flags endpoint failed with status ${response.status}`);
  }

  const data = (await response.json()) as FlagsApiResponse;
  return parse(data.flags?.[key]) ?? fallback;
};

export const getBizeyeResolveFlagValue = async () => {
  const override = getBrowserOverride(BIZEYE_RESOLVE_FLAG_KEY);
  if (override !== null) return override;

  if (import.meta.env.DEV) return getBuildTimeDefault();
  if (typeof window === 'undefined') return getBuildTimeDefault();

  cachedBizeyeResolve ??= fetchFlagValue(BIZEYE_RESOLVE_FLAG_KEY, getBuildTimeDefault(), (value) =>
    parseFlagValue(value as boolean | string | undefined),
  ).catch((error) => {
    console.warn(`${BIZEYE_RESOLVE_FLAG_KEY}: failed to load Vercel flag value; using build-time default.`, error);
    return getBuildTimeDefault();
  });

  return cachedBizeyeResolve;
};

export const getBizeyeChatMergeFlagValue = async () => {
  const override = getBrowserOverride(BIZEYE_CHAT_MERGE_FLAG_KEY);
  if (override !== null) return override;

  if (import.meta.env.DEV) return getBuildTimeChatMergeDefault();
  if (typeof window === 'undefined') return getBuildTimeChatMergeDefault();

  cachedBizeyeChatMerge ??= fetchFlagValue(BIZEYE_CHAT_MERGE_FLAG_KEY, getBuildTimeChatMergeDefault(), (value) =>
    parseFlagValue(value as boolean | string | undefined),
  ).catch((error) => {
      console.warn(`${BIZEYE_CHAT_MERGE_FLAG_KEY}: failed to load Vercel flag value; using build-time default.`, error);
      return getBuildTimeChatMergeDefault();
  });

  return cachedBizeyeChatMerge;
};

export const getBizeyeChatTransportFlagValue = async () => {
  const override = getBrowserChatTransportOverride();
  if (override !== null) return override;

  if (import.meta.env.DEV) return getBuildTimeChatTransportDefault();
  if (typeof window === 'undefined') return getBuildTimeChatTransportDefault();

  cachedBizeyeChatTransport ??= fetchFlagValue(
    BIZEYE_CHAT_TRANSPORT_FLAG_KEY,
    getBuildTimeChatTransportDefault(),
    parseChatTransportValue,
  ).catch((error) => {
    console.warn(`${BIZEYE_CHAT_TRANSPORT_FLAG_KEY}: failed to load Vercel flag value; using build-time default.`, error);
    return getBuildTimeChatTransportDefault();
  });

  return cachedBizeyeChatTransport;
};
