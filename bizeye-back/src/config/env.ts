import { z } from 'zod';

const databaseDriverSchema = z.enum(['supabase', 'postgres']).default('supabase');
const youtubeApiModeSchema = z.enum(['live', 'mock']).default('live');

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

const optionalServerEnvSchema = z.object({
  BIZEYE_DB_DRIVER: databaseDriverSchema,
  BIZEYE_FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().default('bizeye_admin_session'),
  CRON_SECRET: z.string().optional(),
  YOUTUBE_API_MODE: youtubeApiModeSchema,
});

export type DatabaseDriver = z.infer<typeof databaseDriverSchema>;
export type PostgresEnv = z.infer<typeof postgresEnvSchema>;
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type YouTubeApiMode = z.infer<typeof youtubeApiModeSchema>;
export type YouTubeEnv = z.infer<typeof youtubeEnvSchema>;

export const getOptionalServerEnv = () => optionalServerEnvSchema.parse(process.env);

export const getDatabaseDriver = (): DatabaseDriver => getOptionalServerEnv().BIZEYE_DB_DRIVER;

export const getYouTubeApiMode = (): YouTubeApiMode => getOptionalServerEnv().YOUTUBE_API_MODE;

export const requirePostgresEnv = (): PostgresEnv => postgresEnvSchema.parse(process.env);

export const requireSupabaseEnv = (): SupabaseEnv => supabaseEnvSchema.parse(process.env);

export const requireYouTubeEnv = (): YouTubeEnv => youtubeEnvSchema.parse(process.env);

export const getConfigStatus = () => {
  const { BIZEYE_DB_DRIVER, YOUTUBE_API_MODE } = getOptionalServerEnv();
  const requiredParsers = [
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
