import React from 'react';
import './Header.css';

const Header: React.FC = () => {
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
        <h1 className="logo">BIZ<span> EYE</span></h1>
        <div className="badge">LIVE</div>
      </div>

      <div className="header-right">
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
