import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('stream chat routes', () => {
  beforeEach(() => {
    process.env.BIZEYE_FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.YOUTUBE_API_MODE = 'mock';
  });

  it('returns a generic merged chat snapshot for platform identifiers', async () => {
    const app = createApp();
    const response = await app.request('/stream/chat/merge', {
      body: JSON.stringify({
        maxResults: 1,
        sources: [
          { identifier: 'acfLive0001', platform: 'youtube', title: 'ACF' },
          { identifier: 'gaules', platform: 'kick', title: 'Gaules Kick' },
          { identifier: 'tonimec0001', platform: 'youtube', title: 'Tonimec' },
        ],
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.messages.map((message: { platform: string; id: string }) => `${message.platform}:${message.id}`)).toEqual([
      'youtube:acf-chat-001',
      'kick:kick-gaules-chat-001',
      'youtube:tonimec-chat-001',
    ]);
  });

  it('streams generic chat events through SSE for Vercel-compatible clients', async () => {
    const app = createApp();
    const sources = encodeURIComponent(JSON.stringify([
      { identifier: 'gaules', platform: 'kick', title: 'Gaules Kick' },
    ]));
    const response = await app.request(`/stream/chat/merge/stream?once=1&sources=${sources}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const body = await response.text();
    expect(body).toContain('event: stream-chat');
    expect(body).toContain('"type":"connected"');
    expect(body).toContain('"platform":"kick"');
    expect(body).toContain('kick-gaules-chat-001');
  });

  it('rejects invalid generic chat source payloads', async () => {
    const app = createApp();
    const response = await app.request('/stream/chat/merge', {
      body: JSON.stringify({
        sources: [{ identifier: '', platform: 'youtube' }],
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(400);
  });
});
