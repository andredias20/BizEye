export type Platform = 'youtube' | 'twitch' | 'kick';

export interface Stream {
    id: string;
    platform: Platform;
    title?: string;
}
