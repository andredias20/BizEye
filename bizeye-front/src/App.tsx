import { useCallback, useEffect, useRef, useState } from 'react'
import { FlagDefinitions, FlagValues } from 'flags/react'
import './App.css'
import Header from './components/Header'
import AddStreamModal from './components/AddStreamModal'
import AdminLivesPage from './pages/AdminLivesPage'
import AdminLoginPage from './pages/AdminLoginPage'
import FireTvPage from './pages/FireTvPage'
import HomePage from './pages/HomePage'
import WatchPage from './pages/WatchPage'
import { featuredCreators as fallbackFeaturedCreators, starterStreams } from './data/creators'
import { isFireTvLikeDevice } from './platform/fireTv'
import { resolveKickInput } from './services/kickResolver'
import { fetchRecommendedCreators } from './services/recommendedStreams'
import { fetchYoutubeLiveStatuses } from './services/youtubeResolver'
import {
  flagDefinitions,
  getBizeyeChatMergeFlagValue,
  getBizeyeChatTransportFlagValue,
  getBizeyeResolveFlagValue,
  getFlagValues,
  getInitialBizeyeChatMergeFlagValue,
  getInitialBizeyeChatTransportFlagValue,
  getInitialBizeyeResolveFlagValue,
} from './flags'
import {
  loadStoredStreams,
  loadStoredWatchChatPosition,
  loadStoredWatchLayout,
  mergeKnownStreamMetadata,
  saveStoredStreams,
  saveStoredWatchChatPosition,
  saveStoredWatchLayout,
} from './storage/preferences'

import type { ChatPanelPosition, ChatTransport, CreatorProfile, Platform, Stream, ViewLayoutMode } from './types'

type PublicAppPage = 'firetv' | 'home' | 'watch';
type AppPage = PublicAppPage | 'adminLives' | 'adminLogin';

type InitialStreamsState = {
  hadStoredStreams: boolean;
  streams: Stream[];
};

const getPageFromHash = (): AppPage => {
  const hashRoute = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');

  if (hashRoute === 'admin/login') {
    return 'adminLogin';
  }

  if (hashRoute === 'admin/lives') {
    return 'adminLives';
  }

  if (hashRoute === 'firetv' || hashRoute === 'watch') {
    return hashRoute;
  }

  if (window.location.hash) {
    return 'home';
  }

  const pathRoute = window.location.pathname.replace(/^\/+/, '').replace(/\/$/, '');

  if (pathRoute === 'admin/login') {
    return 'adminLogin';
  }

  if (pathRoute === 'admin/lives') {
    return 'adminLives';
  }

  if (pathRoute === 'firetv' || pathRoute === 'watch') {
    return pathRoute;
  }

  return 'home';
};

const getInitialStreamsState = (): InitialStreamsState => {
  const storedStreams = loadStoredStreams();
  const streams = storedStreams === null
    ? starterStreams
    : mergeKnownStreamMetadata(storedStreams, starterStreams);

  saveStoredStreams(streams);

  return {
    hadStoredStreams: storedStreams !== null,
    streams,
  };
};

const recommendedCreatorToStream = (creator: CreatorProfile): Stream => ({
  chatIdentifier: creator.chatIdentifier,
  id: creator.id,
  platform: creator.platform,
  title: creator.title,
});

