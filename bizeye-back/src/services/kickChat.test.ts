import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchKickChatSnapshot } from './kickChat.js';

const clearKickEnv = () => {
  delete process.env.KICK_ACCEPT_LANGUAGE;
  delete process.env.KICK_CHAT_MODE;
  delete process.env.KICK_SEC_CH_UA;
  delete process.env.KICK_SEC_CH_UA_MOBILE;
  delete process.env.KICK_SEC_CH_UA_PLATFORM;
  delete process.env.KICK_USER_AGENT;
};

describe('kickChat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearKickEnv();
  });

  it('uses browser navigation headers for public Kick channel lookup', async () => {
    process.env.KICK_CHAT_MODE = 'live';

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ chatroom: { id: 12345 }, user: { username: 'tonimek' } }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchKickChatSnapshot({ identifier: 'tonimek', platform: 'kick' }, 1);

    expect(snapshot.source.status).toBe('live');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://kick.com/api/v2/channels/tonimek');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      accept: expect.stringContaining('text/html'),
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'user-agent': expect.stringContaining('Chrome/149.0.0.0'),
    });
  });

  it('uses configurable non-sensitive Kick browser headers', async () => {
    process.env.KICK_ACCEPT_LANGUAGE = 'pt-BR,pt;q=0.9';
    process.env.KICK_CHAT_MODE = 'live';
    process.env.KICK_SEC_CH_UA = '"Chromium";v="149", "Not)A;Brand";v="24"';
    process.env.KICK_SEC_CH_UA_PLATFORM = '"Windows"';
    process.env.KICK_USER_AGENT = 'Mozilla/5.0 Custom Chrome/149.0.0.0 Safari/537.36';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: { account: { user: { username: 'tonimek' } } } }), {
        headers: { 'content-type': 'application/json' },
        status: input.toString().includes('kick.com/api/v2/channels') ? 403 : 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchKickChatSnapshot({ identifier: 'tonimek', platform: 'kick' }, 1);

    expect(snapshot.source.error).toBe('kick_chatroom_lookup_blocked_403');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.kick.com/private/v1/channels/tonimek');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      accept: 'application/json,text/plain,*/*',
      'accept-language': 'pt-BR,pt;q=0.9',
      origin: 'https://kick.com',
      referer: 'https://kick.com/',
      'sec-ch-ua': '"Chromium";v="149", "Not)A;Brand";v="24"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 Custom Chrome/149.0.0.0 Safari/537.36',
    });
  });

  it('uses a frontend-provided chatroom identifier without public Kick lookup', async () => {
    process.env.KICK_CHAT_MODE = 'live';

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await fetchKickChatSnapshot(
      {
        chatIdentifier: 'chatroom:12345',
        identifier: 'tonimek',
        platform: 'kick',
        title: 'tonimek',
      },
      1,
    );

    expect(snapshot.source).toMatchObject({
      identifier: 'tonimek',
      platform: 'kick',
      status: 'live',
      title: 'tonimek',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
