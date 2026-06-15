import { upgradeWebSocket } from '@hono/node-server';
import { Hono } from 'hono';
import { z } from 'zod';
import { createStreamChatSession, fetchStreamChatSnapshot, type StreamChatServerEvent } from '../services/streamChat.js';

export const streamRoutes = new Hono();

const streamPlatformSchema = z.enum(['kick', 'twitch', 'youtube']);

const streamChatSourceSchema = z.object({
  identifier: z.string().trim().min(1),
  platform: streamPlatformSchema,
  title: z.string().trim().min(1).optional(),
});

const streamChatPayloadSchema = z.object({
  maxResults: z.number().int().min(1).max(2000).optional(),
  sources: z.array(streamChatSourceSchema).min(1).max(12),
});

type StreamChatPayload = z.infer<typeof streamChatPayloadSchema>;

const parseMessagePayload = (value: unknown) => {
  if (typeof value !== 'string') {
    return streamChatPayloadSchema.safeParse(null);
  }

  try {
    const data = JSON.parse(value) as unknown;

    if (data && typeof data === 'object' && 'type' in data) {
      const candidate = data as { payload?: unknown; type?: unknown };
      if (candidate.type === 'subscribe') {
        return streamChatPayloadSchema.safeParse(candidate.payload);
      }
    }

    return streamChatPayloadSchema.safeParse(data);
  } catch {
    return streamChatPayloadSchema.safeParse(null);
  }
};

const serialize = (value: unknown) => JSON.stringify(value);

const parseQueryPayload = (sourcesValue: string | undefined, maxResultsValue: string | undefined) => {
  if (!sourcesValue) return streamChatPayloadSchema.safeParse(null);

  try {
    return streamChatPayloadSchema.safeParse({
      maxResults: maxResultsValue ? Number(maxResultsValue) : undefined,
      sources: JSON.parse(sourcesValue) as unknown,
    });
  } catch {
    return streamChatPayloadSchema.safeParse(null);
  }
};

const encodeSseEvent = (event: StreamChatServerEvent) => {
  return `event: stream-chat\ndata: ${serialize(event)}\n\n`;
};

streamRoutes.post('/chat/merge', async (c) => {
  const parsed = streamChatPayloadSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json({ error: 'invalid_stream_chat_payload' }, 400);
  }

  try {
    return c.json(await fetchStreamChatSnapshot(parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected stream chat error';
    return c.json({ error: 'stream_chat_merge_failed', message }, 502);
  }
});

streamRoutes.get('/chat/merge/stream', (c) => {
  const parsed = parseQueryPayload(c.req.query('sources'), c.req.query('maxResults'));

  if (!parsed.success) {
    return c.json({ error: 'invalid_stream_chat_payload' }, 400);
  }

  const encoder = new TextEncoder();
  const once = c.req.query('once') === '1';
  let session: ReturnType<typeof createStreamChatSession> | null = null;
  let isClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      isClosed = true;
      session?.stop();
    },
    start(controller) {
      const close = () => {
        if (isClosed) return;
        isClosed = true;
        session?.stop();
        controller.close();
      };

      session = createStreamChatSession(parsed.data, (event) => {
        if (isClosed) return;

        controller.enqueue(encoder.encode(encodeSseEvent(event)));

        if (once && (event.type === 'chat-message' || event.type === 'error')) {
          queueMicrotask(close);
        }
      });

      session.start();
    },
  });

  c.header('content-type', 'text/event-stream; charset=utf-8');
  c.header('cache-control', 'no-cache, no-transform');
  c.header('connection', 'keep-alive');

  return c.body(stream);
});

streamRoutes.get(
  '/chat/merge/ws',
  upgradeWebSocket(() => {
    let stopSession: (() => void) | null = null;
    let hasSubscription = false;

    const startSession = (payload: StreamChatPayload, send: (value: string) => void) => {
      stopSession?.();

      const session = createStreamChatSession(payload, (event) => {
        send(serialize(event));
      });

      stopSession = session.stop;
      hasSubscription = true;
      session.start();
    };

    return {
      onClose() {
        stopSession?.();
      },
      onError(_event, ws) {
        ws.send(
          serialize({
            message: 'stream_chat_socket_error',
            sessionId: 'unknown',
            type: 'error',
          }),
        );
      },
      onMessage(event, ws) {
        const parsed = parseMessagePayload(event.data);

        if (!parsed.success) {
          ws.send(
            serialize({
              message: 'invalid_stream_chat_payload',
              sessionId: 'unknown',
              type: 'error',
            }),
          );
          return;
        }

        startSession(parsed.data, (value) => ws.send(value));
      },
      onOpen(_event, ws) {
        ws.send(
          serialize({
            message: 'send_subscribe_payload',
            sessionId: 'pending',
            type: 'ready',
          }),
        );

        setTimeout(() => {
          if (!hasSubscription) {
            ws.send(
              serialize({
                message: 'subscription_payload_not_received',
                sessionId: 'pending',
                type: 'error',
              }),
            );
          }
        }, 15_000);
      },
    };
  }),
);
