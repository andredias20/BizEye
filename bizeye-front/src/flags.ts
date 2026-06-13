import type { FlagDefinitionsType, FlagValuesType } from 'flags';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);

export const BIZEYE_RESOLVE_FLAG_KEY = 'bizeye-resolve';

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
};

type FlagsApiResponse = {
  flags?: Record<string, unknown>;
};

let cachedBizeyeResolve: Promise<boolean> | null = null;

const parseFlagValue = (value: string | boolean | undefined | null) => {
  if (typeof value === 'boolean') return value;
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return null;
};

const getBuildTimeDefault = () => {
  return parseFlagValue(import.meta.env.VITE_FEATURE_BIZEYE_RESOLVE) ?? false;
};

const getBrowserOverride = () => {
  if (typeof window === 'undefined') return null;

  try {
    return parseFlagValue(window.localStorage.getItem(BIZEYE_RESOLVE_FLAG_KEY));
  } catch {
    return null;
  }
};

export const getInitialBizeyeResolveFlagValue = () => {
  return getBrowserOverride() ?? getBuildTimeDefault();
};

export const getFlagValues = (bizeyeResolve = getInitialBizeyeResolveFlagValue()): FlagValuesType => {
  return {
    [BIZEYE_RESOLVE_FLAG_KEY]: bizeyeResolve,
  };
};

const fetchBizeyeResolveFlagValue = async () => {
  const response = await fetch('/api/flags', {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Flags endpoint failed with status ${response.status}`);
  }

  const data = (await response.json()) as FlagsApiResponse;
  return parseFlagValue(data.flags?.[BIZEYE_RESOLVE_FLAG_KEY] as boolean | string | undefined) ?? getBuildTimeDefault();
};

export const getBizeyeResolveFlagValue = async () => {
  const override = getBrowserOverride();
  if (override !== null) return override;

  if (typeof window === 'undefined') return getBuildTimeDefault();

  cachedBizeyeResolve ??= fetchBizeyeResolveFlagValue().catch((error) => {
    console.warn(`${BIZEYE_RESOLVE_FLAG_KEY}: failed to load Vercel flag value; using build-time default.`, error);
    return getBuildTimeDefault();
  });

  return cachedBizeyeResolve;
};
