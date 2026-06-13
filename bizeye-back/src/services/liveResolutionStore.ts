import type { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseDriver } from '../config/env.js';
import { getPostgresPool } from '../lib/postgres.js';
import { createSupabaseAdminClient } from '../lib/supabase.js';

export type LiveResolutionStatus = 'live' | 'offline' | 'unknown' | 'quota_limited' | 'error';
export type LiveResolutionSource = 'cache' | 'youtube' | 'stale_cache' | 'unknown';

export type LiveResolutionRow = {
  channel_id: string;
  video_id: string | null;
  status: LiveResolutionStatus;
  source: LiveResolutionSource;
  checked_at: string | null;
  expires_at: string | null;
  next_discovery_at: string | null;
  last_error: string | null;
};

export type LiveResolutionPayload = {
  channel_id: string;
  video_id: string | null;
  status: LiveResolutionStatus;
  source: LiveResolutionSource;
  checked_at: string;
  expires_at: string;
  next_discovery_at: string;
  last_error: string | null;
  failure_count?: number;
  last_live_at?: string;
};

export type LiveResolutionStore = {
  ensureChannel: (channelId: string, title?: string) => Promise<void>;
  readCachedResolution: (channelId: string) => Promise<LiveResolutionRow | null>;
  upsertResolution: (payload: LiveResolutionPayload) => Promise<void>;
};

const normalizeTimestamp = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
};

const normalizeLiveResolutionRow = (row: Record<string, unknown>): LiveResolutionRow => ({
  channel_id: String(row.channel_id),
  checked_at: normalizeTimestamp(row.checked_at),
  expires_at: normalizeTimestamp(row.expires_at),
  last_error: typeof row.last_error === 'string' ? row.last_error : null,
  next_discovery_at: normalizeTimestamp(row.next_discovery_at),
  source: row.source as LiveResolutionSource,
  status: row.status as LiveResolutionStatus,
  video_id: typeof row.video_id === 'string' ? row.video_id : null,
});

const createSupabaseLiveResolutionStore = (client: SupabaseClient): LiveResolutionStore => ({
  ensureChannel: async (channelId, title) => {
    const payload: Record<string, string> = { channel_id: channelId };
    if (title) payload.title = title;

    const { error } = await client.from('youtube_channels').upsert(payload, {
      onConflict: 'channel_id',
    });

    if (error) {
      throw new Error(`Failed to cache YouTube channel ${channelId}: ${error.message}`);
    }
  },

  readCachedResolution: async (channelId) => {
    const { data, error } = await client
      .from('youtube_live_resolutions')
      .select('channel_id, video_id, status, source, checked_at, expires_at, next_discovery_at, last_error')
      .eq('channel_id', channelId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read live cache for ${channelId}: ${error.message}`);
    }

    return data ? normalizeLiveResolutionRow(data as Record<string, unknown>) : null;
  },

  upsertResolution: async (payload) => {
    const supabasePayload: Record<string, unknown> = {
      channel_id: payload.channel_id,
      checked_at: payload.checked_at,
      expires_at: payload.expires_at,
      last_error: payload.last_error,
      next_discovery_at: payload.next_discovery_at,
      source: payload.source,
      status: payload.status,
      video_id: payload.video_id,
    };

    if (payload.failure_count !== undefined) {
      supabasePayload.failure_count = payload.failure_count;
    }

    if (payload.last_live_at !== undefined) {
      supabasePayload.last_live_at = payload.last_live_at;
    }

    const { error } = await client.from('youtube_live_resolutions').upsert(supabasePayload, {
      onConflict: 'channel_id',
    });

    if (error) {
      throw new Error(`Failed to cache live resolution for ${payload.channel_id}: ${error.message}`);
    }
  },
});

const createPostgresLiveResolutionStore = (): LiveResolutionStore => {
  const pool = getPostgresPool();

  return {
    ensureChannel: async (channelId, title) => {
      await pool.query(
        `
          insert into public.youtube_channels (channel_id, title)
          values ($1, $2)
          on conflict (channel_id) do update
          set
            title = coalesce(excluded.title, youtube_channels.title),
            updated_at = now()
        `,
        [channelId, title ?? null],
      );
    },

    readCachedResolution: async (channelId) => {
      const result = await pool.query(
        `
          select channel_id, video_id, status, source, checked_at, expires_at, next_discovery_at, last_error
          from public.youtube_live_resolutions
          where channel_id = $1
          limit 1
        `,
        [channelId],
      );

      return result.rows[0] ? normalizeLiveResolutionRow(result.rows[0]) : null;
    },

    upsertResolution: async (payload) => {
      await pool.query(
        `
          insert into public.youtube_live_resolutions (
            channel_id,
            video_id,
            status,
            source,
            checked_at,
            expires_at,
            next_discovery_at,
            last_error,
            failure_count,
            last_live_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::integer, 0), $10)
          on conflict (channel_id) do update
          set
            video_id = excluded.video_id,
            status = excluded.status,
            source = excluded.source,
            checked_at = excluded.checked_at,
            expires_at = excluded.expires_at,
            next_discovery_at = excluded.next_discovery_at,
            last_error = excluded.last_error,
            failure_count = case
              when $9::integer is null then youtube_live_resolutions.failure_count
              else excluded.failure_count
            end,
            last_live_at = coalesce(excluded.last_live_at, youtube_live_resolutions.last_live_at),
            updated_at = now()
        `,
        [
          payload.channel_id,
          payload.video_id,
          payload.status,
          payload.source,
          payload.checked_at,
          payload.expires_at,
          payload.next_discovery_at,
          payload.last_error,
          payload.failure_count ?? null,
          payload.last_live_at ?? null,
        ],
      );
    },
  };
};

export const createLiveResolutionStore = () => {
  if (getDatabaseDriver() === 'postgres') {
    return createPostgresLiveResolutionStore();
  }

  return createSupabaseLiveResolutionStore(createSupabaseAdminClient());
};
