import { Hono } from 'hono';
import { z } from 'zod';
import {
  recordObservedLiveVideo,
  resolveLiveStatuses,
  resolveLiveForChannel,
} from '../services/youtubeLiveResolver.js';
import {
  fetchMergedYouTubeLiveChat,
  getMergedChatNextPollMs,
  type YouTubeChatSourceInput,
} from '../services/youtubeLiveChat.js';
import { fetchYouTubeJson } from '../services/youtube.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const youtubeRoutes = new Hono();
youtubeRoutes.use('/channels/search', requireAdmin);
youtubeRoutes.use('/channels/resolve', requireAdmin);

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

const chatSourceSchema = z.object({
  liveChatId: z.string().trim().min(1).optional(),
  pageToken: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  videoId: z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/),
});

const chatMergeSchema = z
  .object({
    maxResults: z.number().int().min(1).max(2000).optional(),
    sources: z.array(chatSourceSchema).min(1).max(6).optional(),
    videoIds: z.array(z.string().trim().regex(/^[a-zA-Z0-9_-]{11}$/)).min(1).max(6).optional(),
  })
  .refine((value) => Boolean(value.sources?.length || value.videoIds?.length));

const streamQuerySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(2000).optional(),
  once: z
    .string()
    .optional()
    .transform((value) => value === '1' || value === 'true'),
  pollMs: z.coerce.number().int().min(500).max(30_000).optional(),
  videoIds: z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(z.string().regex(/^[a-zA-Z0-9_-]{11}$/)).min(1).max(6)),
});

const toChatSources = (input: z.infer<typeof chatMergeSchema>): YouTubeChatSourceInput[] => {
  return input.sources ?? input.videoIds?.map((videoId) => ({ videoId })) ?? [];
};

const encodeSse = (event: string, data: unknown) => {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
};

const waitFor = async (milliseconds: number, signal: AbortSignal) => {
  if (signal.aborted) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
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
    console.error('YouTube channel search failed.', error);
    return c.json({ error: 'youtube_search_failed' }, 502);
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
    console.error('YouTube channel resolve failed.', error);
    return c.json({ error: 'youtube_resolve_failed' }, 502);
  }
});

youtubeRoutes.post('/channels/live-status', async (c) => {
  const parsed = liveStatusSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_channel_ids' }, 400);
  }

  try {
    const items = await resolveLiveStatuses(parsed.data.channelIds);
    return c.json({ items });
  } catch (error) {
    console.error('YouTube live status failed.', error);
    return c.json({ error: 'youtube_live_status_failed' }, 502);
  }
});

youtubeRoutes.post('/chats/merge', async (c) => {
  const parsed = chatMergeSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_chat_merge_input' }, 400);
  }

  try {
    const batch = await fetchMergedYouTubeLiveChat({
      maxResults: parsed.data.maxResults,
      sources: toChatSources(parsed.data),
    });

    return c.json(batch);
  } catch (error) {
    console.error('YouTube chat merge failed.', error);
    return c.json({ error: 'youtube_chat_merge_failed' }, 502);
  }
});

youtubeRoutes.get('/chats/merge/stream', (c) => {
  const parsed = streamQuerySchema.safeParse({
    maxResults: c.req.query('maxResults'),
    once: c.req.query('once'),
    pollMs: c.req.query('pollMs'),
    videoIds: c.req.query('videoIds'),
  });

  if (!parsed.success) {
    return c.json({ error: 'invalid_chat_stream_query' }, 400);
  }

  const encoder = new TextEncoder();
  const signal = c.req.raw.signal;
  let sources: YouTubeChatSourceInput[] = parsed.data.videoIds.map((videoId) => ({ videoId }));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (!signal.aborted) {
          const batch = await fetchMergedYouTubeLiveChat({
            maxResults: parsed.data.maxResults,
            sources,
          });

          controller.enqueue(encoder.encode(encodeSse('chat-batch', batch)));

          sources = batch.sources.map((source) => ({
            liveChatId: source.liveChatId,
            pageToken: source.nextPageToken,
            title: source.title,
            videoId: source.videoId,
          }));

          if (parsed.data.once) break;

          await waitFor(parsed.data.pollMs ?? getMergedChatNextPollMs(batch), signal);
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            encodeSse('chat-error', {
              error: 'youtube_chat_stream_failed',
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8',
      'x-accel-buffering': 'no',
    },
  });
});

youtubeRoutes.get('/channels/:channelId/live', async (c) => {
  const channelId = c.req.param('channelId');

  try {
    return c.json(await resolveLiveForChannel(channelId));
  } catch (error) {
    console.error('YouTube live lookup failed.', error);
    return c.json({ error: 'youtube_live_lookup_failed', message: 'Live lookup unavailable.' }, 502);
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
    console.error('YouTube live observation failed.', error);
    return c.json({ error: 'youtube_live_observation_failed', message: 'Live observation unavailable.' }, 502);
  }
});
