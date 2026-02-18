import { useState } from 'react'
import './App.css'
import Header from './components/Header'
import StreamDashboard from './components/StreamDashboard'
import AddStreamButton from './components/AddStreamButton'
import AddStreamModal from './components/AddStreamModal'

import type { Stream, Platform } from './types'

function App() {
  const [activeStreams, setActiveStreams] = useState<Stream[]>([
    { id: 'UCDt4dFdsJyjjA8mQULkOLLw', platform: 'youtube' },
    { id: 'UCvgSmIdI92W4KnP15fJwfwA', platform: 'youtube' },
    { id: 'UC13ikrGSy3E2AveqLAI9lqg', platform: 'youtube' },
    { id: 'alanzoka', platform: 'twitch' },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addStream = (id: string, platform: Platform) => {
    if (!activeStreams.find(s => s.id === id && s.platform === platform)) {
      setActiveStreams(prev => [...prev, { id, platform }]);
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
