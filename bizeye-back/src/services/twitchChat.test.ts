import { afterEach, describe, expect, it } from 'vitest';
import { fetchTwitchChatSnapshot, parseTwitchIrcLine, toTwitchMessageDraft } from './twitchChat.js';

const clearTwitchEnv = () => {
  delete process.env.TWITCH_CHAT_MODE;
};

describe('twitchChat', () => {
  afterEach(() => {
    clearTwitchEnv();
  });

  it('returns deterministic Twitch chat fixtures in mock mode', async () => {
    process.env.TWITCH_CHAT_MODE = 'mock';

    const snapshot = await fetchTwitchChatSnapshot({ identifier: 'gaules', platform: 'twitch', title: 'Gaules' }, 1);

    expect(snapshot.source).toMatchObject({
      identifier: 'gaules',
      platform: 'twitch',
      status: 'live',
      title: 'Gaules',
    });
    expect(snapshot.messages.map((message) => `${message.platform}:${message.id}`)).toEqual([
      'twitch:twitch-gaules-chat-001',
    ]);
  });

  it('parses tagged Twitch IRC PRIVMSG lines into stream chat messages', () => {
    const ircMessage = parseTwitchIrcLine(
      '@badge-info=;badges=broadcaster/1,subscriber/12;color=#9146FF;display-name=Streamer;id=abc-123;mod=0;subscriber=1;tmi-sent-ts=1781467200123;user-id=42 :streamer!streamer@streamer.tmi.twitch.tv PRIVMSG #gaules :ola chat',
    );

    expect(ircMessage).not.toBeNull();

    const draft = toTwitchMessageDraft(
      { identifier: 'gaules', platform: 'twitch', title: 'Gaules' },
      ircMessage!,
    );

    expect(draft).toMatchObject({
      authorChannelId: '42',
      authorName: 'Streamer',
      id: 'abc-123',
      isOwner: true,
      isSponsor: true,
      message: 'ola chat',
      platform: 'twitch',
      publishedAt: '2026-06-14T20:00:00.123Z',
      sourceTitle: 'Gaules',
      type: 'privmsg',
    });
  });

  it('uses a frontend-provided channel chat identifier in mock lookup', async () => {
    process.env.TWITCH_CHAT_MODE = 'mock';

    const snapshot = await fetchTwitchChatSnapshot(
      {
        chatIdentifier: 'channel:gaules',
        identifier: 'gaules-alt',
        platform: 'twitch',
        title: 'Gaules Twitch',
      },
      1,
    );

    expect(snapshot.source.status).toBe('live');
    expect(snapshot.messages[0]?.identifier).toBe('gaules-alt');
  });
});
