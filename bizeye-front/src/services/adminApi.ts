import type { CreatorProfile } from '../types';
import type { YoutubeChannelResult } from './youtubeResolver';

const RESOLVER_BASE_URL = (import.meta.env.VITE_RESOLVER_BASE_URL || '').replace(/\/+$/, '');

export class AdminUnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'AdminUnauthorizedError';
  }
}

export type AdminUser = {
  displayName?: string;
  email: string;
  id: string;
};

export type AdminRecommendedLive = {
  channelId: string;
  createdAt: string;
  createdBy?: string;
  description?: string;
  displayName: string;
  enabled: boolean;
  id: string;
  sortOrder: number;
  thumbnailUrl?: string;
  updatedAt: string;
  videoId?: string;
};

export type RecommendedLiveInput = {
  channelId: string;
  description?: string;
  displayName: string;
  enabled: boolean;
  sortOrder: number;
  thumbnailUrl?: string;
  videoId?: string;
};

type AdminMeResponse = {
  admin?: AdminUser;
};

type AdminRecommendedLivesResponse = {
  items?: AdminRecommendedLive[];
};

type AdminRecommendedLiveResponse = {
  item?: AdminRecommendedLive;
};

type YoutubeSearchResponse = {
  items?: YoutubeChannelResult[];
};

const requireResolverBaseUrl = () => {
  if (!RESOLVER_BASE_URL) {
    throw new Error('Configure VITE_RESOLVER_BASE_URL para usar a area admin.');
  }

  return RESOLVER_BASE_URL;
};

const adminFetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${requireResolverBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    throw new AdminUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const loginAdmin = async (email: string, password: string) => {
  const data = await adminFetchJson<AdminMeResponse>('/admin/auth/login', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  });

  if (!data.admin) throw new Error('Login failed.');
  return data.admin;
};

export const logoutAdmin = async () => {
  await adminFetchJson<{ ok: boolean }>('/admin/auth/logout', { method: 'POST' });
};

export const fetchAdminMe = async () => {
  const data = await adminFetchJson<AdminMeResponse>('/admin/auth/me');
  return data.admin ?? null;
};

export const fetchAdminRecommendedLives = async () => {
  const data = await adminFetchJson<AdminRecommendedLivesResponse>('/admin/recommended-lives');
  return data.items ?? [];
};

export const createAdminRecommendedLive = async (input: RecommendedLiveInput) => {
  const data = await adminFetchJson<AdminRecommendedLiveResponse>('/admin/recommended-lives', {
    body: JSON.stringify(input),
    method: 'POST',
  });

  if (!data.item) throw new Error('Create failed.');
  return data.item;
};

export const updateAdminRecommendedLive = async (id: string, input: Partial<RecommendedLiveInput>) => {
  const data = await adminFetchJson<AdminRecommendedLiveResponse>(`/admin/recommended-lives/${encodeURIComponent(id)}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });

  if (!data.item) throw new Error('Update failed.');
  return data.item;
};

export const deleteAdminRecommendedLive = async (id: string) => {
  await adminFetchJson<{ ok: boolean }>(`/admin/recommended-lives/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};

export const reorderAdminRecommendedLives = async (items: Array<{ id: string; sortOrder: number }>) => {
  await adminFetchJson<{ ok: boolean }>('/admin/recommended-lives/reorder', {
    body: JSON.stringify({ items }),
    method: 'POST',
  });
};

export const searchAdminYoutubeChannels = async (query: string, maxResults = 6) => {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: query,
  });
  const data = await adminFetchJson<YoutubeSearchResponse>(`/youtube/channels/search?${params}`);

  return data.items ?? [];
};

export const adminLiveToCreator = (item: AdminRecommendedLive): CreatorProfile => ({
  description: item.description || 'Live recomendada pelo BizEye.',
  id: item.channelId,
  platform: 'youtube',
  thumbnail: item.thumbnailUrl,
  title: item.displayName,
  videoId: item.videoId,
});
