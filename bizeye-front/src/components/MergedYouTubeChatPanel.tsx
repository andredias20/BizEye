import { useEffect, useMemo, useState } from 'react';
import './MergedYouTubeChatPanel.css';
import { canOpenMergedStreamChatTransport, openMergedStreamChat } from '../services/streamChat';

import type { ChatTransport, Stream } from '../types';
import type { StreamChatMessage, StreamChatSourceInput, StreamChatSourceState } from '../services/streamChat';

interface MergedYouTubeChatPanelProps {
    enabled: boolean;
    streams: Stream[];
    transport: ChatTransport;
}

type ConnectionState = 'idle' | 'connecting' | 'live' | 'error';

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const MAX_MESSAGES = 80;

const getChatSource = (stream: Stream): StreamChatSourceInput | null => {
    if (stream.platform === 'youtube') {
        if (stream.videoId && YOUTUBE_VIDEO_ID_PATTERN.test(stream.videoId)) {
            return { identifier: stream.videoId, platform: 'youtube', title: stream.title };
        }

        if (!stream.id.startsWith('UC') && YOUTUBE_VIDEO_ID_PATTERN.test(stream.id)) {
            return { identifier: stream.id, platform: 'youtube', title: stream.title };
        }

        return null;
    }

    if (stream.platform === 'kick') {
        return { identifier: stream.chatIdentifier || stream.id, platform: 'kick', title: stream.title || stream.id };
    }

    if (stream.platform === 'twitch') {
        return { identifier: stream.id, platform: 'twitch', title: stream.title };
    }

    return null;
};

const getMessageKey = (message: StreamChatMessage) => `${message.platform}:${message.identifier}:${message.id}`;

const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const mergeMessages = (previous: StreamChatMessage[], incoming: StreamChatMessage[]) => {
    const seen = new Set(previous.map(getMessageKey));
    const next = [...previous];

    for (const message of incoming) {
        const key = getMessageKey(message);
        if (seen.has(key)) continue;

        seen.add(key);
        next.push(message);
    }

    return next.slice(-MAX_MESSAGES);
};

const getStatusLabel = (state: StreamChatSourceState) => {
    if (state.status === 'live') return 'live';
    if (state.status === 'chat_unavailable') return 'sem chat';
    if (state.status === 'not_found') return 'nao encontrada';
    if (state.status === 'offline') return 'offline';
    if (state.status === 'unsupported') return 'sem conector';

    return 'erro';
};

const getPlatformLabel = (platform: StreamChatMessage['platform'] | StreamChatSourceState['platform']) => {
    if (platform === 'youtube') return 'YT';
    if (platform === 'twitch') return 'TW';
    return 'KICK';
};

const MergedYouTubeChatPanel: React.FC<MergedYouTubeChatPanelProps> = ({ enabled, streams, transport }) => {
    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [messages, setMessages] = useState<StreamChatMessage[]>([]);
    const [sources, setSources] = useState<StreamChatSourceState[]>([]);

    const chatSources = useMemo(() => (
        streams.map(getChatSource).filter((value): value is StreamChatSourceInput => Boolean(value))
    ), [streams]);
    const canStream = enabled && chatSources.length > 0;
    const sourcesKey = chatSources.map((source) => `${source.platform}:${source.identifier}`).join(',');

    useEffect(() => {
        if (!canStream) return;

        const resetTimer = window.setTimeout(() => {
            setConnectionState('connecting');
            setMessages([]);
            setSources([]);
        }, 0);

        const close = openMergedStreamChat(
            transport,
            chatSources,
            (event) => {
                if (event.type === 'connected') {
                    setConnectionState('live');
                    return;
                }

                if (event.type === 'source-state') {
                    setSources(event.sources);
                    return;
                }

                if (event.type === 'chat-message') {
                    setConnectionState('live');
                    setMessages((current) => mergeMessages(current, [event.message]));
                    return;
                }

                if (event.type === 'error') {
                    setConnectionState('error');
                }
            },
            () => setConnectionState('error'),
        );

        if (!close) {
            const unavailableTimer = window.setTimeout(() => {
                setConnectionState(canOpenMergedStreamChatTransport(transport) ? 'idle' : 'error');
            }, 0);

            return () => {
                window.clearTimeout(resetTimer);
                window.clearTimeout(unavailableTimer);
            };
        }

        return () => {
            window.clearTimeout(resetTimer);
            close();
        };
    }, [canStream, chatSources, sourcesKey, transport]);

    if (!canStream) return null;

    return (
        <aside className="merged-chat-panel" aria-label="Chat unificado">
            <div className="merged-chat-header">
                <div>
                    <span>Chat merge</span>
                    <strong>{messages.length} msgs</strong>
                </div>
                <span className={`merged-chat-state merged-chat-state--${connectionState}`}>
                    {connectionState}
                </span>
            </div>

            {sources.length > 0 && (
                <div className="merged-chat-sources" aria-label="Fontes do chat">
                    {sources.map((source) => (
                        <span
                            className={`merged-chat-source merged-chat-source--${source.status}`}
                            key={`${source.platform}-${source.identifier}`}
                        >
                            <em className={`merged-chat-platform merged-chat-platform--${source.platform}`}>
                                {getPlatformLabel(source.platform)}
                            </em>
                            {source.title || source.identifier}
                            <small>{getStatusLabel(source)}</small>
                        </span>
                    ))}
                </div>
            )}

            <div className="merged-chat-list" aria-live="polite">
                {messages.length === 0 ? (
                    <p className="merged-chat-empty">Aguardando mensagens.</p>
                ) : (
                    messages.map((message) => (
                        <article className="merged-chat-message" key={getMessageKey(message)}>
                            <div className="merged-chat-message-top">
                                <strong>
                                    <em className={`merged-chat-platform merged-chat-platform--${message.platform}`}>
                                        {getPlatformLabel(message.platform)}
                                    </em>
                                    {message.authorName}
                                </strong>
                                <time dateTime={message.publishedAt}>{formatTime(message.publishedAt)}</time>
                            </div>
                            <p>{message.message}</p>
                            <span>{message.sourceTitle || message.identifier}</span>
                        </article>
                    ))
                )}
            </div>
        </aside>
    );
};

export default MergedYouTubeChatPanel;
