import { z } from 'zod';

const databaseDriverSchema = z.enum(['supabase', 'postgres']).default('supabase');
const kickChatModeSchema = z.enum(['live', 'mock']).optional();
const twitchChatModeSchema = z.enum(['live', 'mock']).optional();
const youtubeApiModeSchema = z.enum(['live', 'mock']).default('live');
const booleanStringSchema = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const postgresEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

const youtubeEnvSchema = z.object({
  YOUTUBE_API_KEY: z.string().min(1),
});

const adminEnvSchema = z.object({
  ADMIN_SESSION_SECRET: z.string().min(32),
});

const adminBootstrapEnvSchema = z.object({
  ADMIN_BOOTSTRAP_EMAIL: z.string().email(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12),
});

const optionalServerEnvSchema = z.object({
  ADMIN_COOKIE_SECURE: booleanStringSchema,
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
  BIZEYE_DB_DRIVER: databaseDriverSchema,
  BIZEYE_FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().default('bizeye_admin_session'),
  CRON_SECRET: z.string().optional(),
  KICK_CHAT_MODE: kickChatModeSchema,
  TWITCH_CHAT_MODE: twitchChatModeSchema,
  YOUTUBE_API_MODE: youtubeApiModeSchema,
});

export type DatabaseDriver = z.infer<typeof databaseDriverSchema>;
export type AdminBootstrapEnv = z.infer<typeof adminBootstrapEnvSchema>;
export type AdminEnv = z.infer<typeof adminEnvSchema>;
export type KickChatMode = NonNullable<z.infer<typeof kickChatModeSchema>>;
export type PostgresEnv = z.infer<typeof postgresEnvSchema>;
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type TwitchChatMode = NonNullable<z.infer<typeof twitchChatModeSchema>>;
export type YouTubeApiMode = z.infer<typeof youtubeApiModeSchema>;
export type YouTubeEnv = z.infer<typeof youtubeEnvSchema>;

export const getOptionalServerEnv = () => optionalServerEnvSchema.parse(process.env);

export const getDatabaseDriver = (): DatabaseDriver => getOptionalServerEnv().BIZEYE_DB_DRIVER;

export const getKickChatMode = (): KickChatMode => getOptionalServerEnv().KICK_CHAT_MODE ?? getYouTubeApiMode();

export const getTwitchChatMode = (): TwitchChatMode => getOptionalServerEnv().TWITCH_CHAT_MODE ?? getYouTubeApiMode();

export const getYouTubeApiMode = (): YouTubeApiMode => getOptionalServerEnv().YOUTUBE_API_MODE;

export const requirePostgresEnv = (): PostgresEnv => postgresEnvSchema.parse(process.env);

export const requireAdminEnv = (): AdminEnv => adminEnvSchema.parse(process.env);

export const getAdminBootstrapEnv = (): AdminBootstrapEnv | null => {
  const parsed = adminBootstrapEnvSchema.safeParse(process.env);
  return parsed.success ? parsed.data : null;
};

export const requireSupabaseEnv = (): SupabaseEnv => supabaseEnvSchema.parse(process.env);

export const requireYouTubeEnv = (): YouTubeEnv => youtubeEnvSchema.parse(process.env);

export const getConfigStatus = () => {
  const { BIZEYE_DB_DRIVER, YOUTUBE_API_MODE } = getOptionalServerEnv();
  const requiredParsers = [
    adminEnvSchema.safeParse(process.env),
    adminBootstrapEnvSchema.safeParse(process.env),
    BIZEYE_DB_DRIVER === 'postgres'
      ? postgresEnvSchema.safeParse(process.env)
      : supabaseEnvSchema.safeParse(process.env),
    YOUTUBE_API_MODE === 'live' ? youtubeEnvSchema.safeParse(process.env) : null,
  ];

  const missing = requiredParsers.flatMap((parsed) =>
    !parsed || parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean),
  );

  return {
    databaseDriver: BIZEYE_DB_DRIVER,
    missing,
    ready: missing.length === 0,
    youtubeApiMode: YOUTUBE_API_MODE,
  };
};
