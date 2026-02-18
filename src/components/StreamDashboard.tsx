import React from 'react';
import './StreamDashboard.css';
import StreamCard from './StreamCard';

interface Stream {
    id: string;
    platform: 'youtube' | 'twitch';
}

interface StreamDashboardProps {
    streams: Stream[];
    onRemoveStream: (id: string) => void;
}

const StreamDashboard: React.FC<StreamDashboardProps> = ({ streams, onRemoveStream }) => {
    const getGridClass = () => {
        const count = streams.length;
        if (count === 0) return 'grid-empty';
        if (count === 1) return 'grid-1';
        if (count === 2) return 'grid-2';
        if (count === 3) return 'grid-3';
        if (count >= 4) return 'grid-4';
        return '';
    };

    return (
        <main className={`stream-grid ${getGridClass()}`}>
            {streams.length === 0 ? (
                <div className="empty-state">
                    <h2>No active streams</h2>
                    <p>Add a YouTube Channel ID above to start</p>
                </div>
            ) : (
                streams.map((stream) => (
                    <StreamCard
                        key={stream.id}
                        streamId={stream.id}
                        platform={stream.platform}
                        onRemove={() => onRemoveStream(stream.id)}
                    />
                ))
            )}
        </main>
    );
};

export default StreamDashboard;
