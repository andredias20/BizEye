import './WatchPage.css';
import AddStreamButton from '../components/AddStreamButton';
import StreamDashboard from '../components/StreamDashboard';

import type { Stream, ViewLayoutMode } from '../types';

interface WatchPageProps {
    layoutMode: ViewLayoutMode;
    onAddStream: () => void;
    onLayoutModeChange: (mode: ViewLayoutMode) => void;
    onRemoveStream: (id: string, platform: Stream['platform']) => void;
    streams: Stream[];
}

const layoutOptions: Array<{ id: ViewLayoutMode; label: string; title: string }> = [
    { id: 'balanced', label: 'Auto', title: 'Maior area media sem preferencia de orientacao' },
    { id: 'max-horizontal', label: 'Max H', title: 'Prioriza mais colunas quando o tamanho continua razoavel' },
    { id: 'max-vertical', label: 'Max V', title: 'Prioriza mais linhas quando o tamanho continua razoavel' },
    { id: 'width-guided', label: 'Largura', title: 'Altura dos videos guiada pela largura disponivel' },
    { id: 'height-guided', label: 'Altura', title: 'Largura dos videos guiada pela altura disponivel' },
];

const WatchPage: React.FC<WatchPageProps> = ({
    layoutMode,
    onAddStream,
    onLayoutModeChange,
    onRemoveStream,
    streams,
}) => {
    return (
        <main className="watch-page">
            <div className="watch-toolbar">
                <div>
                    <span className="watch-kicker">Watch</span>
                    <strong>{streams.length} streams</strong>
                </div>

                <div className="layout-control" aria-label="Modo de visualizacao">
                    {layoutOptions.map((option) => (
                        <button
                            className={layoutMode === option.id ? 'active' : ''}
                            key={option.id}
                            onClick={() => onLayoutModeChange(option.id)}
                            title={option.title}
                            type="button"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            <StreamDashboard
                layoutMode={layoutMode}
                onRemoveStream={onRemoveStream}
                streams={streams}
            />

            <AddStreamButton onClick={onAddStream} />
        </main>
    );
};

export default WatchPage;
