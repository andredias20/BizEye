import { describe, expect, it } from 'vitest';
import {
  normalizeRecommendedStreamId,
  toRecommendedStream,
  type RecommendedStreamRow,
} from './recommendedStreams.js';

describe('recommendedStreams', () => {
  it('normalizes simple platform URLs before returning player ids', () => {
    expect(normalizeRecommendedStreamId('kick', 'https://kick.com/gaules?clip=abc')).toBe('gaules');
    expect(normalizeRecommendedStreamId('twitch', 'https://www.twitch.tv/popout/caseoh_/chat')).toBe('caseoh_');
    expect(normalizeRecommendedStreamId('youtube', 'https://www.youtube.com/watch?v=acfLive0001')).toBe('acfLive0001');
    expect(normalizeRecommendedStreamId('youtube', 'https://www.youtube.com/channel/UCvgSmIdI92W4KnP15fJwfwA')).toBe(
      'UCvgSmIdI92W4KnP15fJwfwA',
    );
  });

  it('maps database rows to the frontend recommendation contract', () => {
    const row: RecommendedStreamRow = {
      chat_identifier: 'channel:caseoh_',
      description: ' ',
      display_order: 10,
      handle: '@caseoh_',
      platform: 'twitch',
      slug: 'caseoh',
      stream_id: 'https://www.twitch.tv/caseoh_',
      thumbnail_url: null,
      title: 'CaseOh',
    };

    expect(toRecommendedStream(row)).toEqual({
      chatIdentifier: 'channel:caseoh_',
      description: 'Live recomendada pelo BizEye.',
      handle: '@caseoh_',
      id: 'caseoh_',
      platform: 'twitch',
      recommendationId: 'caseoh',
      thumbnail: undefined,
      title: 'CaseOh',
    });
  });
});
