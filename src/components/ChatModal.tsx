import React, { useEffect, useMemo, useState } from 'react';
import type { Stream } from '../types';
import './ChatModal.css';

type ChatViewMode = 'focused' | 'grid';

type YoutubeLiveSearchResponse = {
    items?: Array<{
        id?: {
            videoId?: string;
        };
    }>;
};

type YoutubeChatState =
    | { status: 'ready'; videoId: string }
    | { status: 'loading' }
    | { status: 'unavailable'; message: string };

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    streams: Stream[];
}

interface ChatFrameProps {
    compact?: boolean;
    stream: Stream;
}

const platformLabels: Record<Stream['platform'], string> = {
    youtube: 'YouTube',
    twitch: 'Twitch',
    kick: 'Kick',
};

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

const getStreamKey = (stream: Pick<Stream, 'id' | 'platform'>) => `${stream.platform}:${stream.id}`;

const getStreamTitle = (stream?: Stream) => stream?.title || (stream ? `@${stream.id}` : 'Stream');

const getEmbedDomain = () => {
    if (typeof window === 'undefined') return 'localhost';
    return window.location.hostname || 'localhost';
};

const getExternalUrl = (stream: Stream) => {
    if (stream.platform === 'youtube') {
        return stream.id.startsWith('UC')
            ? `https://www.youtube.com/channel/${stream.id}/live`
            : `https://www.youtube.com/watch?v=${stream.id}`;
    }

    if (stream.platform === 'twitch') {
        return `https://www.twitch.tv/${stream.id}`;
    }

    return `https://kick.com/${stream.id}`;
};

const fetchYoutubeLiveVideoId = async (channelId: string): Promise<string | null> => {
    if (!YOUTUBE_API_KEY) return null;

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&type=video&eventType=live&key=${YOUTUBE_API_KEY}`
        );

        if (!response.ok) return null;

        const data = await response.json() as YoutubeLiveSearchResponse;
        return data.items?.[0]?.id?.videoId || null;
    } catch (error) {
        console.warn('Could not resolve YouTube live chat video ID:', error);
        return null;
    }
};

const useYoutubeChatState = (stream: Stream): YoutubeChatState => {
    const needsLiveLookup = stream.platform === 'youtube' && stream.id.startsWith('UC');
    const [chatState, setChatState] = useState<YoutubeChatState>(() => {
        if (stream.platform !== 'youtube') {
            return { status: 'unavailable', message: 'Chat externo indisponivel para esta plataforma.' };
        }

        if (!needsLiveLookup) {
            return { status: 'ready', videoId: stream.id };
        }

        return { status: 'loading' };
    });

    useEffect(() => {
        if (!needsLiveLookup) return;

        let isActive = true;

        const resolveLiveVideoId = async () => {
            await Promise.resolve();

            if (!YOUTUBE_API_KEY) {
                if (isActive) {
                    setChatState({
                        status: 'unavailable',
                        message: 'YouTube requer VITE_YOUTUBE_API_KEY para localizar o chat da live pelo canal.',
                    });
                }
                return;
            }

            const videoId = await fetchYoutubeLiveVideoId(stream.id);

            if (!isActive) return;

            setChatState(
                videoId
                    ? { status: 'ready', videoId }
                    : {
                        status: 'unavailable',
                        message: 'Nenhuma live ativa foi localizada para este canal agora.',
                    }
            );
        };

        void resolveLiveVideoId();

        return () => {
            isActive = false;
        };
    }, [needsLiveLookup, stream.id]);

    return chatState;
};

const ChatUnavailable: React.FC<{ message: string; stream: Stream }> = ({ message, stream }) => (
    <div className="chat-unavailable">
        <strong>Chat indisponivel no embed</strong>
        <span>{message}</span>
        <a href={getExternalUrl(stream)} rel="noreferrer" target="_blank">
            Abrir na plataforma
        </a>
    </div>
);

const ChatFrame: React.FC<ChatFrameProps> = ({ compact = false, stream }) => {
    const youtubeChatState = useYoutubeChatState(stream);
    const embedDomain = getEmbedDomain();

    const chatSource = useMemo(() => {
        if (stream.platform === 'twitch') {
            return `https://www.twitch.tv/embed/${encodeURIComponent(stream.id)}/chat?parent=${encodeURIComponent(embedDomain)}&darkpopout`;
        }

        if (stream.platform === 'kick') {
            return `https://kick.com/popout/${encodeURIComponent(stream.id)}/chat`;
        }

        if (youtubeChatState.status === 'ready') {
            return `https://www.youtube.com/live_chat?v=${encodeURIComponent(youtubeChatState.videoId)}&embed_domain=${encodeURIComponent(embedDomain)}`;
        }

        return null;
    }, [embedDomain, stream.id, stream.platform, youtubeChatState]);

    return (
        <section className={compact ? 'chat-panel chat-panel--compact' : 'chat-panel'}>
            <div className="chat-panel-header">
                <div>
                    <span>{platformLabels[stream.platform]}</span>
                    <strong>{getStreamTitle(stream)}</strong>
                </div>
                <a href={getExternalUrl(stream)} rel="noreferrer" target="_blank">
                    Externo
                </a>
            </div>

            {stream.platform === 'youtube' && youtubeChatState.status === 'loading' ? (
                <div className="chat-loading">
                    <span>Conectando chat...</span>
                </div>
            ) : stream.platform === 'youtube' && youtubeChatState.status === 'unavailable' ? (
                <ChatUnavailable message={youtubeChatState.message} stream={stream} />
            ) : chatSource ? (
                <iframe
                    className="chat-embed"
                    src={chatSource}
                    title={`Chat ${platformLabels[stream.platform]} ${getStreamTitle(stream)}`}
                />
            ) : (
                <ChatUnavailable message="A plataforma nao fornece um chat embutido para este identificador." stream={stream} />
            )}
        </section>
    );
};

