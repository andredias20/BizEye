import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { getOptionalServerEnv } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { internalRoutes } from './routes/internal.js';
import { streamRoutes } from './routes/stream.js';
import { youtubeRoutes } from './routes/youtube.js';

const parseAllowedOrigins = (value: string) => {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const createApp = () => {
  const app = new Hono();
  const requestIdMiddleware = requestId();
  const secureHeadersMiddleware = secureHeaders();
  const loggerMiddleware = logger();
  const corsMiddleware = cors({
    credentials: true,
    origin: (origin) => {
      const { BIZEYE_FRONTEND_ORIGIN } = getOptionalServerEnv();
      const allowedOrigins = parseAllowedOrigins(BIZEYE_FRONTEND_ORIGIN);
      const fallbackOrigin = allowedOrigins[0] ?? '';

      if (!origin) {
        return fallbackOrigin;
      }

      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      return '';
    },
  });

  const isWebSocketRoute = (path: string) => path === '/stream/chat/merge/ws';

  app.use('*', (c, next) => (isWebSocketRoute(c.req.path) ? next() : requestIdMiddleware(c, next)));
  app.use('*', (c, next) => (isWebSocketRoute(c.req.path) ? next() : secureHeadersMiddleware(c, next)));
  app.use('*', (c, next) => (isWebSocketRoute(c.req.path) ? next() : loggerMiddleware(c, next)));
  app.use('*', (c, next) => (isWebSocketRoute(c.req.path) ? next() : corsMiddleware(c, next)));

  app.get('/', (c) => {
    return c.json({
      service: 'bizeye-back',
      status: 'ok',
    });
  });

  app.route('/', healthRoutes);
  app.route('/internal', internalRoutes);
  app.route('/stream', streamRoutes);
  app.route('/youtube', youtubeRoutes);

  return app;
};

const app = createApp();

export default app;
