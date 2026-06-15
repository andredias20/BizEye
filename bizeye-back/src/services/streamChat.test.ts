import { beforeEach, describe, expect, it } from 'vitest';
import { fetchStreamChatSnapshot, StreamChatQueue } from './streamChat.js';

describe('streamChat', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_MODE = 'mock';
  });

  it('accepts generic stream sources and normalizes YouTube chat messages', async () => {
    const snapshot = await fetchStreamChatSnapshot({
      maxResults: 1,
      sources: [
        { identifier: 'acfLive0001', platform: 'youtube', title: 'ACF' },
        { identifier: 'gaules', platform: 'kick', title: 'Gaules Kick' },
        { identifier: 'tonimec0001', platform: 'youtube', title: 'Tonimec' },
        { identifier: 'gaules', platform: 'twitch', title: 'Gaules Twitch' },
      ],
    });

    expect(snapshot.sources.map((source) => `${source.platform}:${source.status}`)).toEqual([
      'youtube:live',
      'kick:live',
      'youtube:live',
      'twitch:live',
    ]);
    expect(snapshot.messages.map((message) => `${message.platform}:${message.id}`)).toEqual([
      'youtube:acf-chat-001',
      'kick:kick-gaules-chat-001',
      'youtube:tonimec-chat-001',
      'twitch:twitch-gaules-chat-001',
    ]);
  });

  it('adds machine receive ordering without fixed platform priority', () => {
    const queue = new StreamChatQueue();
    const first = queue.enqueue({
      authorName: 'First',
      id: 'same-time-1',
      identifier: 'acfLive0001',
      message: 'first message',
      platform: 'youtube',
      publishedAt: '2026-06-14T21:00:00Z',
    });
    const second = queue.enqueue({
      authorName: 'Second',
      id: 'same-time-2',
      identifier: 'gaules',
      message: 'second message',
      platform: 'twitch',
      publishedAt: '2026-06-14T21:00:00Z',
    });

    expect(first?.sequence).toBe(1);
    expect(second?.sequence).toBe(2);
    expect(Date.parse(second?.receivedAt ?? '')).toBeGreaterThan(Date.parse(first?.receivedAt ?? ''));
    expect(first?.publishedAt).not.toBe('2026-06-14T21:00:00.000Z');
  });
});
