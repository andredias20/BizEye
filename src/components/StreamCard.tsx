import React, { useState } from 'react';
import './StreamCard.css';
import VideoPlayer from './VideoPlayer';

interface StreamCardProps {
    streamId: string;
    platform: 'youtube' | 'twitch' | 'kick';
    onRemove: () => void;
}

const StreamCard: React.FC<StreamCardProps> = ({ streamId, platform, onRemove }) => {
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(50);
    const [hasSignal, setHasSignal] = useState(true);
    const [channelName, setChannelName] = useState<string | null>(null);

    const toggleMute = () => setIsMuted(!isMuted);

    return (
        <div className="stream-card">
            {/* Top Controls */}
            <div className="card-controls top">
                <button className="remove-btn" onClick={onRemove}>✕</button>
            </div>

            {/* Signal Loss Fallback */}
            {!hasSignal && (
                <div className="signal-loss">
                    <button className="remove-btn signal-remove" onClick={onRemove} title="Remover Stream">✕</button>
                    <div className="signal-content">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 19h19" /><path d="M5 19l4-8" /><path d="M12 19V7l-3 4" /><path d="M16 19v-4l-3 4" /></svg>
                        <h2>PERDEMOS O SINAL</h2>
                        <p>MAS VOLTAMOS JÁ</p>
                    </div>
                </div>
            )}

            {/* Live Badge Overlay */}
            <div className="live-badge-overlay">
                <div className="badge-header">
                    <div className="live-indicator">LIVE</div>
                    <div className={`platform-icon ${platform}`}>{platform}</div>
                    <span className="channel-id">{channelName || `@${streamId}`}</span>
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
                    platform={platform}
                    isMuted={isMuted}
                    setIsMuted={setIsMuted}
                    volume={volume}
                    setVolume={setVolume}
                    onSignalError={() => setHasSignal(false)}
                    onMetadata={(data: { author: string }) => setChannelName(data.author)}
                />
            </div>
        </div >
    );
};

export default StreamCard;
