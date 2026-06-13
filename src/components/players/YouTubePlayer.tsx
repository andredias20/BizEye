import React, { useEffect, useRef, useState } from 'react';

type YouTubeVideoData = {
    author?: string;
    title?: string;
};

type YouTubePlayerInstance = {
    destroy: () => void;
    getVideoData: () => YouTubeVideoData;
    mute: () => void;
    playVideo: () => void;
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

type YouTubeLiveSearchResponse = {
    items?: Array<{
        id?: {
            videoId?: string;
        };
    }>;
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
    setIsMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (volume: number) => void;
    onSignalError: () => void;
    onMetadata?: (data: { author: string; title: string }) => void;
}

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

const isYoutubeChannelId = (value: string) => /^UC[a-zA-Z0-9_-]{22}$/.test(value);

const fetchYoutubeLiveVideoId = async (channelId: string): Promise<string | null> => {
    if (!YOUTUBE_API_KEY) return null;
    try {
        const params = new URLSearchParams({
            part: 'snippet',
            channelId,
            type: 'video',
            eventType: 'live',
            maxResults: '1',
            key: YOUTUBE_API_KEY
        });

        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
        if (!response.ok) {
            console.warn(`YouTube live search failed for ${channelId}:`, response.status);
            return null;
        }
        const data = await response.json() as YouTubeLiveSearchResponse;
        return data.items?.[0]?.id?.videoId || null;
    } catch (error) {
        console.error('Error fetching YouTube live video ID:', error);
        return null;
    }
};

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
    streamId,
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    onSignalError,
    onMetadata
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const playerRef = useRef<YouTubePlayerInstance | null>(null);
    const isMutedRef = useRef(isMuted);
    const volumeRef = useRef(volume);
    const onMetadataRef = useRef(onMetadata);
    const onSignalErrorRef = useRef(onSignalError);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const isChannelStream = isYoutubeChannelId(streamId);
    const shouldResolveLiveWithApi = isChannelStream && Boolean(YOUTUBE_API_KEY);
    const [currentVideoId, setCurrentVideoId] = useState<string | null>(
        isYoutubeChannelId(streamId) ? null : streamId
    );
    const [resolvedLiveVideoId, setResolvedLiveVideoId] = useState<string | null>(null);
    const [shouldUseChannelFallback, setShouldUseChannelFallback] = useState(false);
    const effectiveVideoId = currentVideoId || resolvedLiveVideoId;

    useEffect(() => {
        isMutedRef.current = isMuted;
        volumeRef.current = volume;
        onMetadataRef.current = onMetadata;
        onSignalErrorRef.current = onSignalError;
    }, [isMuted, onMetadata, onSignalError, volume]);

    useEffect(() => {
        let isCancelled = false;

        if (!shouldResolveLiveWithApi) return;

        fetchYoutubeLiveVideoId(streamId).then((videoId) => {
            if (isCancelled) return;

            if (videoId) {
                setResolvedLiveVideoId(videoId);
                setShouldUseChannelFallback(false);
            } else {
                setShouldUseChannelFallback(true);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [shouldResolveLiveWithApi, streamId]);

    const embedUrl = React.useMemo(() => {
        if (!streamId) return '';
        const origin = window.location.origin;

        const isWaitingForLiveResolution = shouldResolveLiveWithApi && !effectiveVideoId && !shouldUseChannelFallback;
        if (isWaitingForLiveResolution) return '';

        let baseUrl = '';
        if (effectiveVideoId) {
            baseUrl = `https://www.youtube.com/embed/${effectiveVideoId}`;
        } else if (isChannelStream) {
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
            origin: origin
        });

        return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${params.toString()}`;
    }, [streamId, effectiveVideoId, isChannelStream, shouldResolveLiveWithApi, shouldUseChannelFallback]);

    const createYoutubeIframe = React.useCallback(() => {
        if (!containerRef.current || !embedUrl) return null;

        containerRef.current.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.frameBorder = '0';
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.title = `YouTube Stream ${streamId}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';

        containerRef.current.appendChild(iframe);
        iframeRef.current = iframe;

        return iframe;
    }, [embedUrl, streamId]);

    const initYoutubePlayer = React.useCallback(() => {
        if (!iframeRef.current || !window.YT?.Player || playerRef.current) return;

        const youtubeApi = window.YT;
        playerRef.current = new youtubeApi.Player(iframeRef.current, {
            events: {
                onReady: (event: YouTubePlayerEvent) => {
                    setIsPlayerReady(true);
                    event.target.setVolume(volumeRef.current);

                    event.target.playVideo();
                    if (isMutedRef.current) event.target.mute();
                    else event.target.unMute();

                    const metadataHandler = onMetadataRef.current;
                    if (metadataHandler) {
                        const data = event.target.getVideoData();
                        if (data?.author) metadataHandler({ author: data.author, title: data.title || '' });
                    }
                },
                onStateChange: (event: YouTubePlayerEvent) => {
                    const metadataHandler = onMetadataRef.current;
                    if (metadataHandler && event.data === youtubeApi.PlayerState.PLAYING) {
                        const data = event.target.getVideoData();
                        if (data?.author) metadataHandler({ author: data.author, title: data.title || '' });
                    }
                },
                onError: async (event: YouTubePlayerEvent) => {
                    console.warn(`YouTube player error for ${streamId}:`, event.data);

                    // Attempt fallback if using channel ID and not already using a direct videoId
                    if (isChannelStream && !effectiveVideoId) {
                        console.log(`Attempting fallback search for channel ${streamId}`);
                        const videoId = await fetchYoutubeLiveVideoId(streamId);
                        if (videoId) {
                            console.log(`Fallback search found videoId: ${videoId}`);
                            setCurrentVideoId(videoId);
                            setShouldUseChannelFallback(false);
                            return; // Fallback will trigger iframe reload via currentVideoId state
                        }
                    }

                    onSignalErrorRef.current();
                }
            }
        });
    }, [effectiveVideoId, isChannelStream, streamId]);

    useEffect(() => {
        let isCancelled = false;

        createYoutubeIframe();

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
                } catch (e) {
                    console.error("Error destroying YouTube player:", e);
                }
            } else {
                iframeRef.current?.remove();
            }
            playerRef.current = null;
            iframeRef.current = null;
            setIsPlayerReady(false);
        };
    }, [createYoutubeIframe, initYoutubePlayer]);

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
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

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
