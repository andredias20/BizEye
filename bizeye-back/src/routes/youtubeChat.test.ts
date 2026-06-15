import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const ACF_VIDEO_ID = 'acfLive0001';
const TONIMEC_VIDEO_ID = 'tonimec0001';

describe('youtube chat routes', () => {
  beforeEach(() => {
    process.env.BIZEYE_FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.YOUTUBE_API_MODE = 'mock';
  });

  it('returns a merged chat batch for multiple YouTube video ids', async () => {
    const app = createApp();
    const response = await app.request('/youtube/chats/merge', {
      body: JSON.stringify({
        maxResults: 10,
        videoIds: [ACF_VIDEO_ID, TONIMEC_VIDEO_ID],
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.messages.map((message: { id: string }) => message.id)).toEqual([
      'acf-chat-001',
      'tonimec-chat-001',
      'acf-chat-002',
      'tonimec-chat-002',
      'acf-chat-003',
      'tonimec-chat-003',
    ]);
    expect(data.sources).toHaveLength(2);
  });

  it('streams a single SSE chat batch for frontend EventSource tests', async () => {
    const app = createApp();
    const response = await app.request(
      `/youtube/chats/merge/stream?videoIds=${ACF_VIDEO_ID},${TONIMEC_VIDEO_ID}&maxResults=1&once=1`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const text = await response.text();
    expect(text).toContain('event: chat-batch');
    expect(text).toContain('acf-chat-001');
    expect(text).toContain('tonimec-chat-001');
  });

  it('rejects invalid stream video ids', async () => {
    const app = createApp();
    const response = await app.request('/youtube/chats/merge/stream?videoIds=invalid-video-id-too-long');

    expect(response.status).toBe(400);
  });
});
