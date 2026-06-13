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

    const toggleMute = () => setIsMuted(!isMuted);
    const className = playbackProfile === 'firetv' ? 'stream-card stream-card--firetv' : 'stream-card';

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

            {/* Click Overlay to Mute/Unmute (Disabled for Twitch/Kick to allow native controls/compliance) */}
            {platform !== 'kick' && platform !== 'twitch' && (
                <div
                    className="click-overlay"
                    onClick={toggleMute}
                    title={isMuted ? "Click to Unmute" : "Click to Mute"}
                >
                </div>
            )}

            {/* Video Player Core */}
            <div className="player-wrapper">
                <VideoPlayer
                    streamId={streamId}
                    liveStatus={liveStatus}
                    platform={platform}
                    videoId={videoId}
                    isMuted={isMuted}
                    setIsMuted={setIsMuted}
                    volume={volume}
                    setVolume={setVolume}
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
