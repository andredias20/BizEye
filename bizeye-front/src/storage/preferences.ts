import type { ChatPanelPosition, Platform, Stream, ViewLayoutMode, YouTubeQueueItem } from '../types';

const STREAMS_STORAGE_KEY = 'bizeye.streams.v1';
const WATCH_CHAT_POSITION_STORAGE_KEY = 'bizeye.watchChatPosition.v1';
const WATCH_LAYOUT_STORAGE_KEY = 'bizeye.watchLayout.v1';
const YOUTUBE_QUEUE_STORAGE_KEY = 'bizeye.youtubeQueue.v1';

const chatPanelPositions: ChatPanelPosition[] = ['left', 'right', 'bottom'];
const platforms: Platform[] = ['youtube', 'twitch', 'kick'];
const liveStatuses: Array<NonNullable<Stream['liveStatus']>> = ['live', 'offline', 'unknown', 'error', 'quota_limited'];
const layoutModes: ViewLayoutMode[] = ['balanced', 'max-horizontal', 'max-vertical', 'width-guided', 'height-guided'];

const canUseLocalStorage = () => {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const normalizeStream = (value: unknown): Stream | null => {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<Record<keyof Stream, unknown>>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const platform = candidate.platform;

    if (!id || typeof platform !== 'string' || !platforms.includes(platform as Platform)) {
        return null;
    }

    const title = typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : undefined;
    const chatIdentifier = typeof candidate.chatIdentifier === 'string' && candidate.chatIdentifier.trim()
        ? candidate.chatIdentifier.trim()
        : undefined;
    const videoId = typeof candidate.videoId === 'string' && candidate.videoId.trim()
        ? candidate.videoId.trim()
        : undefined;
    const liveStatus = typeof candidate.liveStatus === 'string' && liveStatuses.includes(candidate.liveStatus as NonNullable<Stream['liveStatus']>)
        ? candidate.liveStatus as NonNullable<Stream['liveStatus']>
        : undefined;

    return {
        chatIdentifier,
        id,
        liveStatus,
        platform: platform as Platform,
        title,
        videoId,
    };
};

const normalizeQueueItem = (value: unknown): YouTubeQueueItem | null => {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<Record<keyof YouTubeQueueItem, unknown>>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const title = typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : id;
    const url = typeof candidate.url === 'string' && candidate.url.trim()
        ? candidate.url.trim()
        : `https://www.youtube.com/watch?v=${id}`;

    if (!/^[a-zA-Z0-9_-]{11}$/.test(id) || !title) {
        return null;
    }

    const startSeconds = typeof candidate.startSeconds === 'number' && Number.isFinite(candidate.startSeconds)
        ? Math.max(0, Math.floor(candidate.startSeconds))
        : undefined;
    const durationSeconds = typeof candidate.durationSeconds === 'number' && Number.isFinite(candidate.durationSeconds)
        ? Math.max(0, Math.floor(candidate.durationSeconds))
        : undefined;
    const addedAt = typeof candidate.addedAt === 'string' && candidate.addedAt.trim()
        ? candidate.addedAt.trim()
        : new Date().toISOString();

    return {
        addedAt,
        channelTitle: typeof candidate.channelTitle === 'string' && candidate.channelTitle.trim()
            ? candidate.channelTitle.trim()
            : undefined,
        duration: typeof candidate.duration === 'string' && candidate.duration.trim()
            ? candidate.duration.trim()
            : undefined,
        durationSeconds,
        id,
        startSeconds,
        thumbnail: typeof candidate.thumbnail === 'string' && candidate.thumbnail.trim()
            ? candidate.thumbnail.trim()
            : undefined,
        title,
        url,
    };
};

const uniqueStreams = (streams: Stream[]) => {
    const seen = new Set<string>();

    return streams.filter((stream) => {
        const key = `${stream.platform}:${stream.id}`;
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
    });
};

const uniqueQueueItems = (items: YouTubeQueueItem[]) => {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key = `${item.id}:${item.startSeconds ?? 0}`;
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
    });
};

