import React, { useState } from 'react';
import './StreamCard.css';
import VideoPlayer from './VideoPlayer';
import type { PlaybackProfile } from '../types';

interface StreamCardProps {
    liveStatus?: 'live' | 'offline' | 'unknown' | 'error' | 'quota_limited';
    onLiveVideoResolved: (channelId: string, videoId: string, title?: string) => void;
    playbackProfile?: PlaybackProfile;
    streamId: string;
    platform: 'youtube' | 'twitch' | 'kick';
    title?: string;
    videoId?: string;
    onRemove: () => void;
}

const StreamCard: React.FC<StreamCardProps> = ({
    liveStatus,
    onLiveVideoResolved,
    onRemove,
    playbackProfile = 'standard',
    platform,
    streamId,
    title,
    videoId,
}) => {
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(50);
    const [hasSignal, setHasSignal] = useState(true);
    const [channelName, setChannelName] = useState<string | null>(title || null);
    const [playerReloadKey, setPlayerReloadKey] = useState(0);

    const reloadPlayerForAudio = () => {
        if (platform === 'kick' || platform === 'twitch') {
            setPlayerReloadKey((currentKey) => currentKey + 1);
        }
    };

    const setMutedWithPlayerSync = (nextMuted: boolean) => {
        setIsMuted(nextMuted);

        if (nextMuted !== isMuted) {
            reloadPlayerForAudio();
        }
    };

    const toggleMute = () => {
        const nextMuted = !isMuted;

        if (!nextMuted && volume === 0) {
            setVolume(50);
        }

        setMutedWithPlayerSync(nextMuted);
    };

    const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextVolume = Number(event.target.value);
        const nextMuted = nextVolume === 0;

        setVolume(nextVolume);
        setMutedWithPlayerSync(nextMuted);
    };

    const handleVolumeCommit = (event: React.SyntheticEvent<HTMLInputElement>) => {
        if (platform === 'kick') {
            setVolume(Number(event.currentTarget.value));
            reloadPlayerForAudio();
        }
    };

    const className = playbackProfile === 'firetv' ? 'stream-card stream-card--firetv' : 'stream-card';
    const playerKey = platform === 'youtube'
        ? `${platform}-${streamId}`
        : `${platform}-${streamId}-${playerReloadKey}`;
    const showVolumeControls = playbackProfile !== 'firetv';
    const displayedVolume = isMuted ? 0 : volume;

    return (
        <div className={className}>
            {/* Top Controls */}
            <div className="card-controls top">
                <button className="remove-btn" onClick={onRemove}>x</button>
            </div>

            {/* Signal Loss Fallback */}
            {!hasSignal && (
                <div className="signal-loss">
                    <button className="remove-btn signal-remove" onClick={onRemove} title="Remover Stream">x</button>
                    <div className="signal-content">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 19h19" /><path d="M5 19l4-8" /><path d="M12 19V7l-3 4" /><path d="M16 19v-4l-3 4" /></svg>
                        {platform === 'youtube' ? (
                            <>
                                <h2>{title || channelName || `@${streamId}`}</h2>
                                <p>OFFLINE</p>
                            </>
                        ) : (
                            <>
                                <h2>PERDEMOS O SINAL</h2>
                                <p>MAS VOLTAMOS JA</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Live Badge Overlay */}
            <div className="live-badge-overlay">
                <div className="badge-header">
                    <div className="live-indicator">LIVE</div>
                    <div className={`platform-icon ${platform}`}>{platform}</div>
                    <span className="channel-id">{channelName || title || `@${streamId}`}</span>
                </div>
            </div>

            <button
                aria-label={isMuted ? 'Ativar som' : 'Mutar stream'}
                className="click-overlay"
                onClick={toggleMute}
                title={isMuted ? 'Click to Unmute' : 'Click to Mute'}
                type="button"
            />

            {showVolumeControls && (
                <div className="card-controls bottom permanent">
                    <div className="volume-control">
                        <button
                            aria-label={isMuted ? 'Ativar som' : 'Mutar stream'}
                            className="mute-btn-icon"
                            onClick={toggleMute}
                            title={isMuted ? 'Ativar som' : 'Mutar stream'}
                            type="button"
                        >
                            {isMuted ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                            )}
                        </button>
                        <input
                            aria-label={`Volume ${channelName || title || streamId}`}
                            max="100"
                            min="0"
                            onChange={handleVolumeChange}
                            onKeyUp={handleVolumeCommit}
                            onPointerUp={handleVolumeCommit}
                            type="range"
                            value={displayedVolume}
                        />
                        <span className="volume-percentage">{displayedVolume}%</span>
                    </div>
                </div>
            )}

            {/* Video Player Core */}
            <div className="player-wrapper">
                <VideoPlayer
                    key={playerKey}
                    streamId={streamId}
                    liveStatus={liveStatus}
                    platform={platform}
                    videoId={videoId}
                    isMuted={isMuted}
                    volume={volume}
                    onLiveVideoResolved={onLiveVideoResolved}
                    onSignalError={() => setHasSignal(false)}
                    playbackProfile={playbackProfile}
                    onMetadata={(data: { author: string }) => {
                        // Only update if we don't have a specific title from the modal/hardcoded state
                        if (!title) setChannelName(data.author);
                    }}
                />
            </div>
        </div >
    );
};

export default StreamCard;
