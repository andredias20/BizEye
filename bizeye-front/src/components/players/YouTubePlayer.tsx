import React, { useEffect, useRef, useState } from 'react';
import { fetchYoutubeLiveVideoId, recordYoutubeLiveVideoId } from '../../services/youtubeResolver';

type YouTubeVideoData = {
    author?: string;
    title?: string;
    video_id?: string;
};

type YouTubePlayerInstance = {
    destroy: () => void;
    getVideoData: () => YouTubeVideoData;
    mute: () => void;
    playVideo: () => void;
    setPlaybackQuality?: (quality: string) => void;
    setVolume: (volume: number) => void;
    unMute: () => void;
};

type YouTubePlayerEvent = {
    target: YouTubePlayerInstance;
    data?: number;
};

type YouTubePlayerConstructor = {
    new (element: HTMLIFrameElement, options: {
        events: {
            onReady?: (event: YouTubePlayerEvent) => void;
            onStateChange?: (event: YouTubePlayerEvent) => void;
            onError?: (event: YouTubePlayerEvent) => void;
        };
    }): YouTubePlayerInstance;
};

declare global {
    interface Window {
        onYouTubeIframeAPIReady?: () => void;
        YT?: {
            Player: YouTubePlayerConstructor;
            PlayerState: {
                PLAYING: number;
            };
        };
    }
}

interface YouTubePlayerProps {
    streamId: string;
    isMuted: boolean;
    liveStatus?: 'live' | 'offline' | 'unknown' | 'error' | 'quota_limited';
    videoId?: string;
    setIsMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (volume: number) => void;
    onLiveVideoResolved: (channelId: string, videoId: string, title?: string) => void;
    onSignalError: () => void;
    onMetadata?: (data: { author: string; title: string }) => void;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
    streamId,
    isMuted,
    videoId,
    setIsMuted,
    volume,
    setVolume,
    onLiveVideoResolved,
    onSignalError,
    onMetadata
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<YouTubePlayerInstance | null>(null);
    const isMutedRef = useRef(isMuted);
    const volumeRef = useRef(volume);
    const onMetadataRef = useRef(onMetadata);
    const onSignalErrorRef = useRef(onSignalError);
    const onLiveVideoResolvedRef = useRef(onLiveVideoResolved);
    const reportedVideoIdRef = useRef<string | null>(videoId || null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [resolvedVideoId, setResolvedVideoId] = useState<string | null>(streamId.startsWith('UC') ? null : streamId);
    const currentVideoId = videoId || resolvedVideoId;

    useEffect(() => {
        isMutedRef.current = isMuted;
        volumeRef.current = volume;
        onMetadataRef.current = onMetadata;
        onSignalErrorRef.current = onSignalError;
        onLiveVideoResolvedRef.current = onLiveVideoResolved;
    }, [isMuted, onLiveVideoResolved, onMetadata, onSignalError, volume]);

    const handleResolvedVideoData = React.useCallback((data?: YouTubeVideoData) => {
        const resolvedVideoId = data?.video_id;
        if (!streamId.startsWith('UC') || !resolvedVideoId || resolvedVideoId === 'live_stream') return;

        if (resolvedVideoId !== currentVideoId) {
            setResolvedVideoId(resolvedVideoId);
        }

        if (reportedVideoIdRef.current === resolvedVideoId || videoId === resolvedVideoId) {
            reportedVideoIdRef.current = resolvedVideoId;
            return;
        }

        reportedVideoIdRef.current = resolvedVideoId;
        onLiveVideoResolvedRef.current(streamId, resolvedVideoId, data?.title);
        void recordYoutubeLiveVideoId(streamId, resolvedVideoId);
    }, [currentVideoId, streamId, videoId]);

    const embedUrl = React.useMemo(() => {
        if (!streamId) return '';
        const origin = window.location.origin;

        let baseUrl = '';
        if (currentVideoId) {
            baseUrl = `https://www.youtube.com/embed/${currentVideoId}`;
        } else if (streamId.startsWith('UC')) {
            baseUrl = `https://www.youtube.com/embed/live_stream?channel=${streamId}`;
        } else {
            baseUrl = `https://www.youtube.com/embed/${streamId}`;
        }

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
    }, [streamId, currentVideoId]);

    const initYoutubePlayer = React.useCallback(() => {
        if (!iframeRef.current || !window.YT?.Player || playerRef.current) return;

        const youtubeApi = window.YT;
        playerRef.current = new youtubeApi.Player(iframeRef.current, {
            events: {
                onReady: (event: YouTubePlayerEvent) => {
                    setIsPlayerReady(true);
                    event.target.setVolume(volumeRef.current);

                    // Suggest 1080p quality
                    try {
                        if (event.target.setPlaybackQuality) {
                            event.target.setPlaybackQuality('hd1080');
                        }
                    } catch (e) {
                        console.warn("YouTube setPlaybackQuality error:", e);
                    }

                    event.target.playVideo();
                    if (isMutedRef.current) event.target.mute();
                    else event.target.unMute();

                    const data = event.target.getVideoData();
                    const metadataHandler = onMetadataRef.current;
                    if (metadataHandler) {
                        if (data?.author) metadataHandler({ author: data.author, title: data.title || '' });
                    }
                    handleResolvedVideoData(data);
                },
                onStateChange: (event: YouTubePlayerEvent) => {
                    const metadataHandler = onMetadataRef.current;
                    const data = event.target.getVideoData();
                    if (metadataHandler && event.data === youtubeApi.PlayerState.PLAYING) {
                        if (data?.author) metadataHandler({ author: data.author, title: data.title || '' });
                    }
                    if (event.data === youtubeApi.PlayerState.PLAYING) {
                        handleResolvedVideoData(data);
                    }
                },
                onError: async (event: YouTubePlayerEvent) => {
                    console.warn(`YouTube player error for ${streamId}:`, event.data);

                    // Attempt fallback if using channel ID and not already using a direct videoId
                    if (streamId.startsWith('UC') && !currentVideoId) {
                        console.log(`Attempting fallback search for channel ${streamId}`);
                        const videoId = await fetchYoutubeLiveVideoId(streamId);
                        if (videoId) {
                            console.log(`Fallback search found videoId: ${videoId}`);
                            setResolvedVideoId(videoId);
                            if (reportedVideoIdRef.current !== videoId) {
                                reportedVideoIdRef.current = videoId;
                                onLiveVideoResolvedRef.current(streamId, videoId);
                            }
                            return; // Fallback will trigger iframe reload via currentVideoId state
                        }
                    }

                    onSignalErrorRef.current();
                }
            }
        });
    }, [currentVideoId, handleResolvedVideoData, streamId]);

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
    }, [initYoutubePlayer, streamId]);

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
