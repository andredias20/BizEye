import type { CreatorProfile } from '../types';

const RESOLVER_BASE_URL = (import.meta.env.VITE_RESOLVER_BASE_URL || '').replace(/\/+$/, '');

type RecommendedStreamsResponse = {
  items?: CreatorProfile[];
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const normalizeCreator = (value: CreatorProfile): CreatorProfile | null => {
  const id = value.id?.trim();
  const title = value.title?.trim();

  if (!id || !title || !['youtube', 'twitch', 'kick'].includes(value.platform)) {
    return null;
  }

  return {
    chatIdentifier: value.chatIdentifier?.trim() || undefined,
    description: value.description?.trim() || 'Live recomendada pelo BizEye.',
    handle: value.handle?.trim() || undefined,
    id,
    liveStatus: value.liveStatus,
    platform: value.platform,
    recommendationId: value.recommendationId?.trim() || undefined,
    thumbnail: value.thumbnail?.trim() || undefined,
    title,
  };
};

export const fetchRecommendedCreators = async (limit = 12) => {
  if (!RESOLVER_BASE_URL) {
    throw new Error('Configure VITE_RESOLVER_BASE_URL para carregar recomendacoes do backend.');
  }

  const params = new URLSearchParams({ limit: String(limit) });
  const data = await fetchJson<RecommendedStreamsResponse>(`${RESOLVER_BASE_URL}/recommended-lives?${params}`, {
    headers: {
      accept: 'application/json',
    },
  });

  return (data.items || []).map(normalizeCreator).filter((creator): creator is CreatorProfile => Boolean(creator));
};
