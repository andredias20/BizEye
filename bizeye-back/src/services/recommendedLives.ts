import type { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseDriver } from '../config/env.js';
import { getPostgresPool } from '../lib/postgres.js';
import { createSupabaseAdminClient } from '../lib/supabase.js';

export type RecommendedLivePlatform = 'youtube' | 'kick' | 'twitch';

export type RecommendedLiveRow = {
  chat_identifier: string | null;
  channel_id: string;
  created_at: string;
  created_by: string | null;
  description: string | null;
  display_name: string;
  enabled: boolean;
  id: string;
  platform: RecommendedLivePlatform;
  sort_order: number;
  thumbnail_url: string | null;
  updated_at: string;
  video_id: string | null;
};

export type AdminRecommendedLive = {
  chatIdentifier?: string;
  channelId: string;
  createdAt: string;
  createdBy?: string;
  description?: string;
  displayName: string;
  enabled: boolean;
  id: string;
  platform: RecommendedLivePlatform;
  sortOrder: number;
  thumbnailUrl?: string;
  updatedAt: string;
  videoId?: string;
};

export type PublicRecommendedLive = {
  chatIdentifier?: string;
  description: string;
  id: string;
  platform: RecommendedLivePlatform;
  thumbnail?: string;
  title: string;
  videoId?: string;
};

export type CreateRecommendedLiveInput = {
  chatIdentifier?: string;
  channelId: string;
  createdBy?: string;
  description?: string;
  displayName: string;
  enabled: boolean;
  platform: RecommendedLivePlatform;
  sortOrder: number;
  thumbnailUrl?: string;
  videoId?: string;
};

export type UpdateRecommendedLiveInput = Partial<Omit<CreateRecommendedLiveInput, 'createdBy'>>;

