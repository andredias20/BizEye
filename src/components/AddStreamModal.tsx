import React, { useState } from 'react';
import type { Platform } from '../types';
import './AddStreamModal.css';

interface AddStreamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (id: string, platform: Platform) => void;
}

const AddStreamModal: React.FC<AddStreamModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [platform, setPlatform] = useState<Platform>('youtube');
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use Vite environment variable for the API Key
    const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

    if (!isOpen) return null;

    const resolveYoutubeId = async (input: string) => {
        const cleanInput = input.trim();

        // 1. Direct UC ID check
        if (cleanInput.startsWith('UC') && cleanInput.length === 24) return cleanInput;

        // 2. Parse URL or Handle
        let handle = cleanInput;
        if (cleanInput.includes('youtube.com/')) {
            try {
                const url = new URL(cleanInput.includes('http') ? cleanInput : `https://${cleanInput}`);
                const pathParts = url.pathname.split('/').filter(p => p);

                const channelIdx = pathParts.indexOf('channel');
                if (channelIdx !== -1 && pathParts[channelIdx + 1]?.startsWith('UC')) {
                    return pathParts[channelIdx + 1];
                }

                const lastPart = pathParts[pathParts.length - 1];
                handle = lastPart.startsWith('@') ? lastPart : `@${lastPart}`;
            } catch (e) {
                const lastPart = cleanInput.split('/').pop() || '';
                handle = lastPart.startsWith('@') ? lastPart : `@${lastPart}`;
            }
        } else if (!handle.startsWith('@')) {
            handle = `@${handle}`;
        }

        // 3. API Resolution
        if (!YOUTUBE_API_KEY) {
            throw new Error('CONFIG ERROR: YouTube API Key missing. Please check your .env file or add the channel ID (UC...) directly.');
        }

        try {
            console.log(`Resolving YouTube handle: ${handle}`);
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${YOUTUBE_API_KEY}`
            );

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(`API Error: ${errData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                return data.items[0].id;
            }

            throw new Error(`Channel not found for handle: ${handle}. Make sure it is the correct handle.`);
        } catch (err: any) {
            console.error('YouTube resolution failed:', err);
            throw err;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            let id = inputValue.trim();
            if (!id) throw new Error('Please enter a link or ID');

            if (platform === 'youtube') {
                id = await resolveYoutubeId(id);
            } else {
                // Twitch/Kick handle extraction
                if (id.includes('.com/')) {
                    id = id.split('/').pop() || id;
                }
            }

            console.log(`Adding ${platform} stream: ${id}`);
            onAdd(id, platform);
            onClose();
            setInputValue('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>
                <h2>Add New Stream</h2>

                <form onSubmit={handleSubmit}>
                    <div className="platform-selector">
                        <button
                            type="button"
                            className={platform === 'youtube' ? 'active' : ''}
                            onClick={() => setPlatform('youtube')}
                        >
                            YouTube
                        </button>
                        <button
                            type="button"
                            className={platform === 'twitch' ? 'active' : ''}
                            onClick={() => setPlatform('twitch')}
                        >
                            Twitch
                        </button>
                        <button
                            type="button"
                            className={platform === 'kick' ? 'active' : ''}
                            onClick={() => setPlatform('kick')}
                        >
                            Kick
                        </button>
                    </div>

                    <div className="input-group">
                        <label>
                            {platform === 'youtube' ? 'Channel URL or Handle (@...)' :
                                platform === 'twitch' ? 'Twitch Username or Link' :
                                    'Kick Username or Link'}
                        </label>
                        <input
                            type="text"
                            autoFocus
                            placeholder={platform === 'youtube' ? '@acfperformance' : 'username'}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? 'RESOLVING...' : 'ADD TO DASHBOARD'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddStreamModal;
