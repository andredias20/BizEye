import { useCallback, useEffect, useRef, useState } from 'react'
import { FlagDefinitions, FlagValues } from 'flags/react'
import './App.css'
import Header from './components/Header'
import AddStreamModal from './components/AddStreamModal'
import FireTvPage from './pages/FireTvPage'
import HomePage from './pages/HomePage'
import WatchPage from './pages/WatchPage'
import { starterStreams } from './data/creators'
import { isFireTvLikeDevice } from './platform/fireTv'
import { fetchYoutubeLiveStatuses } from './services/youtubeResolver'
import {
  flagDefinitions,
  getBizeyeResolveFlagValue,
  getFlagValues,
  getInitialBizeyeResolveFlagValue,
} from './flags'
import {
  loadStoredStreams,
  loadStoredWatchLayout,
  mergeFixedStreams,
  saveStoredStreams,
  saveStoredWatchLayout,
} from './storage/preferences'

import type { Platform, Stream, ViewLayoutMode } from './types'

type AppPage = 'firetv' | 'home' | 'watch';

const getPageFromHash = (): AppPage => {
  const hashRoute = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');

  if (hashRoute === 'firetv' || hashRoute === 'watch') {
    return hashRoute;
  }

  if (window.location.hash) {
    return 'home';
  }

  const pathRoute = window.location.pathname.replace(/^\/+/, '').replace(/\/$/, '');

  if (pathRoute === 'firetv' || pathRoute === 'watch') {
    return pathRoute;
  }

  return 'home';
};

function App() {
  const [activeStreams, setActiveStreams] = useState<Stream[]>(() => {
    const streams = mergeFixedStreams(loadStoredStreams(starterStreams), starterStreams);
    saveStoredStreams(streams);
    return streams;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>(getPageFromHash);
  const [bizeyeResolveFlagValue, setBizeyeResolveFlagValue] = useState(getInitialBizeyeResolveFlagValue);
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>(() => loadStoredWatchLayout('balanced'));
  const didAutoRedirectFireTv = useRef(false);
  const didRefreshInitialLives = useRef(false);

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

    getBizeyeResolveFlagValue().then((value) => {
      if (!isCancelled) setBizeyeResolveFlagValue(value);
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
    if (didRefreshInitialLives.current) return;
    didRefreshInitialLives.current = true;

    const channelIds = activeStreams
      .filter((stream) => stream.platform === 'youtube' && stream.id.startsWith('UC'))
      .map((stream) => stream.id);

    if (channelIds.length === 0) return;

    let isCancelled = false;

    fetchYoutubeLiveStatuses(channelIds).then((statuses) => {
      if (!isCancelled) applyYoutubeLiveStatuses(statuses);
    });

    return () => {
      isCancelled = true;
    };
  }, [activeStreams, applyYoutubeLiveStatuses]);

  const navigateTo = (page: AppPage) => {
    window.location.hash = page === 'watch' ? '/watch' : page === 'firetv' ? '/firetv' : '/';
    setCurrentPage(page);
  };

  const addStream = (id: string, platform: Platform, title?: string) => {
    updateActiveStreams((streams) => {
      if (streams.find(s => s.id === id && s.platform === platform)) return streams;

      return [...streams, { id, platform, title }];
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
      <FlagValues values={getFlagValues(bizeyeResolveFlagValue)} />

      {currentPage !== 'firetv' && (
        <Header
          currentPage={currentPage}
          streamCount={activeStreams.length}
          onAddStream={() => setIsModalOpen(true)}
          onNavigate={navigateTo}
        />
      )}

      {currentPage === 'firetv' ? (
        <FireTvPage
          onLiveVideoResolved={updateYoutubeLiveVideo}
          onOpenHome={() => navigateTo('home')}
          onOpenWatch={() => navigateTo('watch')}
          onRemoveStream={removeStream}
          streams={activeStreams}
        />
      ) : currentPage === 'watch' ? (
        <WatchPage
          layoutMode={layoutMode}
          onAddStream={() => setIsModalOpen(true)}
          onLayoutModeChange={changeLayoutMode}
          onLiveVideoResolved={updateYoutubeLiveVideo}
          onRemoveStream={removeStream}
          streams={activeStreams}
        />
      ) : (
        <HomePage
          activeStreams={activeStreams}
          onAddStream={addStream}
          onOpenAddModal={() => setIsModalOpen(true)}
          onOpenWatch={() => navigateTo('watch')}
        />
      )}

      {currentPage !== 'firetv' && (
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
