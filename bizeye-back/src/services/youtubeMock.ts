import type { YouTubeRequestOptions } from './youtube.js';

type MockChannel = {
  channelId: string;
  chatMessages: MockChatMessage[];
  description: string;
  handle: string;
  liveTitle: string;
  thumbnail: string;
  title: string;
  videoId: string;
};

type MockChatMessage = {
  authorName: string;
  id: string;
  message: string;
  publishedAt: string;
};

const mockChannels: MockChannel[] = [
  {
    channelId: 'UCvgSmIdI92W4KnP15fJwfwA',
    chatMessages: [
      {
        authorName: 'Ana ACF',
        id: 'acf-chat-001',
        message: 'ACF abriu a live.',
        publishedAt: '2026-06-14T21:00:00.000Z',
      },
      {
        authorName: 'Bruno ACF',
        id: 'acf-chat-002',
        message: 'Audio e video ok por aqui.',
        publishedAt: '2026-06-14T21:00:04.000Z',
      },
      {
        authorName: 'Carla ACF',
        id: 'acf-chat-003',
        message: 'Entrando no monitoramento.',
        publishedAt: '2026-06-14T21:00:09.000Z',
      },
    ],
    description: 'Canal ACF usado como fixture local do BizEye.',
    handle: '@acf',
    liveTitle: 'ACF - live fixture local',
    thumbnail: 'https://i.ytimg.com/vi/acfLive0001/mqdefault.jpg',
    title: 'ACF',
    videoId: 'acfLive0001',
  },
  {
    channelId: 'UCwRM1SXROyxSSJqrOTQzILw',
    chatMessages: [
      {
        authorName: 'Toni Viewer',
        id: 'tonimec-chat-001',
        message: 'Tonimec tambem esta ao vivo.',
        publishedAt: '2026-06-14T21:00:02.000Z',
      },
      {
        authorName: 'Mec Ops',
        id: 'tonimec-chat-002',
        message: 'Teste de chat paralelo.',
        publishedAt: '2026-06-14T21:00:06.000Z',
      },
      {
        authorName: 'Nina Mec',
        id: 'tonimec-chat-003',
        message: 'Mensagem chegando pelo segundo card.',
        publishedAt: '2026-06-14T21:00:11.000Z',
      },
    ],
    description: 'Canal Tonimec usado como fixture local do BizEye.',
    handle: '@tonimec',
    liveTitle: 'Tonimec - live fixture local',
    thumbnail: 'https://i.ytimg.com/vi/tonimec0001/mqdefault.jpg',
    title: 'Tonimec',
    videoId: 'tonimec0001',
  },
  {
    channelId: 'UCP9uupJdJnpOEJzTtigLPOg',
    chatMessages: [
      {
        authorName: 'Edu Viewer',
        id: 'eebrasil-chat-001',
        message: 'EEBrasil fixture online.',
        publishedAt: '2026-06-14T21:00:03.000Z',
      },
      {
        authorName: 'Monitor EEB',
        id: 'eebrasil-chat-002',
        message: 'Chat sendo consumido pelo backend.',
        publishedAt: '2026-06-14T21:00:08.000Z',
      },
    ],
    description: 'Canal EEBrasil usado como fixture local do BizEye.',
    handle: '@enriedu',
    liveTitle: 'EEBrasil - live fixture local',
    thumbnail: 'https://i.ytimg.com/vi/eebrasil001/mqdefault.jpg',
    title: 'EEBrasil',
    videoId: 'eebrasil001',
  },
  {
    channelId: 'UCZiYbVptd3PVPf4f6eR6UaQ',
    chatMessages: [
      {
        authorName: 'Caze Viewer',
        id: 'cazetv-chat-001',
        message: 'CazeTV fixture no ar.',
        publishedAt: '2026-06-14T21:00:05.000Z',
      },
    ],
    description: 'Canal CazeTV usado como fixture local do BizEye.',
    handle: '@CazeTV',
    liveTitle: 'CazeTV - live fixture local',
    thumbnail: 'https://i.ytimg.com/vi/cazetv00001/mqdefault.jpg',
    title: 'CazeTV',
    videoId: 'cazetv00001',
  },
];

const normalizeQuery = (value: unknown) => String(value ?? '').trim().toLowerCase();

