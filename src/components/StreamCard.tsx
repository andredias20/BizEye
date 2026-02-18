import React, { useState } from 'react';
import './StreamCard.css';
import VideoPlayer from './VideoPlayer';

interface StreamCardProps {
    streamId: string;
    platform: 'youtube' | 'twitch';
    onRemove: () => void;
}

const StreamCard: React.FC<StreamCardProps> = ({ streamId, platform, onRemove }) => {
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(50);
    const [hasSignal, setHasSignal] = useState(true);

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
                    <span className="channel-id">@{streamId}</span>
                </div>
                <div className="qr-code">
                    {/* Placeholder for QR Code */}
                    <div className="qr-box" />
                </div>
            </div>

            {/* Click Overlay to Mute/Unmute */}
            <div
                className="click-overlay"
                onClick={toggleMute}
                title={isMuted ? "Click to Unmute" : "Click to Mute"}
            >
                {isMuted && (
                    <div className="mute-indicator">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.38.28-.8.52-1.25.7V19c1.02-.21 1.95-.65 2.74-1.25L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                    </div>
                )}
            </div>

            {/* Video Player Core */}
            <div className="player-wrapper">
                <VideoPlayer
                    streamId={streamId}
                    platform={platform}
                    isMuted={isMuted}
                    volume={volume}
                    onSignalError={() => setHasSignal(false)}
                />
            </div>

            {/* Bottom Controls (Volume) */}
            <div className="card-controls bottom">
                <div className="volume-control">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        </div>
    );
};

export default StreamCard;
