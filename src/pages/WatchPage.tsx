import { useEffect, useId, useRef, useState } from 'react';
import './WatchPage.css';
import AddStreamButton from '../components/AddStreamButton';
import StreamDashboard from '../components/StreamDashboard';
import { STREAM_QUALITY_OPTIONS } from '../types';

import type { Stream, StreamQuality, ViewLayoutMode } from '../types';

interface WatchPageProps {
    layoutMode: ViewLayoutMode;
    onAddStream: () => void;
    onLayoutModeChange: (mode: ViewLayoutMode) => void;
    onRemoveStream: (id: string, platform: Stream['platform']) => void;
    onStreamQualityChange: (quality: StreamQuality) => void;
    streamQuality: StreamQuality;
    streams: Stream[];
}

const layoutOptions: Array<{ id: ViewLayoutMode; label: string; title: string }> = [
    { id: 'balanced', label: 'Auto', title: 'Maior area media sem preferencia de orientacao' },
    { id: 'max-horizontal', label: 'Max H', title: 'Prioriza mais colunas quando o tamanho continua razoavel' },
    { id: 'max-vertical', label: 'Max V', title: 'Prioriza mais linhas quando o tamanho continua razoavel' },
    { id: 'width-guided', label: 'Largura', title: 'Altura dos videos guiada pela largura disponivel' },
    { id: 'height-guided', label: 'Altura', title: 'Largura dos videos guiada pela altura disponivel' },
];

const qualityLabels: Record<StreamQuality, string> = {
    auto: 'Auto',
    '1080p': '1080p',
    '720p': '720p',
    '480p': '480p',
};

interface StreamQualityDropdownProps {
    onChange: (quality: StreamQuality) => void;
    value: StreamQuality;
}

const StreamQualityDropdown: React.FC<StreamQualityDropdownProps> = ({ onChange, value }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const listboxId = useId();
    const selectedLabel = qualityLabels[value];

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!dropdownRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const selectQuality = (quality: StreamQuality) => {
        onChange(quality);
        setIsOpen(false);
    };

    return (
        <div className="stream-quality-dropdown" ref={dropdownRef}>
            <span className="stream-quality-label" id={`${listboxId}-label`}>Qualidade</span>
            <button
                aria-controls={listboxId}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-labelledby={`${listboxId}-label ${listboxId}-value`}
                className="stream-quality-trigger"
                onClick={() => setIsOpen((current) => !current)}
                type="button"
            >
                <span id={`${listboxId}-value`}>{selectedLabel}</span>
                <span aria-hidden="true" className="stream-quality-chevron" />
            </button>

            {isOpen && (
                <div
                    aria-labelledby={`${listboxId}-label`}
                    className="stream-quality-menu"
                    id={listboxId}
                    role="listbox"
                >
                    {STREAM_QUALITY_OPTIONS.map((quality) => (
                        <button
                            aria-selected={quality === value}
                            className={quality === value ? 'stream-quality-option active' : 'stream-quality-option'}
                            key={quality}
                            onClick={() => selectQuality(quality)}
                            role="option"
                            type="button"
                        >
                            <span>{qualityLabels[quality]}</span>
                            <span aria-hidden="true" className="stream-quality-check" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const WatchPage: React.FC<WatchPageProps> = ({
    layoutMode,
    onAddStream,
    onLayoutModeChange,
    onRemoveStream,
    onStreamQualityChange,
    streamQuality,
    streams,
}) => {
    const exitFullscreen = () => {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen();
        }
    };

    return (
        <main className="watch-page">
            <div className="watch-toolbar">
                <div>
                    <span className="watch-kicker">Watch</span>
                    <strong>{streams.length} streams</strong>
                </div>

                <div className="watch-controls">
                    <StreamQualityDropdown
                        onChange={onStreamQualityChange}
                        value={streamQuality}
                    />

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

                    <button
                        aria-label="Sair do fullscreen"
                        className="fullscreen-exit-button"
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
                            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                        </svg>
                    </button>
                </div>
            </div>

            <StreamDashboard
                layoutMode={layoutMode}
                onRemoveStream={onRemoveStream}
                streamQuality={streamQuality}
                streams={streams}
            />

            <AddStreamButton onClick={onAddStream} />
        </main>
    );
};

export default WatchPage;
