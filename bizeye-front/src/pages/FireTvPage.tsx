import './FireTvPage.css';
import StreamDashboard from '../components/StreamDashboard';

import type { Stream } from '../types';

interface FireTvPageProps {
    onLiveVideoResolved: (channelId: string, videoId: string, title?: string) => void;
    onOpenLives: () => void;
    onOpenHome: () => void;
    onRemoveStream: (id: string, platform: Stream['platform']) => void;
    streams: Stream[];
}

const FireTvPage: React.FC<FireTvPageProps> = ({
    onLiveVideoResolved,
    onOpenLives,
    onOpenHome,
    onRemoveStream,
    streams,
}) => {
    return (
        <main className="firetv-page">
            <div className="firetv-toolbar">
                <div>
                    <span>Fire TV</span>
                    <strong>{streams.length} streams</strong>
                </div>

                <nav aria-label="Fire TV">
                    <button onClick={onOpenLives} type="button">Lives</button>
                    <button onClick={onOpenHome} type="button">Home</button>
                </nav>
            </div>

            <StreamDashboard
                layoutMode="balanced"
                onLiveVideoResolved={onLiveVideoResolved}
                onRemoveStream={onRemoveStream}
                playbackProfile="firetv"
                streams={streams}
            />
        </main>
    );
};

export default FireTvPage;
