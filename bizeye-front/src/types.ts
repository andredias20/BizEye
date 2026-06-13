export type Platform = 'youtube' | 'twitch' | 'kick';

export type PlaybackProfile = 'firetv' | 'standard';

export type ViewLayoutMode =
    | 'balanced'
    | 'max-horizontal'
    | 'max-vertical'
    | 'width-guided'
    | 'height-guided';

export interface Stream {
    id: string;
    liveStatus?: 'live' | 'offline' | 'unknown' | 'error' | 'quota_limited';
    platform: Platform;
    title?: string;
    videoId?: string;
}

export interface CreatorProfile extends Stream {
    handle?: string;
    description: string;
}
