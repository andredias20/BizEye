import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getOptionalServerEnv } from '../config/env.js';
import { getAdminBySessionToken, type AdminUser } from '../services/adminAuth.js';

export type AdminVariables = {
  admin: AdminUser;
};

export const requireAdmin: MiddlewareHandler<{ Variables: AdminVariables }> = async (c, next) => {
  const { SESSION_COOKIE_NAME } = getOptionalServerEnv();
  const token = getCookie(c, SESSION_COOKIE_NAME);
  const admin = await getAdminBySessionToken(token);

  if (!admin) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  c.set('admin', admin);
  await next();
};
