import React from 'react';

interface KickPlayerProps {
    streamId: string;
    onSignalError: () => void;
}

const KickPlayer: React.FC<KickPlayerProps> = ({
    streamId,
    onSignalError
}) => {
    // For Kick, we use the simple iframe and allow native controls.
    // We don't use query params for volume as they are not supported.
    const embedUrl = React.useMemo(() => {
        return `https://player.kick.com/${streamId}?autoplay=true`;
    }, [streamId]);

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
