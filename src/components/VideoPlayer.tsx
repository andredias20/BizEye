import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
    streamId: string;
    platform: 'youtube' | 'twitch';
    isMuted: boolean;
    volume: number;
    onSignalError: () => void;
}

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
    streamId,
    isMuted,
    volume,
    onSignalError
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);

    useEffect(() => {
        // Load YouTube API if not already loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                initPlayer();
            };
        } else {
            initPlayer();
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
            }
        };
    }, [streamId]);

    const initPlayer = () => {
        if (!containerRef.current || !window.YT) return;

        playerRef.current = new window.YT.Player(containerRef.current, {
            height: '100%',
            width: '100%',
            videoId: '', // Will be overridden by live_stream param for channel
            playerVars: {
                listType: 'live_stream',
                list: streamId,
                autoplay: 1,
                mute: isMuted ? 1 : 0,
                controls: 0,
                rel: 0,
                modestbranding: 1
            },
            events: {
                onReady: (event: any) => {
                    event.target.setVolume(volume);
                    if (isMuted) event.target.mute();
                    else event.target.unMute();
                },
                onError: () => {
                    onSignalError();
                }
            }
        });
    };

    useEffect(() => {
        if (playerRef.current && playerRef.current.setVolume) {
            playerRef.current.setVolume(volume);
            if (isMuted) playerRef.current.mute();
            else playerRef.current.unMute();
        }
    }, [isMuted, volume]);

    return (
        <div className="video-container" style={{ width: '100%', height: '100%' }}>
            <div ref={containerRef} />
        </div>
    );
};

export default VideoPlayer;
