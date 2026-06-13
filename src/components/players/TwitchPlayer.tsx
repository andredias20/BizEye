import React, { useEffect, useRef, useState } from 'react';
import type { StreamQuality } from '../../types';

type TwitchQuality = string | {
    group?: string;
    name?: string;
};

type TwitchPlayerInstance = {
    addEventListener: (eventName: string, callback: () => void) => void;
    getQualities?: () => TwitchQuality[];
    play: () => void;
    setQuality?: (quality: string) => void;
    setMuted: (muted: boolean) => void;
    setVolume: (volume: number) => void;
};

type TwitchPlayerConstructor = {
    new (element: HTMLElement, options: {
        width: string;
        height: string;
        channel: string;
        parent: string[];
        autoplay: boolean;
        muted: boolean;
    }): TwitchPlayerInstance;
    READY: string;
    PLAYING: string;
    OFFLINE: string;
    ERROR: string;
};

interface TwitchPlayerProps {
    streamId: string;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (volume: number) => void;
    streamQuality: StreamQuality;
    onSignalError: () => void;
}

declare global {
    interface Window {
        Twitch?: {
            Player: TwitchPlayerConstructor;
        };
    }
}

const getTwitchQualityCandidates = (quality: StreamQuality) => {
    switch (quality) {
        case 'auto':
            return ['auto'];
        case '1080p':
            return ['1080p60', '1080p', 'chunked'];
        case '720p':
            return ['720p60', '720p'];
        case '480p':
            return ['480p60', '480p30', '480p'];
    }
};

const getTwitchQualityName = (quality: TwitchQuality) => {
    return typeof quality === 'string' ? quality : quality.group || quality.name;
};

const applyTwitchQuality = (player: TwitchPlayerInstance, quality: StreamQuality) => {
    if (!player.setQuality || !player.getQualities) return false;

    try {
        const candidates = getTwitchQualityCandidates(quality);
        const availableNames = new Set(player.getQualities().map(getTwitchQualityName).filter(Boolean));
        const selectedQuality = candidates.find((candidate) => availableNames.has(candidate));

        if (!selectedQuality) return false;

        player.setQuality(selectedQuality);
        return true;
    } catch (e) {
        console.warn("Twitch setQuality error:", e);
        return false;
    }
};

const applyTwitchQualityWithRetry = (player: TwitchPlayerInstance, quality: StreamQuality, attempts = 4) => {
    if (applyTwitchQuality(player, quality) || attempts <= 1) return;

    window.setTimeout(() => {
        applyTwitchQualityWithRetry(player, quality, attempts - 1);
    }, 700);
};

const TwitchPlayer: React.FC<TwitchPlayerProps> = ({
    streamId,
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    streamQuality,
    onSignalError
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<TwitchPlayerInstance | null>(null);
    const isMutedRef = useRef(isMuted);
    const volumeRef = useRef(volume);
    const streamQualityRef = useRef(streamQuality);
    const onSignalErrorRef = useRef(onSignalError);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    useEffect(() => {
        isMutedRef.current = isMuted;
        volumeRef.current = volume;
        streamQualityRef.current = streamQuality;
        onSignalErrorRef.current = onSignalError;
    }, [isMuted, onSignalError, streamQuality, volume]);

    const initTwitchPlayer = React.useCallback(() => {
        if (!containerRef.current || !window.Twitch?.Player || playerRef.current) return;

        const options = {
            width: '100%',
            height: '100%',
            channel: streamId,
            parent: [window.location.hostname],
            autoplay: true,
            muted: isMutedRef.current
        };

        const player = new window.Twitch.Player(containerRef.current, options);
        playerRef.current = player;

        player.addEventListener(window.Twitch.Player.READY, () => {
            setIsPlayerReady(true);
            player.setVolume(volumeRef.current / 100);
            player.setMuted(isMutedRef.current);
            applyTwitchQualityWithRetry(player, streamQualityRef.current);

            // Explicitly call play to handle some browser autoplay restrictions if muted
            try {
                player.play();
            } catch (e) {
                console.warn("Twitch initial play() failed:", e);
            }
        });

        player.addEventListener(window.Twitch.Player.PLAYING, () => {
            applyTwitchQualityWithRetry(player, streamQualityRef.current);
        });

        player.addEventListener(window.Twitch.Player.OFFLINE, () => {
            // Signal error or offline state
        });

        player.addEventListener(window.Twitch.Player.ERROR, () => {
            onSignalErrorRef.current();
        });
    }, [streamId]);

    useEffect(() => {
        let isCancelled = false;
        const container = containerRef.current;

        const loadTwitchScript = () => {
            if (document.getElementById('twitch-embed-script')) {
                checkTwitchApi();
                return;
            }
            const script = document.createElement('script');
            script.id = 'twitch-embed-script';
            script.src = 'https://player.twitch.tv/js/embed/v1.js';
            script.onload = () => checkTwitchApi();
            document.body.appendChild(script);
        };

        const checkTwitchApi = () => {
            if (isCancelled) return;
            if (window.Twitch && window.Twitch.Player) {
                initTwitchPlayer();
            } else {
                setTimeout(checkTwitchApi, 100);
            }
        };

        // Delay initialization slightly to ensure DOM is ready and visibility is stable
        const timer = setTimeout(() => {
            if (!isCancelled) loadTwitchScript();
        }, 500);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
            if (playerRef.current) {
                playerRef.current = null;
            }
            setIsPlayerReady(false);
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [initTwitchPlayer, streamId]);

    useEffect(() => {
        if (isPlayerReady && playerRef.current) {
            try {
                playerRef.current.setVolume(volume / 100);
                playerRef.current.setMuted(isMuted);
            } catch (e) {
                console.error("Twitch Volume Error:", e);
            }
        }
    }, [isMuted, volume, isPlayerReady]);

    useEffect(() => {
        if (isPlayerReady && playerRef.current) {
            applyTwitchQualityWithRetry(playerRef.current, streamQuality);
        }
    }, [isPlayerReady, streamQuality]);

    return (
        <div className="player-container twitch-player" style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    visibility: 'visible',
                    opacity: 1
                }}
            />

            {/* Twitch Specific Volume Bar */}
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

export default TwitchPlayer;
