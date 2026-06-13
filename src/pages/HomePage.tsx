import { useState } from 'react';
import './HomePage.css';
import { featuredCreators } from '../data/creators';

import type { CreatorProfile, Platform, Stream } from '../types';

type YoutubeSearchResponse = {
    items?: Array<{
        id?: {
            channelId?: string;
        };
        snippet?: {
            title?: string;
            description?: string;
            thumbnails?: {
                medium?: {
                    url?: string;
                };
            };
        };
    }>;
};

type ChannelResult = {
    id: string;
    title: string;
    description: string;
    thumbnail?: string;
};

interface HomePageProps {
    activeStreams: Stream[];
    onAddStream: (id: string, platform: Platform, title?: string, fallbackVideoId?: string) => void;
    onOpenAddModal: () => void;
    onOpenWatch: () => void;
}

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

const isStreamActive = (streams: Stream[], creator: Pick<Stream, 'id' | 'platform'>) => {
    return streams.some((stream) => stream.id === creator.id && stream.platform === creator.platform);
};

const getInitials = (title: string) => {
    return title
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
};

const HomePage: React.FC<HomePageProps> = ({ activeStreams, onAddStream, onOpenAddModal, onOpenWatch }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ChannelResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const handleFeaturedAdd = (creator: CreatorProfile) => {
        onAddStream(creator.id, creator.platform, creator.title, creator.fallbackVideoId);
    };

    const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const cleanQuery = query.trim();

        if (!cleanQuery) return;

        setSearchError(null);
        setResults([]);

        if (!YOUTUBE_API_KEY) {
            setSearchError('Configure VITE_YOUTUBE_API_KEY para pesquisar canais do YouTube.');
            return;
        }

        setIsSearching(true);

        try {
            const params = new URLSearchParams({
                part: 'snippet',
                maxResults: '6',
                q: cleanQuery,
                type: 'channel',
                key: YOUTUBE_API_KEY,
            });
            const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Nao foi possivel pesquisar canais agora.');
            }

            const data = await response.json() as YoutubeSearchResponse;
            const channels = data.items
                ?.map((item): ChannelResult | null => {
                    const id = item.id?.channelId;
                    if (!id) return null;

                    return {
                        id,
                        title: item.snippet?.title || id,
                        description: item.snippet?.description || 'Canal do YouTube',
                        thumbnail: item.snippet?.thumbnails?.medium?.url,
                    };
                })
                .filter((item): item is ChannelResult => Boolean(item)) || [];

            setResults(channels);
            if (channels.length === 0) {
                setSearchError('Nenhum canal encontrado para essa busca.');
            }
        } catch (error) {
            setSearchError(error instanceof Error ? error.message : 'Erro inesperado na busca.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <main className="home-page">
            <section className="home-hero">
                <div className="hero-copy">
                    <div className="eyebrow">
                        <span />
                        Live control room
                    </div>
                    <h1>BIZ EYE</h1>
                    <p className="hero-lead">
                        Organize criadores, encontre canais e jogue as lives ativas para uma tela sem scroll.
                    </p>
                    <div className="hero-actions">
                        <button className="primary-action" type="button" onClick={onOpenWatch}>
                            Abrir Watch
                        </button>
                        <button className="secondary-action" type="button" onClick={onOpenAddModal}>
                            Inserir canal
                        </button>
                    </div>
                    <div className="hero-metrics" aria-label="Resumo">
                        <div>
                            <strong>{activeStreams.length}</strong>
                            <span>cards ativos</span>
                        </div>
                        <div>
                            <strong>5</strong>
                            <span>modos Watch</span>
                        </div>
                        <div>
                            <strong>3</strong>
                            <span>plataformas</span>
                        </div>
                    </div>
                </div>

                <div className="hero-stage" aria-hidden="true">
                    <div className="stage-topline">
                        <span className="stage-dot" />
                        transmitindo agora
                    </div>
                    <div className="stage-grid">
                        {activeStreams.slice(0, 4).map((stream) => (
                            <div className="stage-tile" key={`${stream.platform}-${stream.id}`}>
                                <span>{stream.title || stream.id}</span>
                                <small>{stream.platform}</small>
                            </div>
                        ))}
                    </div>
                    <div className="stage-timeline">
                        <span />
                        <span />
                        <span />
                    </div>
                </div>
            </section>

            <section className="home-section">
                <div className="section-heading">
                    <span>Criadores iniciais</span>
                    <h2>Comece com a lista base</h2>
                </div>

                <div className="creator-grid">
                    {featuredCreators.map((creator) => {
                        const active = isStreamActive(activeStreams, creator);

                        return (
                            <article className="creator-card" key={`${creator.platform}-${creator.id}`}>
                                <div className="creator-avatar">{getInitials(creator.title || creator.id)}</div>
                                <div className="creator-info">
                                    <h3>{creator.title}</h3>
                                    <p>{creator.description}</p>
                                    <code>{creator.id}</code>
                                </div>
                                <button
                                    className={active ? 'creator-action active' : 'creator-action'}
                                    disabled={active}
                                    onClick={() => handleFeaturedAdd(creator)}
                                    type="button"
                                >
                                    {active ? 'Na Watch' : 'Adicionar'}
                                </button>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="home-section search-section">
                <div className="section-heading">
                    <span>Pesquisa YouTube</span>
                    <h2>Encontrar canais</h2>
                </div>

                <form className="channel-search" onSubmit={handleSearch}>
                    <input
                        aria-label="Buscar canais"
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Nome, @handle ou palavra-chave"
                        type="search"
                        value={query}
                    />
                    <button disabled={isSearching} type="submit">
                        {isSearching ? 'Buscando' : 'Buscar'}
                    </button>
                </form>

                {searchError && <p className="search-message">{searchError}</p>}

                {results.length > 0 && (
                    <div className="search-results">
                        {results.map((result) => {
                            const active = isStreamActive(activeStreams, { id: result.id, platform: 'youtube' });

                            return (
                                <article className="result-card" key={result.id}>
                                    {result.thumbnail ? (
                                        <img src={result.thumbnail} alt="" />
                                    ) : (
                                        <div className="result-avatar">{getInitials(result.title)}</div>
                                    )}
                                    <div>
                                        <h3>{result.title}</h3>
                                        <p>{result.description}</p>
                                        <code>{result.id}</code>
                                    </div>
                                    <button
                                        disabled={active}
                                        onClick={() => onAddStream(result.id, 'youtube', result.title)}
                                        type="button"
                                    >
                                        {active ? 'Na Watch' : 'Adicionar'}
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
};

export default HomePage;
