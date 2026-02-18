import React from 'react';
import './Header.css';

interface HeaderProps {
  onAddStream: (channelId: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onAddStream }) => {
  const [inputValue, setInputValue] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onAddStream(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <header className="main-header">
      <div className="header-left">
        <h1 className="logo">eye<span>Rat</span></h1>
        <div className="badge">LIVE</div>
      </div>
      
      <form className="add-stream-form" onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="YouTube Channel ID / URL..." 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit">ADD STREAM</button>
      </form>

      <div className="header-right">
        <button className="icon-btn">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
