import React, { useEffect, useRef, useState } from 'react';

declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

interface YouTubePlayerProps {
    streamId: string;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (volume: number) => void;
    onSignalError: () => void;
    onMetadata?: (data: { author: string; title: string }) => void;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
    streamId,
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    onSignalError,
    onMetadata
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<any>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    const embedUrl = React.useMemo(() => {
        if (!streamId) return '';
        const origin = window.location.origin;
        const isChannel = streamId.startsWith('UC');
        const baseUrl = isChannel
            ? `https://www.youtube.com/embed/live_stream?channel=${streamId}`
            : `https://www.youtube.com/embed/${streamId}`;

        const params = new URLSearchParams({
            enablejsapi: '1',
            autoplay: '1',
            mute: '1',
            controls: '0',
            rel: '0',
            modestbranding: '1',
            origin: origin,
            vq: 'hd1080'
        });

        return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${params.toString()}`;
    }, [streamId]);

    useEffect(() => {
        let isCancelled = false;

        const checkYoutubeApi = () => {
            if (isCancelled) return;
            if (window.YT && window.YT.Player) {
                initYoutubePlayer();
            } else {
                setTimeout(checkYoutubeApi, 100);
            }
        };

        if (!window.YT && !document.getElementById('yt-iframe-api')) {
            const tag = document.createElement('script');
            tag.id = 'yt-iframe-api';
            tag.src = "https://www.youtube.com/iframe_api";
            document.body.appendChild(tag);
        }
        checkYoutubeApi();

        return () => {
            isCancelled = true;
            if (playerRef.current) {
                try {
                    playerRef.current.destroy();
                    playerRef.current = null;
                } catch (e) {
                    console.error("Error destroying YouTube player:", e);
                }
            }
            setIsPlayerReady(false);
        };
    }, [streamId]);

    const initYoutubePlayer = () => {
        if (!iframeRef.current || !window.YT?.Player || playerRef.current) return;

        playerRef.current = new window.YT.Player(iframeRef.current, {
            events: {
                onReady: (event: any) => {
                    setIsPlayerReady(true);
                    event.target.setVolume(volume);

                    // Suggest 1080p quality
                    try {
                        if (event.target.setPlaybackQuality) {
                            event.target.setPlaybackQuality('hd1080');
                        }
                    } catch (e) {
                        console.warn("YouTube setPlaybackQuality error:", e);
                    }

                    event.target.playVideo();
                    if (isMuted) event.target.mute();
                    else event.target.unMute();

                    if (onMetadata) {
                        const data = event.target.getVideoData();
                        if (data?.author) onMetadata({ author: data.author, title: data.title });
                    }
                },
                onStateChange: (event: any) => {
                    if (onMetadata && event.data === window.YT.PlayerState.PLAYING) {
                        const data = event.target.getVideoData();
                        if (data?.author) onMetadata({ author: data.author, title: data.title });
                    }
                },
                onError: () => onSignalError()
            }
        });
    };

    useEffect(() => {
        if (isPlayerReady && playerRef.current) {
            try {
                playerRef.current.setVolume(volume);
                if (isMuted) playerRef.current.mute();
                else playerRef.current.unMute();
            } catch (e) {
                console.error("YouTube Volume Error:", e);
            }
        }
    }, [isMuted, volume, isPlayerReady]);

    return (
        <div className="player-container youtube-player" style={{ width: '100%', height: '100%', position: 'relative' }}>
            <iframe
                ref={iframeRef}
                src={embedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`YouTube Stream ${streamId}`}
                style={{ width: '100%', height: '100%' }}
            />

            {/* YouTube Specific Volume Bar */}
            <div className="card-controls bottom permanent">
                <div className="volume-control">
                    <button className="mute-btn-icon" onClick={() => setIsMuted(!isMuted)}>
                        {isMuted ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                        )}
                    </button>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setVolume(val);
                            if (val > 0) setIsMuted(false);
                            else setIsMuted(true);
                        }}
                    />
                    <span className="volume-percentage">{isMuted ? 0 : volume}%</span>
                </div>
            </div>
        </div>
    );
};

export default YouTubePlayer;
