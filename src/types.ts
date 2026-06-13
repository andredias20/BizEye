export type Platform = 'youtube' | 'twitch' | 'kick';

export const STREAM_QUALITY_OPTIONS = ['auto', '1080p', '720p', '480p'] as const;

export type StreamQuality = (typeof STREAM_QUALITY_OPTIONS)[number];

export type ViewLayoutMode =
    | 'balanced'
    | 'max-horizontal'
    | 'max-vertical'
    | 'width-guided'
    | 'height-guided';

export interface Stream {
    id: string;
    platform: Platform;
    title?: string;
}

export interface CreatorProfile extends Stream {
    handle?: string;
    description: string;
}
