import { describe, expect, it } from 'vitest';
import {
  toAdminRecommendedLive,
  toPublicRecommendedLive,
  type RecommendedLiveRow,
} from './recommendedLives.js';

const baseRow: RecommendedLiveRow = {
  chat_identifier: null,
  channel_id: 'UCvgSmIdI92W4KnP15fJwfwA',
  created_at: '2026-06-19T00:00:00.000Z',
  created_by: null,
  description: null,
  display_name: 'ACF',
  enabled: true,
  id: 'b9dc42e6-2fc3-4c02-8d76-98d9e9776a72',
  platform: 'youtube',
  sort_order: 10,
  thumbnail_url: null,
  updated_at: '2026-06-19T00:00:00.000Z',
  video_id: null,
};

describe('recommendedLives', () => {
  it('maps existing YouTube rows with the public recommendation contract', () => {
    expect(toPublicRecommendedLive(baseRow)).toEqual({
      chatIdentifier: undefined,
      description: 'Live recomendada pelo BizEye.',
      id: 'UCvgSmIdI92W4KnP15fJwfwA',
      platform: 'youtube',
      thumbnail: undefined,
      title: 'ACF',
      videoId: undefined,
    });
  });

  it('preserves non-YouTube platform identifiers and chat hints', () => {
    const row: RecommendedLiveRow = {
      ...baseRow,
      chat_identifier: 'channel:caseoh_',
      channel_id: 'caseoh_',
      display_name: 'CaseOh',
      platform: 'twitch',
    };

    expect(toAdminRecommendedLive(row)).toMatchObject({
      chatIdentifier: 'channel:caseoh_',
      channelId: 'caseoh_',
      displayName: 'CaseOh',
      platform: 'twitch',
    });
    expect(toPublicRecommendedLive(row)).toMatchObject({
      chatIdentifier: 'channel:caseoh_',
      id: 'caseoh_',
      platform: 'twitch',
      title: 'CaseOh',
    });
  });
});