type RecommendedLivesStore = {
  create: (input: CreateRecommendedLiveInput) => Promise<RecommendedLiveRow>;
  delete: (id: string) => Promise<void>;
  listAll: () => Promise<RecommendedLiveRow[]>;
  listPublic: (limit: number) => Promise<RecommendedLiveRow[]>;
  reorder: (items: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  update: (id: string, input: UpdateRecommendedLiveInput) => Promise<RecommendedLiveRow>;
};

const recommendedLiveColumns = [
  'id',
  'platform',
  'channel_id',
  'chat_identifier',
  'video_id',
  'display_name',
  'description',
  'thumbnail_url',
  'enabled',
  'sort_order',
  'created_at',
  'updated_at',
  'created_by',
].join(', ');

const cleanOptional = (value: string | null | undefined) => value?.trim() || undefined;

export const toAdminRecommendedLive = (row: RecommendedLiveRow): AdminRecommendedLive => ({
  chatIdentifier: cleanOptional(row.chat_identifier),
  channelId: row.channel_id,
  createdAt: row.created_at,
  createdBy: row.created_by ?? undefined,
  description: cleanOptional(row.description),
  displayName: row.display_name,
  enabled: row.enabled,
  id: row.id,
  platform: row.platform ?? 'youtube',
  sortOrder: row.sort_order,
  thumbnailUrl: cleanOptional(row.thumbnail_url),
  updatedAt: row.updated_at,
  videoId: cleanOptional(row.video_id),
});

export const toPublicRecommendedLive = (row: RecommendedLiveRow): PublicRecommendedLive => ({
  chatIdentifier: cleanOptional(row.chat_identifier),
  description: cleanOptional(row.description) ?? 'Live recomendada pelo BizEye.',
  id: row.channel_id,
  platform: row.platform ?? 'youtube',
  thumbnail: cleanOptional(row.thumbnail_url),
  title: row.display_name,
  videoId: cleanOptional(row.video_id),
});

const createSupabaseRecommendedLivesStore = (client: SupabaseClient): RecommendedLivesStore => ({
  create: async (input) => {
    const { data, error } = await client
      .from('recommended_lives')
      .insert({
        chat_identifier: input.chatIdentifier || null,
        channel_id: input.channelId,
        created_by: input.createdBy ?? null,
        description: input.description ?? null,
        display_name: input.displayName,
        enabled: input.enabled,
        platform: input.platform,
        sort_order: input.sortOrder,
        thumbnail_url: input.thumbnailUrl ?? null,
        video_id: input.videoId || null,
      })
      .select(recommendedLiveColumns)
      .single();

    if (error) throw new Error(`Failed to create recommended live: ${error.message}`);
    return data as unknown as RecommendedLiveRow;
  },
  delete: async (id) => {
    const { error } = await client.from('recommended_lives').delete().eq('id', id);

    if (error) throw new Error(`Failed to delete recommended live: ${error.message}`);
  },
  listAll: async () => {
    const { data, error } = await client
      .from('recommended_lives')
      .select(recommendedLiveColumns)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true });

    if (error) throw new Error(`Failed to read recommended lives: ${error.message}`);
    return (data || []) as unknown as RecommendedLiveRow[];
  },
  listPublic: async (limit) => {
    const { data, error } = await client
      .from('recommended_lives')
      .select(recommendedLiveColumns)
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to read public recommended lives: ${error.message}`);
    return (data || []) as unknown as RecommendedLiveRow[];
  },
  reorder: async (items) => {
    for (const item of items) {
      const { error } = await client
        .from('recommended_lives')
        .update({ sort_order: item.sortOrder })
        .eq('id', item.id);

      if (error) throw new Error(`Failed to reorder recommended lives: ${error.message}`);
    }
  },
  update: async (id, input) => {
    const patch: Record<string, string | number | boolean | null> = {};

    if (input.chatIdentifier !== undefined) patch.chat_identifier = input.chatIdentifier || null;
    if (input.channelId !== undefined) patch.channel_id = input.channelId;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.displayName !== undefined) patch.display_name = input.displayName;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.platform !== undefined) patch.platform = input.platform;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
    if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl || null;
    if (input.videoId !== undefined) patch.video_id = input.videoId || null;

    const { data, error } = await client
      .from('recommended_lives')
      .update(patch)
      .eq('id', id)
      .select(recommendedLiveColumns)
      .single();

    if (error) throw new Error(`Failed to update recommended live: ${error.message}`);
    return data as unknown as RecommendedLiveRow;
  },
});

const createPostgresRecommendedLivesStore = (): RecommendedLivesStore => {
  const pool = getPostgresPool();

  return {
    create: async (input) => {
      const result = await pool.query(
        `
          insert into public.recommended_lives (
            platform,
            channel_id,
            chat_identifier,
            video_id,
            display_name,
            description,
            thumbnail_url,
            enabled,
            sort_order,
            created_by
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          returning ${recommendedLiveColumns}
        `,
        [
          input.platform,
          input.channelId,
          input.chatIdentifier || null,
          input.videoId || null,
          input.displayName,
          input.description ?? null,
          input.thumbnailUrl ?? null,
          input.enabled,
          input.sortOrder,
          input.createdBy ?? null,
        ],
      );

      return result.rows[0] as RecommendedLiveRow;
    },
    delete: async (id) => {
      await pool.query('delete from public.recommended_lives where id = $1', [id]);
    },
    listAll: async () => {
      const result = await pool.query(
        `
          select ${recommendedLiveColumns}
          from public.recommended_lives
          order by sort_order asc, display_name asc
        `,
      );

      return result.rows as RecommendedLiveRow[];
    },
    listPublic: async (limit) => {
      const result = await pool.query(
        `
          select ${recommendedLiveColumns}
          from public.recommended_lives
          where enabled = true
          order by sort_order asc, display_name asc
          limit $1
        `,
        [limit],
      );

      return result.rows as RecommendedLiveRow[];
    },
    reorder: async (items) => {
      const client = await pool.connect();

      try {
        await client.query('begin');
        for (const item of items) {
          await client.query('update public.recommended_lives set sort_order = $1 where id = $2', [
            item.sortOrder,
            item.id,
          ]);
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    update: async (id, input) => {
      const updates: string[] = [];
      const values: Array<string | number | boolean | null> = [];

      const addUpdate = (column: string, value: string | number | boolean | null) => {
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      };

      if (input.chatIdentifier !== undefined) addUpdate('chat_identifier', input.chatIdentifier || null);
      if (input.channelId !== undefined) addUpdate('channel_id', input.channelId);
      if (input.description !== undefined) addUpdate('description', input.description || null);
      if (input.displayName !== undefined) addUpdate('display_name', input.displayName);
      if (input.enabled !== undefined) addUpdate('enabled', input.enabled);
      if (input.platform !== undefined) addUpdate('platform', input.platform);
      if (input.sortOrder !== undefined) addUpdate('sort_order', input.sortOrder);
      if (input.thumbnailUrl !== undefined) addUpdate('thumbnail_url', input.thumbnailUrl || null);
      if (input.videoId !== undefined) addUpdate('video_id', input.videoId || null);

      values.push(id);

      const result = await pool.query(
        `
          update public.recommended_lives
          set ${updates.join(', ')}
          where id = $${values.length}
          returning ${recommendedLiveColumns}
        `,
        values,
      );

      if (!result.rows[0]) {
        throw new Error('Recommended live not found.');
      }

      return result.rows[0] as RecommendedLiveRow;
    },
  };
};

const createRecommendedLivesStore = () => {
  if (getDatabaseDriver() === 'postgres') {
    return createPostgresRecommendedLivesStore();
  }

  return createSupabaseRecommendedLivesStore(createSupabaseAdminClient());
};

export const listAdminRecommendedLives = async () => {
  const rows = await createRecommendedLivesStore().listAll();
  return rows.map(toAdminRecommendedLive);
};

export const listPublicRecommendedLives = async (limit: number) => {
  const rows = await createRecommendedLivesStore().listPublic(limit);
  return rows.map(toPublicRecommendedLive);
};

export const createRecommendedLive = async (input: CreateRecommendedLiveInput) => {
  const row = await createRecommendedLivesStore().create(input);
  return toAdminRecommendedLive(row);
};

export const updateRecommendedLive = async (id: string, input: UpdateRecommendedLiveInput) => {
  const row = await createRecommendedLivesStore().update(id, input);
  return toAdminRecommendedLive(row);
};

export const deleteRecommendedLive = async (id: string) => {
  await createRecommendedLivesStore().delete(id);
};

export const reorderRecommendedLives = async (items: Array<{ id: string; sortOrder: number }>) => {
  await createRecommendedLivesStore().reorder(items);
};
