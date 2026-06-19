import { useEffect, useState } from 'react';
import './LivesPage.css';
import MergedYouTubeChatPanel from '../components/MergedYouTubeChatPanel';
import StreamDashboard from '../components/StreamDashboard';

import type { ChatPanelPosition, ChatTransport, Stream, ViewLayoutMode } from '../types';

interface LivesPageProps {
    chatMergeEnabled: boolean;
    chatPanelPosition: ChatPanelPosition;
    chatTransport: ChatTransport;
    layoutMode: ViewLayoutMode;
    onChatPanelPositionChange: (position: ChatPanelPosition) => void;
    onLayoutModeChange: (mode: ViewLayoutMode) => void;
    onLiveVideoResolved: (channelId: string, videoId: string, title?: string) => void;
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

const chatPositionOptions: Array<{ id: ChatPanelPosition; label: string; title: string }> = [
    { id: 'left', label: 'Esq', title: 'Chat no lado esquerdo' },
    { id: 'right', label: 'Dir', title: 'Chat no lado direito' },
    { id: 'bottom', label: 'Baixo', title: 'Chat abaixo dos videos' },
];

const LivesPage: React.FC<LivesPageProps> = ({
    chatMergeEnabled,
    chatPanelPosition,
    chatTransport,
    layoutMode,
    onChatPanelPositionChange,
    onLayoutModeChange,
    onLiveVideoResolved,
    onRemoveStream,
    streams,
}) => {
    const [isFullscreen, setIsFullscreen] = useState(() => (
        typeof document !== 'undefined' && Boolean(document.fullscreenElement)
    ));

    useEffect(() => {
        const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', syncFullscreenState);

        return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
    }, []);

    const exitFullscreen = () => {
        if (document.fullscreenElement && document.exitFullscreen) {
            void document.exitFullscreen();
        }
    };

    return (
        <main className="lives-page">
            <div className="lives-toolbar">
                <div>
                    <span className="lives-kicker">Lives</span>
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

                {chatMergeEnabled && (
                    <div className="chat-position-control" aria-label="Posicao do chat">
                        {chatPositionOptions.map((option) => (
                            <button
                                className={chatPanelPosition === option.id ? 'active' : ''}
                                key={option.id}
                                onClick={() => onChatPanelPositionChange(option.id)}
                                title={option.title}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}

                {isFullscreen && (
                    <button
                        aria-label="Sair do fullscreen"
                        className="lives-exit-fullscreen"
                        onClick={exitFullscreen}
                        title="Sair do fullscreen"
                        type="button"
                    >
                        <svg
                            aria-hidden="true"
                            fill="none"
                            height="18"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="18"
                        >
                            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                            <path d="M16 3v3a2 2 0 0 0 2 2h3" />
                            <path d="M8 21v-3a2 2 0 0 0-2-2H3" />
                            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                        </svg>
                    </button>
                )}
            </div>

            <div className={`lives-body lives-body--chat-${chatPanelPosition}`}>
                <StreamDashboard
                    layoutMode={layoutMode}
                    onLiveVideoResolved={onLiveVideoResolved}
                    onRemoveStream={onRemoveStream}
                    streams={streams}
                />

                <MergedYouTubeChatPanel enabled={chatMergeEnabled} streams={streams} transport={chatTransport} />
            </div>
        </main>
    );
};

export default LivesPage;
