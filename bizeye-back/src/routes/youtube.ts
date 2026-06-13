import { Hono } from 'hono';

export const youtubeRoutes = new Hono();

youtubeRoutes.get('/channels/search', (c) => {
  return c.json(
    {
      error: 'not_implemented',
      next: 'Implement cached YouTube channel search backed by Supabase Postgres.',
    },
    501,
  );
});

youtubeRoutes.post('/channels/resolve', (c) => {
  return c.json(
    {
      error: 'not_implemented',
      next: 'Implement YouTube URL, handle, and channel ID resolution.',
    },
    501,
  );
});

youtubeRoutes.get('/channels/:channelId/live', (c) => {
  return c.json(
    {
      error: 'not_implemented',
      channelId: c.req.param('channelId'),
      next: 'Implement channelId to live videoId cache lookup.',
    },
    501,
  );
});

