import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
    streamId: string;
    platform: 'youtube' | 'twitch';
    isMuted: boolean;
    volume: number;
    onSignalError: () => void;
    onMetadata?: (data: { author: string; title: string }) => void;
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
    onSignalError,
    onMetadata
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<any>(null);

    // Stable URL that only depends on streamId to prevent iframe reloads
    // Note: mute=1 is required for autoplay to work consistently in modern browsers
    const embedUrl = React.useMemo(() =>
        `https://www.youtube.com/embed/live_stream?channel=${streamId}&enablejsapi=1&autoplay=1&mute=1&controls=0&rel=0&modestbranding=1`,
        [streamId]);

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
        if (!iframeRef.current || !window.YT) return;

        // Initialize player on existing iframe
        playerRef.current = new window.YT.Player(iframeRef.current, {
            events: {
                onReady: (event: any) => {
                    // Sync initial state
                    event.target.setVolume(volume);

                    // Force play in case autoplay was blocked
                    event.target.playVideo();

                    if (isMuted) event.target.mute();
                    else event.target.unMute();

                    // Extract metadata if available
                    if (onMetadata && event.target.getVideoData) {
                        const data = event.target.getVideoData();
                        if (data && data.author) {
                            onMetadata({ author: data.author, title: data.title });
                        }
                    }
                },
                onStateChange: (event: any) => {
                    // Sometimes data isn't ready until playback starts or state changes
                    if (onMetadata && event.data === window.YT.PlayerState.PLAYING) {
                        const data = event.target.getVideoData();
                        if (data && data.author) {
                            onMetadata({ author: data.author, title: data.title });
                        }
                    }
                },
                onError: () => {
                    onSignalError();
                }
            }
        });
    };

    useEffect(() => {
        if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
            try {
                playerRef.current.setVolume(volume);
                if (isMuted) {
                    playerRef.current.mute();
                } else {
                    playerRef.current.unMute();
                }
            } catch (e) {
                console.error("Error setting volume/mute:", e);
            }
        }
    }, [isMuted, volume]);

    return (
        <div className="video-container" style={{ width: '100%', height: '100%' }}>
            <iframe
                ref={iframeRef}
                src={embedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`Stream ${streamId}`}
            />
        </div>
    );
};

export default VideoPlayer;
