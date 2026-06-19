import type { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseDriver } from '../config/env.js';
import { getPostgresPool } from '../lib/postgres.js';
import { createSupabaseAdminClient } from '../lib/supabase.js';

export type RecommendedStreamPlatform = 'youtube' | 'twitch' | 'kick';

export type RecommendedStreamRow = {
  chat_identifier: string | null;
  description: string | null;
  display_order: number | null;
  handle: string | null;
  platform: RecommendedStreamPlatform;
  slug: string;
  stream_id: string;
  thumbnail_url: string | null;
  title: string;
};

export type RecommendedStream = {
  chatIdentifier?: string;
  description: string;
  handle?: string;
  id: string;
  platform: RecommendedStreamPlatform;
  recommendationId: string;
  thumbnail?: string;
  title: string;
};

export type RecommendedStreamsStore = {
  listActiveRecommendedStreams: (limit: number) => Promise<RecommendedStreamRow[]>;
};

const recommendedStreamColumns = [
  'slug',
  'platform',
  'stream_id',
  'title',
  'description',
  'handle',
  'chat_identifier',
  'thumbnail_url',
  'display_order',
].join(', ');

const normalizeText = (value: string | null | undefined) => value?.trim() || undefined;

const normalizeKickIdentifier = (value: string) => {
  const trimmed = value.trim();
  const withoutUrl = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?kick\.com\//i, '');
  return withoutUrl.split(/[/?#]/)[0]?.replace(/^@/, '').trim() || trimmed;
};

const normalizeTwitchIdentifier = (value: string) => {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (/(^|\.)twitch\.tv$/i.test(url.hostname)) {
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts[0]?.toLowerCase() === 'popout' && pathParts[1]) {
        return pathParts[1].replace(/^[@#]/, '').trim().toLowerCase();
      }

      return pathParts[0]?.replace(/^[@#]/, '').trim().toLowerCase() || trimmed;
    }
  } catch {
    // Fall back to plain username cleanup.
  }

  const withoutUrl = trimmed.replace(/^(?:https?:\/\/)?(?:www\.)?twitch\.tv\//i, '');
  return withoutUrl.split(/[/?#]/)[0]?.replace(/^[@#]/, '').trim().toLowerCase() || trimmed;
};

const normalizeYouTubeIdentifier = (value: string) => {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);

    if (/youtu\.be$/i.test(url.hostname)) {
      return url.pathname.split('/').filter(Boolean)[0] || trimmed;
    }

    if (/(^|\.)youtube\.com$/i.test(url.hostname)) {
      const videoId = url.searchParams.get('v');
      if (videoId) return videoId;

      const channelMatch = url.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
      if (channelMatch?.[1]) return channelMatch[1];
    }
  } catch {
    // Fall back to direct channel/video ID usage.
  }

  const channelMatch = trimmed.match(/UC[a-zA-Z0-9_-]{22}/);
  return channelMatch?.[0] || trimmed;
};

export const normalizeRecommendedStreamId = (platform: RecommendedStreamPlatform, value: string) => {
  if (platform === 'kick') return normalizeKickIdentifier(value);
  if (platform === 'twitch') return normalizeTwitchIdentifier(value);
  return normalizeYouTubeIdentifier(value);
};

export const toRecommendedStream = (row: RecommendedStreamRow): RecommendedStream => {
  const id = normalizeRecommendedStreamId(row.platform, row.stream_id);

  return {
    chatIdentifier: normalizeText(row.chat_identifier),
    description: normalizeText(row.description) || 'Live recomendada pelo BizEye.',
    handle: normalizeText(row.handle),
    id,
    platform: row.platform,
    recommendationId: row.slug,
    thumbnail: normalizeText(row.thumbnail_url),
    title: row.title.trim() || id,
  };
};

const createSupabaseRecommendedStreamsStore = (client: SupabaseClient): RecommendedStreamsStore => ({
  listActiveRecommendedStreams: async (limit) => {
    const { data, error } = await client
      .from('recommended_streams')
      .select(recommendedStreamColumns)
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order('display_order', { ascending: true })
      .order('title', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to read recommended streams: ${error.message}`);
    }

    return (data || []) as unknown as RecommendedStreamRow[];
  },
});

const createPostgresRecommendedStreamsStore = (): RecommendedStreamsStore => {
  const pool = getPostgresPool();

  return {
    listActiveRecommendedStreams: async (limit) => {
      const result = await pool.query(
        `
          select ${recommendedStreamColumns}
          from public.recommended_streams
          where is_active = true
            and (starts_at is null or starts_at <= now())
            and (ends_at is null or ends_at > now())
          order by display_order asc, title asc
          limit $1
        `,
        [limit],
      );

      return result.rows as RecommendedStreamRow[];
    },
  };
};

export const createRecommendedStreamsStore = () => {
  if (getDatabaseDriver() === 'postgres') {
    return createPostgresRecommendedStreamsStore();
  }

  return createSupabaseRecommendedStreamsStore(createSupabaseAdminClient());
};

export const listRecommendedStreams = async (limit = 12) => {
  const store = createRecommendedStreamsStore();
  const rows = await store.listActiveRecommendedStreams(limit);

  return rows.map(toRecommendedStream);
};
