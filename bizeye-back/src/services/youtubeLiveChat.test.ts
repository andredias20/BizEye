import { beforeEach, describe, expect, it } from 'vitest';
import { fetchMergedYouTubeLiveChat, resolveActiveLiveChat } from './youtubeLiveChat.js';

const ACF_VIDEO_ID = 'acfLive0001';
const TONIMEC_VIDEO_ID = 'tonimec0001';

describe('youtubeLiveChat', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_MODE = 'mock';
  });

  it('resolves the active live chat id from a YouTube video id', async () => {
    const source = await resolveActiveLiveChat(ACF_VIDEO_ID);

    expect(source).toMatchObject({
      liveChatId: `chat-${ACF_VIDEO_ID}`,
      status: 'live',
      videoId: ACF_VIDEO_ID,
    });
  });

  it('merges chat messages from multiple live videos by published time', async () => {
    const batch = await fetchMergedYouTubeLiveChat({
      maxResults: 10,
      sources: [{ videoId: ACF_VIDEO_ID }, { videoId: TONIMEC_VIDEO_ID }],
    });

    expect(batch.sources).toHaveLength(2);
    expect(batch.sources.every((source) => source.status === 'live')).toBe(true);
    expect(batch.messages.map((message) => message.id)).toEqual([
      'acf-chat-001',
      'tonimec-chat-001',
      'acf-chat-002',
      'tonimec-chat-002',
      'acf-chat-003',
      'tonimec-chat-003',
    ]);
  });

  it('can continue from per-video page tokens without resolving chat ids again', async () => {
    const firstBatch = await fetchMergedYouTubeLiveChat({
      maxResults: 1,
      sources: [{ videoId: ACF_VIDEO_ID }, { videoId: TONIMEC_VIDEO_ID }],
    });

    const secondBatch = await fetchMergedYouTubeLiveChat({
      maxResults: 1,
      sources: firstBatch.sources.map((source) => ({
        liveChatId: source.liveChatId,
        pageToken: source.nextPageToken,
        title: source.title,
        videoId: source.videoId,
      })),
    });

    expect(firstBatch.messages.map((message) => message.id)).toEqual(['acf-chat-001', 'tonimec-chat-001']);
    expect(secondBatch.messages.map((message) => message.id)).toEqual(['acf-chat-002', 'tonimec-chat-002']);
  });
});
