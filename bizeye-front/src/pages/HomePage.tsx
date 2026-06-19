import './HomePage.css';

import type { CreatorProfile, Platform, Stream } from '../types';

const GITHUB_PROFILE_URL = 'https://github.com/andredias20';

interface HomePageProps {
    activeStreams: Stream[];
    featuredCreators: CreatorProfile[];
    onAddStream: (id: string, platform: Platform, title?: string, chatIdentifier?: string) => void;
    onOpenAddModal: () => void;
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

const HomePage: React.FC<HomePageProps> = ({
    activeStreams,
    featuredCreators,
    onAddStream,
    onOpenAddModal,
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
                        Organize criadores recomendados e jogue as lives ativas para uma tela sem scroll.
                    </p>
                    <div className="hero-actions">
                        <button className="primary-action" type="button" onClick={onOpenWatch}>
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
                                    <code>{creator.handle || creator.id}</code>
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
        </main>
    );
};

export default HomePage;
