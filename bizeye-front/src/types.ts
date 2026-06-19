export type Platform = 'youtube' | 'twitch' | 'kick';

export type PlaybackProfile = 'firetv' | 'standard';

export type ChatPanelPosition = 'bottom' | 'left' | 'right';

export type ChatTransport = 'sse' | 'websocket';

export type ViewLayoutMode =
    | 'balanced'
    | 'max-horizontal'
    | 'max-vertical'
    | 'width-guided'
    | 'height-guided';

export interface Stream {
    chatIdentifier?: string;
    id: string;
    liveStatus?: 'live' | 'offline' | 'unknown' | 'error' | 'quota_limited';
    platform: Platform;
    title?: string;
    videoId?: string;
}

export interface CreatorProfile extends Stream {
    recommendationId?: string;
    handle?: string;
    thumbnail?: string;
    description: string;
}

export interface YouTubeQueueItem {
    addedAt: string;
    channelTitle?: string;
    duration?: string;
    durationSeconds?: number;
    id: string;
    startSeconds?: number;
    thumbnail?: string;
    title: string;
    url: string;
}
