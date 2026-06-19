import { Hono } from 'hono';
import { z } from 'zod';
import { listRecommendedStreams } from '../services/recommendedStreams.js';

export const recommendedStreamRoutes = new Hono();

const recommendedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected recommended streams error';
};

recommendedStreamRoutes.get('/recommended', async (c) => {
  const parsed = recommendedQuerySchema.safeParse({
    limit: c.req.query('limit'),
  });

  if (!parsed.success) {
    return c.json({ error: 'invalid_recommended_streams_query' }, 400);
  }

  try {
    const items = await listRecommendedStreams(parsed.data.limit);

    c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    c.header('CDN-Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    c.header('Vercel-CDN-Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    return c.json({
      generatedAt: new Date().toISOString(),
      items,
    });
  } catch (error) {
    return c.json({ error: 'recommended_streams_failed', message: getErrorMessage(error) }, 502);
  }
});
