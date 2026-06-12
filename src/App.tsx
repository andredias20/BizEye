import { useEffect, useState } from 'react'
import './App.css'
import Header from './components/Header'
import AddStreamModal from './components/AddStreamModal'
import HomePage from './pages/HomePage'
import WatchPage from './pages/WatchPage'
import { starterStreams } from './data/creators'

import type { Platform, Stream, ViewLayoutMode } from './types'

type AppPage = 'home' | 'watch';

const getPageFromHash = (): AppPage => {
  return window.location.hash === '#/watch' ? 'watch' : 'home';
};

function App() {
  const [activeStreams, setActiveStreams] = useState<Stream[]>(starterStreams);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>(getPageFromHash);
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>('balanced');

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(getPageFromHash());
    window.addEventListener('hashchange', handleHashChange);

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: AppPage) => {
    window.location.hash = page === 'watch' ? '/watch' : '/';
    setCurrentPage(page);
  };

  const addStream = (id: string, platform: Platform, title?: string) => {
    if (!activeStreams.find(s => s.id === id && s.platform === platform)) {
      setActiveStreams(prev => [...prev, { id, platform, title }]);
    }
    setIsModalOpen(false);
  };

  const removeStream = (id: string) => {
    setActiveStreams(activeStreams.filter(s => s.id !== id));
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
          onLayoutModeChange={setLayoutMode}
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
