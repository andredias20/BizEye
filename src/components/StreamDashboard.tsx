import React from 'react';
import './StreamDashboard.css';
import StreamCard from './StreamCard';

import type { Stream } from '../types';

interface StreamDashboardProps {
    streams: Stream[];
    onRemoveStream: (id: string) => void;
}

const StreamDashboard: React.FC<StreamDashboardProps> = ({ streams, onRemoveStream }) => {
    // Dynamic grid sizing:
    // 1-2 streams: 1 or 2 cols
    // 3-4 streams: 2 cols
    // 5-6 streams: 3 cols
    // > 6 streams: auto-fit
    const getGridStyle = () => {
        const count = streams.length;
        if (count <= 1) return { gridTemplateColumns: '1fr' };
        if (count <= 4) return { gridTemplateColumns: 'repeat(2, 1fr)' };
        if (count <= 9) return { gridTemplateColumns: 'repeat(3, 1fr)' };
        return { gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' };
    };

    return (
        <main className="stream-grid" style={getGridStyle()}>
            {streams.length === 0 ? (
                <div className="empty-state">
                    <h2>No active streams</h2>
                    <p>Add a YouTube Channel ID above to start</p>
                </div>
            ) : (
                streams.map((stream) => (
                    <StreamCard
                        key={`${stream.platform}-${stream.id}`}
                        streamId={stream.id}
                        platform={stream.platform}
                        title={stream.title}
                        onRemove={() => onRemoveStream(stream.id)}
                    />
                ))
            )}
        </main>
    );
};

export default StreamDashboard;