function App() {
  const [initialStreamsState] = useState(getInitialStreamsState);
  const [activeStreams, setActiveStreams] = useState<Stream[]>(initialStreamsState.streams);
  const [featuredCreators, setFeaturedCreators] = useState<CreatorProfile[]>(fallbackFeaturedCreators);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>(getPageFromHash);
  const [bizeyeResolveFlagValue, setBizeyeResolveFlagValue] = useState(getInitialBizeyeResolveFlagValue);
  const [bizeyeChatMergeFlagValue, setBizeyeChatMergeFlagValue] = useState(getInitialBizeyeChatMergeFlagValue);
  const [bizeyeChatTransportFlagValue, setBizeyeChatTransportFlagValue] = useState<ChatTransport>(
    getInitialBizeyeChatTransportFlagValue,
  );
  const [chatPanelPosition, setChatPanelPosition] = useState<ChatPanelPosition>(() => loadStoredWatchChatPosition('right'));
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>(() => loadStoredWatchLayout('balanced'));
  const didAutoRedirectFireTv = useRef(false);
  const refreshedYoutubeChannels = useRef(new Set<string>());
  const attemptedKickChatroomResolutions = useRef(new Set<string>());

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(getPageFromHash());
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (didAutoRedirectFireTv.current || currentPage === 'firetv' || !isFireTvLikeDevice()) return;

    didAutoRedirectFireTv.current = true;
    window.location.hash = '/firetv';
  }, [currentPage]);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([
      getBizeyeResolveFlagValue(),
      getBizeyeChatMergeFlagValue(),
      getBizeyeChatTransportFlagValue(),
    ]).then(([resolveValue, chatMergeValue, chatTransportValue]) => {
      if (!isCancelled) {
        setBizeyeResolveFlagValue(resolveValue);
        setBizeyeChatMergeFlagValue(chatMergeValue);
        setBizeyeChatTransportFlagValue(chatTransportValue);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const updateActiveStreams = useCallback((getNextStreams: (streams: Stream[]) => Stream[]) => {
    setActiveStreams((previousStreams) => {
      const nextStreams = getNextStreams(previousStreams);

      if (nextStreams !== previousStreams) {
        saveStoredStreams(nextStreams);
      }

      return nextStreams;
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    fetchRecommendedCreators()
      .then((creators) => {
        if (isCancelled || creators.length === 0) return;

        setFeaturedCreators(creators);
        updateActiveStreams((streams) => {
          const recommendedStreams = creators.map(recommendedCreatorToStream);

          return initialStreamsState.hadStoredStreams
            ? mergeKnownStreamMetadata(streams, recommendedStreams)
            : recommendedStreams;
        });
      })
      .catch((error) => {
        console.warn('bizeye-recommendations: backend recommendations unavailable; using local fallback.', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [initialStreamsState.hadStoredStreams, updateActiveStreams]);

  const applyYoutubeLiveStatuses = useCallback((statuses: Awaited<ReturnType<typeof fetchYoutubeLiveStatuses>>) => {
    if (statuses.length === 0) return;

    updateActiveStreams((streams) => {
      let hasChanges = false;
      const byChannelId = new Map(statuses.map((status) => [status.channelId, status]));
      const nextStreams = streams.map((stream) => {
        const status = byChannelId.get(stream.id);
        if (!status || stream.platform !== 'youtube') return stream;

        const nextVideoId = status.status === 'live' && status.videoId ? status.videoId : undefined;
        const nextTitle = status.title || stream.title;

        if (stream.videoId === nextVideoId && stream.liveStatus === status.status && stream.title === nextTitle) {
          return stream;
        }

        hasChanges = true;
        return {
          ...stream,
          liveStatus: status.status,
          title: nextTitle,
          videoId: nextVideoId,
        };
      });

      return hasChanges ? nextStreams : streams;
    });
  }, [updateActiveStreams]);

  const refreshYoutubeLiveStatuses = useCallback(async (channelIds: string[]) => {
    const statuses = await fetchYoutubeLiveStatuses(channelIds);
    applyYoutubeLiveStatuses(statuses);
  }, [applyYoutubeLiveStatuses]);

  useEffect(() => {
    const channelIds = activeStreams
      .filter((stream) => stream.platform === 'youtube' && stream.id.startsWith('UC'))
      .map((stream) => stream.id)
      .filter((channelId) => !refreshedYoutubeChannels.current.has(channelId));

    if (channelIds.length === 0) return;
    channelIds.forEach((channelId) => refreshedYoutubeChannels.current.add(channelId));

    let isCancelled = false;

    fetchYoutubeLiveStatuses(channelIds).then((statuses) => {
      if (!isCancelled) applyYoutubeLiveStatuses(statuses);
    });

    return () => {
      isCancelled = true;
    };
  }, [activeStreams, applyYoutubeLiveStatuses]);

  useEffect(() => {
    const unresolvedKickStreams = activeStreams.filter((stream) => (
      stream.platform === 'kick' && !stream.chatIdentifier && stream.id.trim()
    ));

    for (const stream of unresolvedKickStreams) {
      const key = `${stream.platform}:${stream.id}`;
      if (attemptedKickChatroomResolutions.current.has(key)) continue;

      attemptedKickChatroomResolutions.current.add(key);
      void resolveKickInput(stream.id)
        .then((resolved) => {
          if (!resolved.chatIdentifier) return;

          updateActiveStreams((streams) => {
            let hasChanges = false;
            const nextStreams = streams.map((currentStream) => {
              if (currentStream.platform !== 'kick' || currentStream.id !== stream.id || currentStream.chatIdentifier) {
                return currentStream;
              }

              hasChanges = true;
              return {
                ...currentStream,
                chatIdentifier: resolved.chatIdentifier,
                title: resolved.title || currentStream.title,
              };
            });

            return hasChanges ? nextStreams : streams;
          });
        })
        .catch((error) => {
          console.warn('bizeye-kick-resolve: saved stream lookup failed.', error);
        });
    }
  }, [activeStreams, updateActiveStreams]);

  const navigateTo = (page: PublicAppPage) => {
    window.location.hash = page === 'watch' ? '/watch' : page === 'firetv' ? '/firetv' : '/';
    setCurrentPage(page);
  };

  const addStream = (id: string, platform: Platform, title?: string, chatIdentifier?: string) => {
    updateActiveStreams((streams) => {
      if (streams.find(s => s.id === id && s.platform === platform)) return streams;

      return [...streams, { chatIdentifier, id, platform, title }];
    });

    if (platform === 'youtube' && id.startsWith('UC')) {
      void refreshYoutubeLiveStatuses([id]);
    }

    setIsModalOpen(false);
  };

  const removeStream = (id: string, platform: Platform) => {
    updateActiveStreams((streams) => streams.filter(s => !(s.id === id && s.platform === platform)));
  };

  const changeLayoutMode = (mode: ViewLayoutMode) => {
    setLayoutMode(mode);
    saveStoredWatchLayout(mode);
  };

  const changeChatPanelPosition = (position: ChatPanelPosition) => {
    setChatPanelPosition(position);
    saveStoredWatchChatPosition(position);
  };

  const updateYoutubeLiveVideo = useCallback((channelId: string, videoId: string, title?: string) => {
    updateActiveStreams((streams) => {
      let hasChanges = false;
      const nextStreams = streams.map((stream) => {
        if (stream.platform !== 'youtube' || stream.id !== channelId) return stream;

        if (stream.videoId === videoId && stream.liveStatus === 'live' && (!title || stream.title === title)) {
          return stream;
        }

        hasChanges = true;
        return {
          ...stream,
          liveStatus: 'live' as const,
          title: title || stream.title,
          videoId,
        };
      });

      return hasChanges ? nextStreams : streams;
    });
  }, [updateActiveStreams]);

  return (
    <div className={`app-shell app-shell--${currentPage}`}>
      <FlagDefinitions definitions={flagDefinitions} />
      <FlagValues values={getFlagValues(
        bizeyeResolveFlagValue,
        bizeyeChatMergeFlagValue,
        bizeyeChatTransportFlagValue,
      )} />

      {currentPage !== 'firetv' && currentPage !== 'adminLogin' && currentPage !== 'adminLives' && (
        <Header
          currentPage={currentPage}
          streamCount={activeStreams.length}
          onAddStream={() => setIsModalOpen(true)}
          onNavigate={navigateTo}
        />
      )}

      {currentPage === 'adminLogin' ? (
        <AdminLoginPage />
      ) : currentPage === 'adminLives' ? (
        <AdminLivesPage />
      ) : currentPage === 'firetv' ? (
        <FireTvPage
          onLiveVideoResolved={updateYoutubeLiveVideo}
          onOpenHome={() => navigateTo('home')}
          onOpenWatch={() => navigateTo('watch')}
          onRemoveStream={removeStream}
          streams={activeStreams}
        />
      ) : currentPage === 'watch' ? (
        <WatchPage
          chatMergeEnabled={bizeyeChatMergeFlagValue}
          chatPanelPosition={chatPanelPosition}
          chatTransport={bizeyeChatTransportFlagValue}
          layoutMode={layoutMode}
          onChatPanelPositionChange={changeChatPanelPosition}
          onLayoutModeChange={changeLayoutMode}
          onLiveVideoResolved={updateYoutubeLiveVideo}
          onRemoveStream={removeStream}
          streams={activeStreams}
        />
      ) : (
        <HomePage
          activeStreams={activeStreams}
          featuredCreators={featuredCreators}
          onAddStream={addStream}
          onOpenAddModal={() => setIsModalOpen(true)}
          onOpenWatch={() => navigateTo('watch')}
        />
      )}

      {currentPage !== 'firetv' && currentPage !== 'adminLogin' && currentPage !== 'adminLives' && (
        <AddStreamModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAdd={addStream}
        />
      )}
    </div>
  )
}

export default App
