import type { YouTubeRequestOptions } from './youtube.js';

type MockChannel = {
  channelId: string;
  description: string;
  handle: string;
  liveTitle: string;
  thumbnail: string;
  title: string;
  videoId: string;
};

const mockChannels: MockChannel[] = [
  {
    channelId: 'UCvgSmIdI92W4KnP15fJwfwA',
    description: 'Canal ACF usado como fixture local do BizEye.',
    handle: '@acf',
    liveTitle: 'ACF - live fixture local',
    thumbnail: 'https://i.ytimg.com/vi/acfLive0001/mqdefault.jpg',
    title: 'ACF',
    videoId: 'acfLive0001',
  },
  {
    channelId: 'UCwRM1SXROyxSSJqrOTQzILw',
    description: 'Canal Tonimec usado como fixture local do BizEye.',
    handle: '@tonimec',
    liveTitle: 'Tonimec - live fixture local',
    thumbnail: 'https://i.ytimg.com/vi/tonimec0001/mqdefault.jpg',
    title: 'Tonimec',
    videoId: 'tonimec0001',
  },
  {
    channelId: 'UCP9uupJdJnpOEJzTtigLPOg',
    description: 'Canal EEBrasil usado como fixture local do BizEye.',
    handle: '@enriedu',
    liveTitle: 'EEBrasil - live fixture local',
    thumbnail: 'https://i.ytimg.com/vi/eebrasil001/mqdefault.jpg',
    title: 'EEBrasil',
    videoId: 'eebrasil001',
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
          actualStartTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        },
        snippet: {
          liveBroadcastContent: 'live',
          title: channel.liveTitle,
        },
        status: {
          embeddable: true,
        },
      }));

    return { items } as T;
  }

  return { items: [] } as T;
};
