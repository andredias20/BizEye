import { useEffect, useMemo, useRef, useState } from 'react';
import './WatchPage.css';
import { fetchYoutubeVideoMetadata } from '../services/youtubeResolver';
import { loadStoredYoutubeQueue, saveStoredYoutubeQueue } from '../storage/preferences';

import type { CSSProperties, FormEvent } from 'react';
import type { YouTubeQueueItem } from '../types';

type ParsedYoutubeInput = {
    startSeconds?: number;
    url: string;
    videoId: string;
};

type QueueLayoutMode = 'split' | 'wide';

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

const getQueueKey = (item: Pick<YouTubeQueueItem, 'id' | 'startSeconds'>) => `${item.id}:${item.startSeconds ?? 0}`;

const parseTimeToken = (value: string | null) => {
    if (!value) return undefined;

    const cleanValue = value.trim().toLowerCase();
    if (!cleanValue) return undefined;

    if (/^\d+$/.test(cleanValue)) {
        return Number(cleanValue);
    }

    const colonParts = cleanValue.split(':').map((part) => Number(part));
    if (colonParts.length > 1 && colonParts.every((part) => Number.isFinite(part))) {
        return colonParts.reduce((total, part) => total * 60 + part, 0);
    }

    const match = cleanValue.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (!match) return undefined;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const total = hours * 3600 + minutes * 60 + seconds;

    return total > 0 ? total : undefined;
};

const parseYoutubeInput = (input: string): ParsedYoutubeInput | null => {
    const cleanInput = input.trim();
    if (!cleanInput) return null;

    if (YOUTUBE_VIDEO_ID_PATTERN.test(cleanInput)) {
        return {
            url: `https://www.youtube.com/watch?v=${cleanInput}`,
            videoId: cleanInput,
        };
    }

    try {
        const url = new URL(cleanInput.includes('://') ? cleanInput : `https://${cleanInput}`);
        const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
        const pathParts = url.pathname.split('/').filter(Boolean);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const startSeconds =
            parseTimeToken(url.searchParams.get('t')) ??
            parseTimeToken(url.searchParams.get('start')) ??
            parseTimeToken(hashParams.get('t'));

        let videoId: string | null = null;
        if (host === 'youtu.be') {
            videoId = pathParts[0] ?? null;
        } else if (host.endsWith('youtube.com')) {
            if (url.pathname === '/watch') {
                videoId = url.searchParams.get('v');
            } else if (['embed', 'shorts', 'live'].includes(pathParts[0] ?? '')) {
                videoId = pathParts[1] ?? null;
            }
        }

        if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) return null;

        const canonicalUrl = new URL(`https://www.youtube.com/watch?v=${videoId}`);
        if (startSeconds) canonicalUrl.searchParams.set('t', String(startSeconds));

        return {
            startSeconds,
            url: canonicalUrl.toString(),
            videoId,
        };
    } catch {
        return null;
    }
};

