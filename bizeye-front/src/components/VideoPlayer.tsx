import React from 'react';
import type { PlaybackProfile, Platform } from '../types';
import YouTubePlayer from './players/YouTubePlayer';
import TwitchPlayer from './players/TwitchPlayer';
import KickPlayer from './players/KickPlayer';

interface VideoPlayerProps {
    streamId: string;
    liveStatus?: 'live' | 'offline' | 'unknown' | 'error' | 'quota_limited';
    platform: Platform;
    videoId?: string;
    isMuted: boolean;
    playbackProfile?: PlaybackProfile;
    setIsMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (volume: number) => void;
    onLiveVideoResolved: (channelId: string, videoId: string, title?: string) => void;
    onSignalError: () => void;
    onMetadata?: (data: { author: string; title: string }) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
    const { platform } = props;

    switch (platform) {
        case 'youtube':
            return <YouTubePlayer {...props} />;
        case 'twitch':
            return <TwitchPlayer {...props} />;
        case 'kick':
            return (
                <KickPlayer
                    streamId={props.streamId}
                    onSignalError={props.onSignalError}
                />
            );
        default:
            return <div className="unknown-platform">Unknown Platform: {platform}</div>;
    }
};

export default VideoPlayer;
