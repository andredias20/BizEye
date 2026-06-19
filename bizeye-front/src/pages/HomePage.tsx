import './HomePage.css';

import type { CreatorProfile, Platform, Stream } from '../types';

const GITHUB_PROFILE_URL = 'https://github.com/andredias20';

interface HomePageProps {
    activeStreams: Stream[];
    featuredCreatorsError: string | null;
    featuredCreators: CreatorProfile[];
    isFeaturedCreatorsLoading: boolean;
    onAddStream: (id: string, platform: Platform, title?: string, chatIdentifier?: string) => void;
    onOpenAddModal: () => void;
    onOpenLives: () => void;
    onOpenWatch: () => void;
}

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

const statusLabels = {
    error: 'Erro',
    live: 'Ao vivo',
    offline: 'Offline',
    unavailable: 'Indisponivel',
    video: 'Video comum',
};

const getCreatorStatus = (creator: CreatorProfile, activeStream?: Stream) => {
    const liveStatus = activeStream?.liveStatus ?? creator.liveStatus;

    if (liveStatus === 'live') return 'live';
    if (liveStatus === 'offline') return 'offline';
    if (liveStatus === 'error') return 'error';
    if (activeStream?.videoId || creator.videoId) return 'video';

    return 'unavailable';
};

const HomePage: React.FC<HomePageProps> = ({
    activeStreams,
    featuredCreatorsError,
    featuredCreators,
    isFeaturedCreatorsLoading,
    onAddStream,
    onOpenAddModal,
    onOpenLives,
    onOpenWatch,
}) => {
    const handleFeaturedAdd = (creator: CreatorProfile) => {
        onAddStream(creator.id, creator.platform, creator.title, creator.chatIdentifier);
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
                        Organize lives ativas e mantenha uma fila separada para videos do YouTube.
                    </p>
                    <div className="hero-actions">
                        <button className="primary-action" type="button" onClick={onOpenLives}>
                            Abrir Lives
                        </button>
                        <button className="secondary-action" type="button" onClick={onOpenWatch}>
                            Abrir Watch
                        </button>
                        <button className="secondary-action" type="button" onClick={onOpenAddModal}>
                            Inserir canal
                        </button>
                        <a className="github-action" href={GITHUB_PROFILE_URL} rel="noreferrer" target="_blank">
                            GitHub
                        </a>
                    </div>
                    <div className="hero-metrics" aria-label="Resumo">
                        <div>
                            <strong>{activeStreams.length}</strong>
                            <span>cards ativos</span>
                        </div>
                        <div>
                            <strong>5</strong>
                            <span>modos Lives</span>
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
                                <span>{stream.title || stream.platform}</span>
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
                    <span>Recomendacoes</span>
                    <h2>Lives recomendadas</h2>
                </div>

                {isFeaturedCreatorsLoading ? (
                    <div className="creator-grid creator-grid--state" aria-busy="true">
                        <span className="home-spinner" aria-hidden="true" />
                        <p>Carregando recomendacoes...</p>
                    </div>
                ) : featuredCreatorsError ? (
                    <div className="creator-grid creator-grid--state">
                        <p>{featuredCreatorsError}</p>
                    </div>
                ) : featuredCreators.length === 0 ? (
                    <div className="creator-grid creator-grid--state">
                        <p>Nenhuma recomendacao disponivel.</p>
                    </div>
                ) : (
                    <div className="creator-grid">
                        {featuredCreators.map((creator) => {
                        const active = isStreamActive(activeStreams, creator);
                        const activeStream = activeStreams.find((stream) => (
                            stream.id === creator.id && stream.platform === creator.platform
                        ));
                        const status = getCreatorStatus(creator, activeStream);
                        const streamTitle = activeStream?.title && activeStream.title !== creator.title
                            ? activeStream.title
                            : undefined;

                        return (
                            <article className="creator-card" key={`${creator.platform}-${creator.id}`}>
                                <div className="creator-avatar">
                                    {creator.thumbnail ? (
                                        <img src={creator.thumbnail} alt="" />
                                    ) : (
                                        <span>{getInitials(creator.title || creator.id)}</span>
                                    )}
                                </div>
                                <div className="creator-info">
                                    <h3>{creator.title}</h3>
                                    {streamTitle && <p className="creator-live-title">{streamTitle}</p>}
                                    <p>{creator.description}</p>
                                    <div className="creator-meta">
                                        <span className={`creator-status creator-status--${status}`}>
                                            {statusLabels[status]}
                                        </span>
                                        <span>{creator.platform}</span>
                                    </div>
                                </div>
                                <button
                                    className={active ? 'creator-action active' : 'creator-action'}
                                    disabled={active}
                                    onClick={() => handleFeaturedAdd(creator)}
                                    type="button"
                                >
                                    {active ? 'Nas Lives' : 'Adicionar'}
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
