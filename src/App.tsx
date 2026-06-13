import { useEffect, useState } from 'react'
import './App.css'
import Header from './components/Header'
import AddStreamModal from './components/AddStreamModal'
import HomePage from './pages/HomePage'
import WatchPage from './pages/WatchPage'
import { starterStreams } from './data/creators'
import {
  loadStoredStreams,
  loadStoredWatchLayout,
  saveStoredStreams,
  saveStoredWatchLayout,
} from './storage/preferences'

import type { Platform, Stream, ViewLayoutMode } from './types'

type AppPage = 'home' | 'watch';

const getPageFromHash = (): AppPage => {
  return window.location.hash === '#/watch' ? 'watch' : 'home';
};

function App() {
  const [activeStreams, setActiveStreams] = useState<Stream[]>(() => loadStoredStreams(starterStreams));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>(getPageFromHash);
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>(() => loadStoredWatchLayout('balanced'));

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(getPageFromHash());
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: AppPage) => {
    window.location.hash = page === 'watch' ? '/watch' : '/';
    setCurrentPage(page);
  };

  const updateActiveStreams = (getNextStreams: (streams: Stream[]) => Stream[]) => {
    setActiveStreams((previousStreams) => {
      const nextStreams = getNextStreams(previousStreams);

      if (nextStreams !== previousStreams) {
        saveStoredStreams(nextStreams);
      }

      return nextStreams;
    });
  };

  const addStream = (id: string, platform: Platform, title?: string, fallbackVideoId?: string) => {
    updateActiveStreams((streams) => {
      if (streams.find(s => s.id === id && s.platform === platform)) return streams;

      return [...streams, { fallbackVideoId, id, platform, title }];
    });
    setIsModalOpen(false);
  };

  const removeStream = (id: string, platform: Platform) => {
    updateActiveStreams((streams) => streams.filter(s => !(s.id === id && s.platform === platform)));
  };

  const changeLayoutMode = (mode: ViewLayoutMode) => {
    setLayoutMode(mode);
    saveStoredWatchLayout(mode);
  };

  return (
    <div className={`app-shell app-shell--${currentPage}`}>
      <Header
        currentPage={currentPage}
        streamCount={activeStreams.length}
        onAddStream={() => setIsModalOpen(true)}
        onNavigate={navigateTo}
      />

      {currentPage === 'watch' ? (
        <WatchPage
          layoutMode={layoutMode}
          onAddStream={() => setIsModalOpen(true)}
          onLayoutModeChange={changeLayoutMode}
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

      <AddStreamModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addStream}
      />
    </div>
  )
}

export default App
