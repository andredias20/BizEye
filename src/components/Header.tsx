import React from 'react';
import './Header.css';

type AppPage = 'home' | 'watch';

interface HeaderProps {
  currentPage: AppPage;
  streamCount: number;
  onAddStream: () => void;
  onNavigate: (page: AppPage) => void;
}

const Header: React.FC<HeaderProps> = ({ currentPage, streamCount, onAddStream, onNavigate }) => {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <header className="main-header">
      <div className="header-left">
        <button className="logo-button" type="button" onClick={() => onNavigate('home')}>
          <span className="logo-mark">BE</span>
          <span className="logo">BIZ<span> EYE</span></span>
        </button>
        <div className="live-pill">
          <span className="live-dot" />
          {streamCount} cards
        </div>
      </div>

      <nav className="header-nav" aria-label="Principal">
        <button
          className={currentPage === 'home' ? 'active' : ''}
          onClick={() => onNavigate('home')}
          type="button"
        >
          Home
        </button>
        <button
          className={currentPage === 'watch' ? 'active' : ''}
          onClick={() => onNavigate('watch')}
          type="button"
        >
          Watch
        </button>
      </nav>

      <div className="header-right">
        <button className="header-action" onClick={onAddStream} type="button">
          <span aria-hidden="true">+</span>
          <span className="header-action-text">Creator</span>
        </button>
        <button className="icon-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
