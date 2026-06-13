import { z } from 'zod';

const requiredServerEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  YOUTUBE_API_KEY: z.string().min(1),
});

const youtubeEnvSchema = z.object({
  YOUTUBE_API_KEY: z.string().min(1),
});

const optionalServerEnvSchema = z.object({
  BIZEYE_FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().default('bizeye_admin_session'),
  CRON_SECRET: z.string().optional(),
});

export type RequiredServerEnv = z.infer<typeof requiredServerEnvSchema>;
export type YouTubeEnv = z.infer<typeof youtubeEnvSchema>;

export const getOptionalServerEnv = () => optionalServerEnvSchema.parse(process.env);

export const requireServerEnv = (): RequiredServerEnv => requiredServerEnvSchema.parse(process.env);

export const requireYouTubeEnv = (): YouTubeEnv => youtubeEnvSchema.parse(process.env);

export const getConfigStatus = () => {
  const parsed = requiredServerEnvSchema.safeParse(process.env);

  return {
    ready: parsed.success,
    missing: parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean),
  };
};