const ChatModal: React.FC<ChatModalProps> = ({
    isOpen,
    onClose,
    streams,
}) => {
    const [viewMode, setViewMode] = useState<ChatViewMode>('focused');
    const [selectedStreamKey, setSelectedStreamKey] = useState('');

    const streamByKey = useMemo(() => {
        const map = new Map<string, Stream>();
        streams.forEach((stream) => map.set(getStreamKey(stream), stream));
        return map;
    }, [streams]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const fallbackStreamKey = streams[0] ? getStreamKey(streams[0]) : '';
    const effectiveSelectedStreamKey = streamByKey.has(selectedStreamKey) ? selectedStreamKey : fallbackStreamKey;
    const selectedStream = streamByKey.get(effectiveSelectedStreamKey);

    return (
        <div className="chat-modal-overlay" onClick={onClose}>
            <section
                aria-modal="true"
                className="chat-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <button className="chat-modal-close" onClick={onClose} title="Fechar chat" type="button">
                    x
                </button>

                <header className="chat-modal-header">
                    <div>
                        <span className="chat-modal-kicker">Live chat</span>
                        <h2>Chats das streams</h2>
                    </div>

                    <div className="chat-mode-toggle" aria-label="Visualizacao do chat">
                        <button
                            className={viewMode === 'focused' ? 'active' : ''}
                            onClick={() => setViewMode('focused')}
                            type="button"
                        >
                            Foco
                        </button>
                        <button
                            className={viewMode === 'grid' ? 'active' : ''}
                            onClick={() => setViewMode('grid')}
                            type="button"
                        >
                            Todos
                        </button>
                    </div>
                </header>

                {streams.length === 0 ? (
                    <div className="chat-empty-state">
                        <h3>Sem streams ativas</h3>
                        <p>Adicione uma live para abrir o chat.</p>
                    </div>
                ) : viewMode === 'focused' ? (
                    <div className="chat-workspace chat-workspace--focused">
                        <div className="chat-stream-picker" aria-label="Live para visualizar">
                            {streams.map((stream) => {
                                const streamKey = getStreamKey(stream);

                                return (
                                    <button
                                        className={effectiveSelectedStreamKey === streamKey ? 'active' : ''}
                                        key={streamKey}
                                        onClick={() => setSelectedStreamKey(streamKey)}
                                        title={`Visualizar ${getStreamTitle(stream)}`}
                                        type="button"
                                    >
                                        <span>{getStreamTitle(stream)}</span>
                                        <small>{platformLabels[stream.platform]}</small>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedStream && <ChatFrame key={effectiveSelectedStreamKey} stream={selectedStream} />}
                    </div>
                ) : (
                    <div className="chat-workspace chat-workspace--grid">
                        {streams.map((stream) => (
                            <ChatFrame compact key={getStreamKey(stream)} stream={stream} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default ChatModal;
