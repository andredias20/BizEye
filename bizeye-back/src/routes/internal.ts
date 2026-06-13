import { Hono } from 'hono';
import { getOptionalServerEnv } from '../config/env';

export const internalRoutes = new Hono();

internalRoutes.get('/cron/live-check', (c) => {
  const { CRON_SECRET } = getOptionalServerEnv();
  const authHeader = c.req.header('authorization');

  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return c.json({
    ok: true,
    task: 'live-check',
    status: 'not_implemented',
  });
});