const findChannel = (value: unknown) => {
  const query = normalizeQuery(value).replace(/^https?:\/\/(www\.)?youtube\.com\//, '');

  return mockChannels.find((channel) =>
    [
      channel.channelId.toLowerCase(),
      channel.handle.toLowerCase(),
      channel.handle.slice(1).toLowerCase(),
      channel.title.toLowerCase(),
    ].includes(query),
  );
};

const findChannelByVideoId = (value: unknown) => {
  const videoId = normalizeQuery(value);

  return mockChannels.find((channel) => channel.videoId.toLowerCase() === videoId);
};

const findChannelByChatId = (value: unknown) => {
  const liveChatId = normalizeQuery(value);

  return mockChannels.find((channel) => `chat-${channel.videoId}`.toLowerCase() === liveChatId);
};

const findChannels = (value: unknown) => {
  const query = normalizeQuery(value).replace(/^@/, '');
  if (!query) return mockChannels;

  return mockChannels.filter((channel) =>
    [channel.channelId, channel.handle, channel.title, channel.description]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
};

const channelSearchItem = (channel: MockChannel) => ({
  id: {
    channelId: channel.channelId,
  },
  snippet: {
    description: channel.description,
    thumbnails: {
      medium: {
        url: channel.thumbnail,
      },
    },
    title: channel.title,
  },
});

const liveSearchItem = (channel: MockChannel) => ({
  id: {
    videoId: channel.videoId,
  },
  snippet: {
    title: channel.liveTitle,
  },
});

export const getMockYouTubeResponse = <T>({ path, params }: YouTubeRequestOptions): T => {
  if (path === '/channels') {
    const channel = findChannel(params.forHandle) ?? findChannel(params.id);

    return {
      items: channel
        ? [
            {
              id: channel.channelId,
              snippet: {
                title: channel.title,
              },
            },
          ]
        : [],
    } as T;
  }

  if (path === '/search' && params.type === 'channel') {
    const maxResults = Number(params.maxResults ?? 6);

    return {
      items: findChannels(params.q).slice(0, maxResults).map(channelSearchItem),
    } as T;
  }

  if (path === '/search' && params.type === 'video' && params.eventType === 'live') {
    const channel = findChannel(params.channelId);

    return {
      items: channel ? [liveSearchItem(channel)] : [],
    } as T;
  }

  if (path === '/videos') {
    const ids = String(params.id ?? '').split(',');
    const items = mockChannels
      .filter((channel) => ids.includes(channel.videoId))
      .map((channel) => ({
        id: channel.videoId,
        liveStreamingDetails: {
          activeLiveChatId: `chat-${channel.videoId}`,
          actualStartTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
        snippet: {
          channelId: channel.channelId,
          liveBroadcastContent: 'live',
          title: channel.liveTitle,
        },
        status: {
          embeddable: true,
        },
      }));

    return { items } as T;
  }

  if (path === '/liveChat/messages') {
    const channel = findChannelByChatId(params.liveChatId) ?? findChannelByVideoId(params.liveChatId);
    const offset = Number(String(params.pageToken ?? '0').replace(/^mock:/, ''));
    const maxResults = Math.max(1, Number(params.maxResults ?? 200));
    const messages = channel?.chatMessages ?? [];
    const page = messages.slice(Number.isFinite(offset) ? offset : 0, (Number.isFinite(offset) ? offset : 0) + maxResults);
    const nextOffset = (Number.isFinite(offset) ? offset : 0) + page.length;

    return {
      items: page.map((message) => ({
        authorDetails: {
          channelId: `mock-author-${message.authorName.toLowerCase().replace(/\W+/g, '-')}`,
          displayName: message.authorName,
          isChatModerator: false,
          isChatOwner: false,
          isChatSponsor: false,
          profileImageUrl: 'https://i.ytimg.com/vi/mock-avatar/default.jpg',
        },
        id: message.id,
        snippet: {
          displayMessage: message.message,
          publishedAt: message.publishedAt,
          textMessageDetails: {
            messageText: message.message,
          },
          type: 'textMessageEvent',
        },
      })),
      nextPageToken: nextOffset < messages.length ? `mock:${nextOffset}` : `mock:${messages.length}`,
      pollingIntervalMillis: 500,
    } as T;
  }

  return { items: [] } as T;
};
