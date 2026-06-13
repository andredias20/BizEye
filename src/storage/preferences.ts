import { STREAM_QUALITY_OPTIONS } from '../types';
import type { Platform, Stream, StreamQuality, ViewLayoutMode } from '../types';

const STREAMS_STORAGE_KEY = 'bizeye.streams.v1';
const WATCH_LAYOUT_STORAGE_KEY = 'bizeye.watchLayout.v1';
const STREAM_QUALITY_STORAGE_KEY = 'bizeye.streamQuality.v1';

const platforms: Platform[] = ['youtube', 'twitch', 'kick'];
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

    return {
        id,
        platform: platform as Platform,
        title,
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

export const loadStoredStreams = (fallback: Stream[]) => {
    if (!canUseLocalStorage()) return fallback;

    try {
        const rawStreams = window.localStorage.getItem(STREAMS_STORAGE_KEY);
        if (rawStreams === null) return fallback;

        const parsed = JSON.parse(rawStreams) as unknown;
        if (!Array.isArray(parsed)) return fallback;

        return uniqueStreams(parsed.map(normalizeStream).filter((stream): stream is Stream => Boolean(stream)));
    } catch (error) {
        console.warn('Could not load BizEye streams from localStorage:', error);
        return fallback;
    }
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

export const loadStoredStreamQuality = (fallback: StreamQuality) => {
    if (!canUseLocalStorage()) return fallback;

    try {
        const rawQuality = window.localStorage.getItem(STREAM_QUALITY_STORAGE_KEY);
        return STREAM_QUALITY_OPTIONS.includes(rawQuality as StreamQuality)
            ? rawQuality as StreamQuality
            : fallback;
    } catch (error) {
        console.warn('Could not load BizEye stream quality from localStorage:', error);
        return fallback;
    }
};

export const saveStoredStreamQuality = (streamQuality: StreamQuality) => {
    if (!canUseLocalStorage()) return;

    try {
        window.localStorage.setItem(STREAM_QUALITY_STORAGE_KEY, streamQuality);
    } catch (error) {
        console.warn('Could not save BizEye stream quality to localStorage:', error);
    }
};
