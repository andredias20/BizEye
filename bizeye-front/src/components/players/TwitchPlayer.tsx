import React, { useEffect, useRef, useState } from 'react';

type TwitchPlayerInstance = {
    addEventListener: (eventName: string, callback: () => void) => void;
    play: () => void;
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
    OFFLINE: string;
    ERROR: string;
};

interface TwitchPlayerProps {
    streamId: string;
    isMuted: boolean;
    volume: number;
    onSignalError: () => void;
}

declare global {
    interface Window {
        Twitch?: {
            Player: TwitchPlayerConstructor;
        };
    }
}

const TwitchPlayer: React.FC<TwitchPlayerProps> = ({
    streamId,
    isMuted,
    volume,
    onSignalError
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<TwitchPlayerInstance | null>(null);
    const isMutedRef = useRef(isMuted);
    const volumeRef = useRef(volume);
    const onSignalErrorRef = useRef(onSignalError);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    useEffect(() => {
        isMutedRef.current = isMuted;
        volumeRef.current = volume;
        onSignalErrorRef.current = onSignalError;
    }, [isMuted, onSignalError, volume]);

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

            // Explicitly call play to handle some browser autoplay restrictions if muted
            try {
                player.play();
            } catch (e) {
                console.warn("Twitch initial play() failed:", e);
            }
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
        </div>
    );
};

export default TwitchPlayer;
