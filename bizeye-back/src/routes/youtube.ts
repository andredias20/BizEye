import { Hono } from 'hono';
import { z } from 'zod';
import {
  recordObservedLiveVideo,
  resolveCachedLiveStatuses,
  resolveLiveForChannel,
} from '../services/youtubeLiveResolver.js';
import { fetchYouTubeJson } from '../services/youtube.js';

export const youtubeRoutes = new Hono();

type YouTubeChannelSearchResponse = {
  items?: Array<{
    id?: {
      channelId?: string;
    };
    snippet?: {
      title?: string;
      description?: string;
      thumbnails?: {
        medium?: {
          url?: string;
        };
      };
    };
  }>;
};

type YouTubeChannelListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
    };
  }>;
};

const resolveInputSchema = z.object({
  input: z.string().trim().min(1),
});

const liveStatusSchema = z.object({
  channelIds: z.array(z.string().trim().regex(/^UC[a-zA-Z0-9_-]{22}$/)).max(25),
});

const liveObservationSchema = z.object({
  videoId: z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/),
});

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Unexpected YouTube resolver error';
};

const extractDirectYoutubeId = (input: string) => {
  if (input.includes('youtube.com/watch') || input.includes('youtu.be/')) {
    try {
      const url = new URL(input.includes('http') ? input : `https://${input}`);

      if (url.hostname.includes('youtu.be')) {
        const id = url.pathname.slice(1);
        return id ? { id, title: id } : null;
      }

      const videoId = url.searchParams.get('v');
      if (videoId) return { id: videoId, title: videoId };
    } catch {
      return null;
    }
  }

  const ucMatch = input.match(/UC[a-zA-Z0-9_-]{22}/);
  if (ucMatch) return { id: ucMatch[0], title: ucMatch[0] };

  return null;
};

const extractYoutubeHandle = (input: string) => {
  let handle = '';

  if (input.includes('youtube.com/')) {
    try {
      const url = new URL(input.includes('http') ? input : `https://${input}`);
      const pathParts = url.pathname
        .split('/')
        .filter((part) => !['c', 'user', 'channel'].includes(part) && part !== '');
      handle = pathParts[0] || '';
    } catch {
      handle = input.split('/').pop() || '';
    }
  } else {
    handle = input;
  }

  if (handle && !handle.startsWith('@') && !handle.startsWith('UC')) {
    handle = `@${handle}`;
  }

  return handle;
};

youtubeRoutes.get('/channels/search', async (c) => {
  const query = c.req.query('q')?.trim();
  const maxResults = Math.min(Number(c.req.query('maxResults') || 6), 10);

  if (!query) {
    return c.json({ error: 'missing_query' }, 400);
  }

  try {
    const data = await fetchYouTubeJson<YouTubeChannelSearchResponse>({
      path: '/search',
      params: {
        part: 'snippet',
        maxResults,
        q: query,
        type: 'channel',
      },
    });

    const items =
      data.items
        ?.map((item) => {
          const id = item.id?.channelId;
          if (!id) return null;

          return {
            id,
            title: item.snippet?.title || id,
            description: item.snippet?.description || 'Canal do YouTube',
            thumbnail: item.snippet?.thumbnails?.medium?.url,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)) || [];

    return c.json({ items });
  } catch (error) {
    return c.json({ error: 'youtube_search_failed', message: getErrorMessage(error) }, 502);
  }
});

youtubeRoutes.post('/channels/resolve', async (c) => {
  const parsed = resolveInputSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_input' }, 400);
  }

  const cleanInput = parsed.data.input;
  const direct = extractDirectYoutubeId(cleanInput);
  if (direct) return c.json(direct);

  const handle = extractYoutubeHandle(cleanInput);
  if (!handle) {
    return c.json({ error: 'invalid_youtube_handle' }, 400);
  }

  try {
    const handleData = await fetchYouTubeJson<YouTubeChannelListResponse>({
      path: '/channels',
      params: {
        part: 'id,snippet',
        forHandle: handle,
      },
    });

    const channel = handleData.items?.[0];
    if (channel?.id) {
      return c.json({
        id: channel.id,
        title: channel.snippet?.title || handle,
      });
    }

    const searchData = await fetchYouTubeJson<YouTubeChannelSearchResponse>({
      path: '/search',
      params: {
        part: 'snippet',
        maxResults: 1,
        q: handle,
        type: 'channel',
      },
    });

    const searchResult = searchData.items?.[0];
    const channelId = searchResult?.id?.channelId;

    if (channelId) {
      return c.json({
        id: channelId,
        title: searchResult.snippet?.title || handle,
      });
    }

    return c.json({ error: 'channel_not_found' }, 404);
  } catch (error) {
    return c.json({ error: 'youtube_resolve_failed', message: getErrorMessage(error) }, 502);
  }
});

youtubeRoutes.post('/channels/live-status', async (c) => {
  const parsed = liveStatusSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_channel_ids' }, 400);
  }

  try {
    const items = await resolveCachedLiveStatuses(parsed.data.channelIds);
    return c.json({ items });
  } catch (error) {
    return c.json({ error: 'youtube_live_status_failed', message: getErrorMessage(error) }, 502);
  }
});

youtubeRoutes.get('/channels/:channelId/live', async (c) => {
  const channelId = c.req.param('channelId');

  try {
    return c.json(await resolveLiveForChannel(channelId));
  } catch (error) {
    return c.json({ error: 'youtube_live_lookup_failed', message: getErrorMessage(error) }, 502);
  }
});

youtubeRoutes.post('/channels/:channelId/live', async (c) => {
  const channelId = c.req.param('channelId');
  const parsed = liveObservationSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_video_id' }, 400);
  }

  try {
    return c.json(await recordObservedLiveVideo(channelId, parsed.data.videoId));
  } catch (error) {
    return c.json({ error: 'youtube_live_observation_failed', message: getErrorMessage(error) }, 502);
  }
});
