import React from 'react';
import './AddStreamButton.css';

interface AddStreamButtonProps {
    onClick: () => void;
}

const AddStreamButton: React.FC<AddStreamButtonProps> = ({ onClick }) => {
    return (
        <div className="fab-container">
            <button
                className="fab-button"
                onClick={onClick}
                aria-label="Add stream"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            </button>
            <span className="tooltip">Add stream</span>
        </div>
    );
};

export default AddStreamButton;
