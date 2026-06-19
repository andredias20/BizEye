import { Hono } from 'hono';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { getOptionalServerEnv } from '../config/env.js';
import { requireAdmin, type AdminVariables } from '../middleware/requireAdmin.js';
import { authenticateAdmin, createAdminSession, revokeAdminSession } from '../services/adminAuth.js';
import {
  createRecommendedLive,
  deleteRecommendedLive,
  listAdminRecommendedLives,
  reorderRecommendedLives,
  updateRecommendedLive,
} from '../services/recommendedLives.js';

export const adminRoutes = new Hono<{ Variables: AdminVariables }>();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const platformSchema = z.enum(['youtube', 'kick', 'twitch']);
const youtubeChannelIdPattern = /^UC[a-zA-Z0-9_-]{22}$/;
const channelIdSchema = z.string().trim().min(1).max(200);
const videoIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/).or(z.literal(''));

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const recommendedLiveSchemaShape = {
  chatIdentifier: z.string().trim().max(200).optional(),
  channelId: channelIdSchema,
  description: z.string().trim().max(500).optional(),
  displayName: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
  thumbnailUrl: z.string().trim().url().or(z.literal('')).optional(),
  videoId: videoIdSchema.optional(),
};

const recommendedLiveCreateSchema = z.object({
  ...recommendedLiveSchemaShape,
  enabled: z.boolean().default(true),
  platform: platformSchema.default('youtube'),
  sortOrder: z.number().int().min(0).max(100_000).default(100),
}).superRefine((value, ctx) => {
  if (value.platform === 'youtube' && !youtubeChannelIdPattern.test(value.channelId)) {
    ctx.addIssue({
      code: 'custom',
      message: 'invalid_youtube_channel_id',
      path: ['channelId'],
    });
  }
});

const recommendedLivePatchSchema = z.object({
  ...recommendedLiveSchemaShape,
  platform: platformSchema.optional(),
})
  .partial()
  .refine((value) => Object.keys(value).length > 0)
  .superRefine((value, ctx) => {
    if (value.channelId !== undefined && (value.platform ?? 'youtube') === 'youtube' && !youtubeChannelIdPattern.test(value.channelId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'invalid_youtube_channel_id',
        path: ['channelId'],
      });
    }
  });

const recommendedLiveReorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0).max(100_000),
    }),
  ).min(1).max(100),
});

const getClientIp = (c: Context) => {
  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown';
};

const consumeLoginAttempt = (key: string) => {
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }

  if (current.count >= LOGIN_MAX_ATTEMPTS) {
    return false;
  }

  current.count += 1;
  return true;
};

const consumeLoginAttempts = (keys: string[]) => {
  const allowed = keys.every((key) => {
    const current = loginAttempts.get(key);
    return !current || current.resetAt <= Date.now() || current.count < LOGIN_MAX_ATTEMPTS;
  });

  if (!allowed) return false;

  keys.forEach(consumeLoginAttempt);
  return true;
};

const clearLoginAttempts = (key: string) => {
  loginAttempts.delete(key);
};

const getCookieMaxAge = (expiresAt: Date) => Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

const runAdminAction = async <T>(action: () => Promise<T>, error: string) => {
  try {
    return { data: await action() };
  } catch (cause) {
    console.error(error, cause);
    return { error };
  }
};

adminRoutes.post('/auth/login', async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_request' }, 400);
  }

  const ipAddress = getClientIp(c);
  const email = parsed.data.email.toLowerCase();
  const ipRateLimitKey = `ip:${ipAddress}`;
  const emailRateLimitKey = `ip-email:${ipAddress}:${email}`;

  if (!consumeLoginAttempts([ipRateLimitKey, emailRateLimitKey])) {
    return c.json({ error: 'too_many_attempts' }, 429);
  }

  const admin = await authenticateAdmin(email, parsed.data.password);
  if (!admin) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  clearLoginAttempts(ipRateLimitKey);
  clearLoginAttempts(emailRateLimitKey);

  const { ADMIN_COOKIE_SECURE, SESSION_COOKIE_NAME } = getOptionalServerEnv();
  const session = await createAdminSession(admin.id, c.req.header('user-agent'), ipAddress);

  setCookie(c, SESSION_COOKIE_NAME, session.token, {
    expires: session.expiresAt,
    httpOnly: true,
    maxAge: getCookieMaxAge(session.expiresAt),
    path: '/',
    sameSite: 'Lax',
    secure: ADMIN_COOKIE_SECURE,
  });

  return c.json({ admin });
});

adminRoutes.use('*', requireAdmin);

adminRoutes.post('/auth/logout', async (c) => {
  const { ADMIN_COOKIE_SECURE, SESSION_COOKIE_NAME } = getOptionalServerEnv();
  await revokeAdminSession(getCookie(c, SESSION_COOKIE_NAME));

  deleteCookie(c, SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: ADMIN_COOKIE_SECURE,
  });

  return c.json({ ok: true });
});

adminRoutes.get('/auth/me', (c) => {
  return c.json({ admin: c.get('admin') });
});

adminRoutes.get('/recommended-lives', async (c) => {
  const result = await runAdminAction(listAdminRecommendedLives, 'Failed to list admin recommended lives.');
  if (result.error) return c.json({ error: 'admin_recommended_lives_failed' }, 500);

  return c.json({ items: result.data });
});

adminRoutes.post('/recommended-lives', async (c) => {
  const parsed = recommendedLiveCreateSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_recommended_live' }, 400);
  }

  const result = await runAdminAction(
    () => createRecommendedLive({ ...parsed.data, createdBy: c.get('admin').id }),
    'Failed to create admin recommended live.',
  );
  if (result.error) return c.json({ error: 'admin_recommended_live_create_failed' }, 500);

  return c.json({ item: result.data }, 201);
});

adminRoutes.patch('/recommended-lives/:id', async (c) => {
  const params = uuidParamSchema.safeParse({ id: c.req.param('id') });
  const parsed = recommendedLivePatchSchema.safeParse(await c.req.json().catch(() => null));

  if (!params.success || !parsed.success) {
    return c.json({ error: 'invalid_recommended_live' }, 400);
  }

  const result = await runAdminAction(
    () => updateRecommendedLive(params.data.id, parsed.data),
    'Failed to update admin recommended live.',
  );
  if (result.error) return c.json({ error: 'admin_recommended_live_update_failed' }, 500);

  return c.json({ item: result.data });
});

adminRoutes.delete('/recommended-lives/:id', async (c) => {
  const params = uuidParamSchema.safeParse({ id: c.req.param('id') });

  if (!params.success) {
    return c.json({ error: 'invalid_recommended_live_id' }, 400);
  }

  const result = await runAdminAction(
    () => deleteRecommendedLive(params.data.id),
    'Failed to delete admin recommended live.',
  );
  if (result.error) return c.json({ error: 'admin_recommended_live_delete_failed' }, 500);

  return c.json({ ok: true });
});

adminRoutes.post('/recommended-lives/reorder', async (c) => {
  const parsed = recommendedLiveReorderSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_recommended_live_order' }, 400);
  }

  const result = await runAdminAction(
    () => reorderRecommendedLives(parsed.data.items),
    'Failed to reorder admin recommended lives.',
  );
  if (result.error) return c.json({ error: 'admin_recommended_live_reorder_failed' }, 500);

  return c.json({ ok: true });
});
