import React, { useEffect, useRef, useState } from 'react';

interface TwitchPlayerProps {
    streamId: string;
    isMuted: boolean;
    setIsMuted: (muted: boolean) => void;
    volume: number;
    setVolume: (volume: number) => void;
    onSignalError: () => void;
}

declare global {
    interface Window {
        Twitch: any;
    }
}

const TwitchPlayer: React.FC<TwitchPlayerProps> = ({
    streamId,
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    onSignalError
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    useEffect(() => {
        let isCancelled = false;

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
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [streamId]);

    const initTwitchPlayer = () => {
        if (!containerRef.current || !window.Twitch?.Player || playerRef.current) return;

        const options = {
            width: '100%',
            height: '100%',
            channel: streamId,
            parent: [window.location.hostname],
            autoplay: true,
            muted: isMuted
        };

        playerRef.current = new window.Twitch.Player(containerRef.current, options);

        playerRef.current.addEventListener(window.Twitch.Player.READY, () => {
            setIsPlayerReady(true);
            playerRef.current.setVolume(volume / 100);
            playerRef.current.setMuted(isMuted);

            // Explicitly call play to handle some browser autoplay restrictions if muted
            try {
                playerRef.current.play();
            } catch (e) {
                console.warn("Twitch initial play() failed:", e);
            }
        });

        playerRef.current.addEventListener(window.Twitch.Player.OFFLINE, () => {
            // Signal error or offline state
        });

        playerRef.current.addEventListener(window.Twitch.Player.ERROR, () => {
            onSignalError();
        });
    };

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
