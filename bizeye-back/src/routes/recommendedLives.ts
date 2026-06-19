import { Hono } from 'hono';
import { z } from 'zod';
import { listPublicRecommendedLives } from '../services/recommendedLives.js';

export const recommendedLiveRoutes = new Hono();

const recommendedLivesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

recommendedLiveRoutes.get('/', async (c) => {
  const parsed = recommendedLivesQuerySchema.safeParse({
    limit: c.req.query('limit'),
  });

  if (!parsed.success) {
    return c.json({ error: 'invalid_recommended_lives_query' }, 400);
  }

  try {
    const items = await listPublicRecommendedLives(parsed.data.limit);

    c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
    c.header('CDN-Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    c.header('Vercel-CDN-Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    return c.json({
      generatedAt: new Date().toISOString(),
      items,
    });
  } catch (error) {
    console.error('Failed to list public recommended lives.', error);
    return c.json({ error: 'recommended_lives_failed' }, 502);
  }
});