export const loadStoredStreams = () => {
    if (!canUseLocalStorage()) return null;

    try {
        const rawStreams = window.localStorage.getItem(STREAMS_STORAGE_KEY);
        if (rawStreams === null) return null;

        const parsed = JSON.parse(rawStreams) as unknown;
        if (!Array.isArray(parsed)) return null;

        return uniqueStreams(parsed.map(normalizeStream).filter((stream): stream is Stream => Boolean(stream)));
    } catch (error) {
        console.warn('Could not load BizEye streams from localStorage:', error);
        return null;
    }
};

export const mergeKnownStreamMetadata = (streams: Stream[], fixedStreams: Stream[]) => {
    const fixedByKey = new Map(fixedStreams.map((stream) => [`${stream.platform}:${stream.id}`, stream]));
    const merged = streams.map((stream) => {
        const fixed = fixedByKey.get(`${stream.platform}:${stream.id}`);
        if (!fixed) return stream;

        return {
            ...stream,
            chatIdentifier: fixed.chatIdentifier ?? stream.chatIdentifier,
            title: fixed.title,
        };
    });

    return uniqueStreams(merged);
};

export const saveStoredStreams = (streams: Stream[]) => {
    if (!canUseLocalStorage()) return;

    try {
        window.localStorage.setItem(STREAMS_STORAGE_KEY, JSON.stringify(uniqueStreams(streams)));
    } catch (error) {
        console.warn('Could not save BizEye streams to localStorage:', error);
    }
};

export const loadStoredWatchLayout = (fallback: ViewLayoutMode) => {
    if (!canUseLocalStorage()) return fallback;

    try {
        const rawLayout = window.localStorage.getItem(WATCH_LAYOUT_STORAGE_KEY);
        return layoutModes.includes(rawLayout as ViewLayoutMode) ? rawLayout as ViewLayoutMode : fallback;
    } catch (error) {
        console.warn('Could not load BizEye watch layout from localStorage:', error);
        return fallback;
    }
};

export const saveStoredWatchLayout = (layoutMode: ViewLayoutMode) => {
    if (!canUseLocalStorage()) return;

    try {
        window.localStorage.setItem(WATCH_LAYOUT_STORAGE_KEY, layoutMode);
    } catch (error) {
        console.warn('Could not save BizEye watch layout to localStorage:', error);
    }
};

export const loadStoredWatchChatPosition = (fallback: ChatPanelPosition) => {
    if (!canUseLocalStorage()) return fallback;

    try {
        const rawPosition = window.localStorage.getItem(WATCH_CHAT_POSITION_STORAGE_KEY);
        return chatPanelPositions.includes(rawPosition as ChatPanelPosition) ? rawPosition as ChatPanelPosition : fallback;
    } catch (error) {
        console.warn('Could not load BizEye watch chat position from localStorage:', error);
        return fallback;
    }
};

export const saveStoredWatchChatPosition = (position: ChatPanelPosition) => {
    if (!canUseLocalStorage()) return;

    try {
        window.localStorage.setItem(WATCH_CHAT_POSITION_STORAGE_KEY, position);
    } catch (error) {
        console.warn('Could not save BizEye watch chat position to localStorage:', error);
    }
};

export const loadStoredYoutubeQueue = () => {
    if (!canUseLocalStorage()) return [];

    try {
        const rawQueue = window.localStorage.getItem(YOUTUBE_QUEUE_STORAGE_KEY);
        if (rawQueue === null) return [];

        const parsed = JSON.parse(rawQueue) as unknown;
        if (!Array.isArray(parsed)) return [];

        return uniqueQueueItems(parsed.map(normalizeQueueItem).filter((item): item is YouTubeQueueItem => Boolean(item)));
    } catch (error) {
        console.warn('Could not load BizEye YouTube queue from localStorage:', error);
        return [];
    }
};

export const saveStoredYoutubeQueue = (items: YouTubeQueueItem[]) => {
    if (!canUseLocalStorage()) return;

    try {
        window.localStorage.setItem(YOUTUBE_QUEUE_STORAGE_KEY, JSON.stringify(uniqueQueueItems(items)));
    } catch (error) {
        console.warn('Could not save BizEye YouTube queue to localStorage:', error);
    }
};
