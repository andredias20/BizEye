import React from 'react';

interface KickPlayerProps {
    isMuted: boolean;
    streamId: string;
    volume: number;
    onSignalError: () => void;
}

const KickPlayer: React.FC<KickPlayerProps> = ({
    isMuted,
    streamId,
    volume,
    onSignalError
}) => {
    const [initialVolume] = React.useState(volume);

    // For Kick, we use the simple iframe and allow native controls.
    const embedUrl = React.useMemo(() => {
        const params = new URLSearchParams({
            autoplay: 'true',
            muted: isMuted ? 'true' : 'false',
            volume: (initialVolume / 100).toFixed(2),
        });

        return `https://player.kick.com/${streamId}?${params.toString()}`;
    }, [initialVolume, isMuted, streamId]);

    return (
        <div className="player-container kick-player" style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
            <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`Kick Stream ${streamId}`}
                style={{ width: '100%', height: '100%' }}
                onError={() => onSignalError()}
            />
        </div>
    );
};

export default KickPlayer;
