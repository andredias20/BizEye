import React, { useState } from 'react';
import './StreamCard.css';
import VideoPlayer from './VideoPlayer';

interface StreamCardProps {
    streamId: string;
    platform: 'youtube' | 'twitch';
    onRemove: () => void;
}

const StreamCard: React.FC<StreamCardProps> = ({ streamId, onRemove }) => {
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
                    <span className="channel-id">{channelName || `@${streamId}`}</span>
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
            </div>

            {/* Video Player Core */}
            <div className="player-wrapper">
                <VideoPlayer
                    streamId={streamId}
                    isMuted={isMuted}
                    volume={volume}
                    onSignalError={() => setHasSignal(false)}
                    onMetadata={(data: { author: string }) => setChannelName(data.author)}
                />
            </div>

            {/* Bottom Controls (Volume) */}
            <div className="card-controls bottom permanent">
                <div className="volume-control">
                    {isMuted ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                    )}
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
                        onClick={(e) => e.stopPropagation()}
                    />
                    <span className="volume-percentage">{isMuted ? 0 : volume}%</span>
                </div>
            </div>
        </div>
    );
};

export default StreamCard;
