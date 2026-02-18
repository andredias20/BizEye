import { useState } from 'react'
import './App.css'
import Header from './components/Header'
import StreamDashboard from './components/StreamDashboard'

interface Stream {
  id: string;
  platform: 'youtube' | 'twitch';
}

function App() {
  const [activeStreams, setActiveStreams] = useState<Stream[]>([
    { id: 'UCDt4dFdsJyjjA8mQULkOLLw', platform: 'youtube' }, 
    { id: 'UCvgSmIdI92W4KnP15fJwfwA', platform: 'youtube' },
    { id: 'UC13ikrGSy3E2AveqLAI9lqg', platform: 'youtube' },
    { id: 'UCPX0gLduKAfgr-HJENa7CFw', platform: 'youtube' }
  ]);

  const addStream = (idOrUrl: string) => {
    // Basic logic to extract channel ID if a URL is provided
    let streamId = idOrUrl;
    if (idOrUrl.includes('youtube.com/')) {
      const parts = idOrUrl.split('/');
      streamId = parts[parts.length - 1];
    }

    if (!activeStreams.find(s => s.id === streamId)) {
      setActiveStreams([...activeStreams, { id: streamId, platform: 'youtube' }]);
    }
  };

  const removeStream = (id: string) => {
    setActiveStreams(activeStreams.filter(s => s.id !== id));
  };

  return (
    <>
      <Header onAddStream={addStream} />
      <StreamDashboard
        streams={activeStreams}
        onRemoveStream={removeStream}
      />
    </>
  )
}

export default App