const parseIsoDuration = (duration?: string) => {
    if (!duration) return undefined;

    const match = duration.match(/^P(?:\d+Y)?(?:\d+M)?(?:\d+W)?(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return undefined;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    const total = hours * 3600 + minutes * 60 + seconds;

    return total > 0 ? total : undefined;
};

const formatSeconds = (value?: number) => {
    if (value === undefined) return '--:--';

    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = value % 60;
    const parts = hours > 0
        ? [hours, minutes.toString().padStart(2, '0'), seconds.toString().padStart(2, '0')]
        : [minutes, seconds.toString().padStart(2, '0')];

    return parts.join(':');
};

const createEmbedUrl = (item: YouTubeQueueItem) => {
    const url = new URL(`https://www.youtube.com/embed/${item.id}`);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    url.searchParams.set('autoplay', '1');
    url.searchParams.set('controls', '1');
    url.searchParams.set('modestbranding', '1');
    url.searchParams.set('playsinline', '1');
    url.searchParams.set('rel', '0');
    if (origin) url.searchParams.set('origin', origin);
    if (item.startSeconds) url.searchParams.set('start', String(item.startSeconds));

    return url.toString();
};

const WatchPage: React.FC = () => {
    const playerFooterRef = useRef<HTMLDivElement | null>(null);
    const playerSectionRef = useRef<HTMLElement | null>(null);
    const [queue, setQueue] = useState<YouTubeQueueItem[]>(loadStoredYoutubeQueue);
    const [activeKey, setActiveKey] = useState(() => {
        const initialQueue = loadStoredYoutubeQueue();
        return initialQueue[0] ? getQueueKey(initialQueue[0]) : '';
    });
    const [inputValue, setInputValue] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [layoutMode, setLayoutMode] = useState<QueueLayoutMode>('split');
    const [playerMaxWidth, setPlayerMaxWidth] = useState<number | null>(null);

    const activeItem = useMemo(() => {
        return queue.find((item) => getQueueKey(item) === activeKey) ?? queue[0] ?? null;
    }, [activeKey, queue]);

    const embedUrl = useMemo(() => activeItem ? createEmbedUrl(activeItem) : '', [activeItem]);

    useEffect(() => {
        const section = playerSectionRef.current;
        if (!section) return;

        let frameId = 0;
        const measurePlayerBounds = () => {
            if (frameId) return;

            frameId = window.requestAnimationFrame(() => {
                frameId = 0;

                const sectionRect = section.getBoundingClientRect();
                const sectionStyle = window.getComputedStyle(section);
                const horizontalPadding = parseFloat(sectionStyle.paddingLeft) + parseFloat(sectionStyle.paddingRight);
                const verticalPadding = parseFloat(sectionStyle.paddingTop) + parseFloat(sectionStyle.paddingBottom);
                const footerHeight = playerFooterRef.current?.getBoundingClientRect().height ?? 0;
                const availableWidth = Math.max(0, sectionRect.width - horizontalPadding);
                const availableHeight = Math.max(0, sectionRect.height - verticalPadding - footerHeight);
                const maxWidthByHeight = availableHeight > 0 ? availableHeight * (16 / 9) : availableWidth;
                const nextMaxWidth = Math.floor(Math.min(availableWidth, maxWidthByHeight));

                setPlayerMaxWidth((currentMaxWidth) => (
                    currentMaxWidth === nextMaxWidth ? currentMaxWidth : nextMaxWidth
                ));
            });
        };

        measurePlayerBounds();

        const observer = new ResizeObserver(measurePlayerBounds);
        observer.observe(section);
        if (playerFooterRef.current) observer.observe(playerFooterRef.current);
        window.addEventListener('resize', measurePlayerBounds);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            observer.disconnect();
            window.removeEventListener('resize', measurePlayerBounds);
        };
    }, [activeItem?.id, activeItem?.startSeconds, layoutMode, queue.length]);

    const playerShellStyle: CSSProperties | undefined = playerMaxWidth
        ? { width: `${playerMaxWidth}px` }
        : undefined;

    const commitQueue = (getNextQueue: (items: YouTubeQueueItem[]) => YouTubeQueueItem[]) => {
        setQueue((currentQueue) => {
            const nextQueue = getNextQueue(currentQueue);
            saveStoredYoutubeQueue(nextQueue);
            return nextQueue;
        });
    };

    const addVideo = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const parsed = parseYoutubeInput(inputValue);
        if (!parsed) {
            setMessage('Informe um link de video do YouTube valido.');
            return;
        }

        const nextKey = `${parsed.videoId}:${parsed.startSeconds ?? 0}`;
        const existingItem = queue.find((item) => getQueueKey(item) === nextKey);
        if (existingItem) {
            setMessage('Video ja esta na fila.');
            setInputValue('');
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            const metadata = await fetchYoutubeVideoMetadata(parsed.videoId);
            const durationSeconds = metadata.durationSeconds ?? parseIsoDuration(metadata.duration);
            const nextItem: YouTubeQueueItem = {
                addedAt: new Date().toISOString(),
                channelTitle: metadata.channelTitle,
                duration: metadata.duration,
                durationSeconds,
                id: parsed.videoId,
                startSeconds: parsed.startSeconds,
                thumbnail: metadata.thumbnail,
                title: metadata.title || parsed.videoId,
                url: parsed.url,
            };

            commitQueue((currentQueue) => [...currentQueue, nextItem]);
            setInputValue('');
        } catch (error) {
            console.warn('bizeye-watch: could not add YouTube video.', error);
            setMessage('Nao foi possivel carregar esse video agora.');
        } finally {
            setIsLoading(false);
        }
    };

    const removeVideo = (itemToRemove: YouTubeQueueItem) => {
        const removedKey = getQueueKey(itemToRemove);
        const nextQueue = queue.filter((item) => getQueueKey(item) !== removedKey);

        commitQueue(() => nextQueue);
        if (activeKey === removedKey) {
            setActiveKey(nextQueue[0] ? getQueueKey(nextQueue[0]) : '');
        }
    };

    return (
        <main className={`watch-page watch-page--${layoutMode}`}>
            <section className="watch-player-section" aria-label="Player YouTube" ref={playerSectionRef}>
                <div className="watch-player-shell" style={playerShellStyle}>
                    {activeItem ? (
                        <>
                            <div className="watch-player-frame">
                                <iframe
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    className="watch-player"
                                    key={getQueueKey(activeItem)}
                                    src={embedUrl}
                                    title={activeItem.title}
                                />
                            </div>

                            <div className="watch-player-footer" ref={playerFooterRef}>
                                <div className="watch-player-meta">
                                    <span>YouTube</span>
                                    <strong>{activeItem.title}</strong>
                                    <small>
                                        {formatSeconds(activeItem.durationSeconds)}
                                        {activeItem.startSeconds ? ` | inicio ${formatSeconds(activeItem.startSeconds)}` : ''}
                                    </small>
                                </div>

                                <div className="watch-player-actions" aria-label="Layout do player">
                                    <button
                                        aria-label="Maximizar player na horizontal"
                                        aria-pressed={layoutMode === 'wide'}
                                        className={layoutMode === 'wide' ? 'active' : ''}
                                        onClick={() => setLayoutMode('wide')}
                                        title="Maximizar player na horizontal"
                                        type="button"
                                    >
                                        <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                                            <path d="M4 8V5h6M20 8V5h-6M4 16v3h6M20 16v3h-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                    </button>
                                    <button
                                        aria-label="Mostrar lista ao lado"
                                        aria-pressed={layoutMode === 'split'}
                                        className={layoutMode === 'split' ? 'active' : ''}
                                        onClick={() => setLayoutMode('split')}
                                        title="Mostrar lista ao lado"
                                        type="button"
                                    >
                                        <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                                            <path d="M4 5h10v14H4zM17 5h3v14h-3" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="watch-empty-player">
                            <span>YouTube</span>
                            <strong>Fila vazia</strong>
                        </div>
                    )}
                </div>
            </section>

            <aside className="watch-queue-panel" aria-label="Fila de videos">
                <form className="watch-add-form" onSubmit={addVideo}>
                    <label htmlFor="watch-youtube-url">Video YouTube</label>
                    <div>
                        <input
                            autoComplete="off"
                            id="watch-youtube-url"
                            onChange={(event) => setInputValue(event.target.value)}
                            placeholder="youtube.com/watch?v=...&t=90"
                            type="text"
                            value={inputValue}
                        />
                        <button disabled={isLoading} type="submit">
                            {isLoading ? 'Buscando' : 'Adicionar'}
                        </button>
                    </div>
                    {message && <p className="watch-form-message">{message}</p>}
                </form>

                <div className="watch-queue-header">
                    <span>Fila</span>
                    <strong>{queue.length} videos</strong>
                </div>

                <div className="watch-queue-list">
                    {queue.length === 0 ? (
                        <div className="watch-queue-empty">
                            <strong>Nenhum video adicionado</strong>
                            <span>Cole um link do YouTube para montar a fila.</span>
                        </div>
                    ) : (
                        queue.map((item) => {
                            const itemKey = getQueueKey(item);
                            const isActive = activeItem ? itemKey === getQueueKey(activeItem) : false;

                            return (
                                <article className={isActive ? 'watch-queue-item active' : 'watch-queue-item'} key={itemKey}>
                                    <button
                                        aria-label={`Reproduzir ${item.title}`}
                                        className="watch-queue-thumb"
                                        onClick={() => setActiveKey(itemKey)}
                                        type="button"
                                    >
                                        {item.thumbnail ? (
                                            <img src={item.thumbnail} alt="" />
                                        ) : (
                                            <span>{item.id}</span>
                                        )}
                                    </button>
                                    <div className="watch-queue-info">
                                        <button onClick={() => setActiveKey(itemKey)} type="button">
                                            {item.title}
                                        </button>
                                        <p>
                                            {item.channelTitle || 'YouTube'}
                                            {' | '}
                                            {formatSeconds(item.durationSeconds)}
                                        </p>
                                        {item.startSeconds !== undefined && (
                                            <span>inicio {formatSeconds(item.startSeconds)}</span>
                                        )}
                                    </div>
                                    <button
                                        aria-label={`Remover ${item.title}`}
                                        className="watch-queue-remove"
                                        onClick={() => removeVideo(item)}
                                        title="Remover"
                                        type="button"
                                    >
                                        <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
                                            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                                        </svg>
                                    </button>
                                </article>
                            );
                        })
                    )}
                </div>
            </aside>
        </main>
    );
};

export default WatchPage;
