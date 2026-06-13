import { Hono } from 'hono';
import { getConfigStatus } from '../config/env';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) => {
  return c.json({
    service: 'bizeye-back',
    status: 'ok',
  });
});

healthRoutes.get('/ready', (c) => {
  const status = getConfigStatus();

  return c.json(
    {
      service: 'bizeye-back',
      ...status,
    },
    status.ready ? 200 : 503,
  );
});

