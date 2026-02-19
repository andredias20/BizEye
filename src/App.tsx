import { useState } from 'react'
import './App.css'
import Header from './components/Header'
import StreamDashboard from './components/StreamDashboard'
import AddStreamButton from './components/AddStreamButton'
import AddStreamModal from './components/AddStreamModal'

import type { Stream, Platform } from './types'

function App() {
  const [activeStreams, setActiveStreams] = useState<Stream[]>([
    { id: 'UCDt4dFdsJyjjA8mQULkOLLw', platform: 'youtube', title: 'Rato' },
    { id: 'UCvgSmIdI92W4KnP15fJwfwA', platform: 'youtube', title: 'ACF' },
    { id: 'UC13ikrGSy3E2AveqLAI9lqg', platform: 'youtube', title: 'Richard' },
    { id: 'UCPX0gLduKAfgr-HJENa7CFw', platform: 'youtube', title: 'Cariani' },
    { id: 'UC0aogS8ogMaDUZKKKLKH8fg', platform: 'youtube', title: 'Gordox' },
    { id: 'UCwRM1SXROyxSSJqrOTQzILw', platform: 'youtube', title: 'Tonimek' },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    <>
      <Header />
      <StreamDashboard
        streams={activeStreams}
        onRemoveStream={removeStream}
      />

      <AddStreamButton onClick={() => setIsModalOpen(true)} />

      <AddStreamModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addStream}
      />
    </>
  )
}

export default App
