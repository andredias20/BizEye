export type Platform = 'youtube' | 'twitch' | 'kick';

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
