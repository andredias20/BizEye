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

        // 1. Try to extract Video ID from watch?v= or youtu.be/
        if (cleanInput.includes('youtube.com/watch') || cleanInput.includes('youtu.be/')) {
            try {
                const url = new URL(cleanInput.includes('http') ? cleanInput : `https://${cleanInput}`);
                if (url.hostname.includes('youtu.be')) {
                    return url.pathname.slice(1);
                }
                const videoId = url.searchParams.get('v');
                if (videoId) return videoId;
            } catch (e) {
                // fall through
            }
        }

        // 2. Try to find a UC ID directly (regex)
        const ucMatch = cleanInput.match(/UC[a-zA-Z0-9_-]{22}/);
        if (ucMatch) return ucMatch[0];

        // 3. Try to find a handle (@...) or name
        let handle = '';
        const handleMatch = cleanInput.match(/@([a-zA-Z0-9._-]+)/);
        if (handleMatch) {
            handle = `@${handleMatch[1]}`;
        } else if (cleanInput.includes('youtube.com/')) {
            try {
                const url = new URL(cleanInput.includes('http') ? cleanInput : `https://${cleanInput}`);
                const pathParts = url.pathname.split('/').filter(p => !['c', 'user', 'channel'].includes(p) && p !== '');
                handle = pathParts[0] || '';
                if (!handle.startsWith('@') && handle) handle = `@${handle}`;
            } catch (e) {
                const parts = cleanInput.split('/').filter(p => p);
                handle = parts[parts.length - 1] || '';
            }
        } else {
            handle = cleanInput.startsWith('@') ? cleanInput : `@${cleanInput}`;
        }

        if (!handle) throw new Error('Could not identify a YouTube handle or ID in the input.');

        // 3. API Resolution
        if (!YOUTUBE_API_KEY) {
            throw new Error('YT CONFIG ERROR: YouTube API Key missing. Enter UC ID directly or fix .env.');
        }

        try {
            console.log(`Resolving YouTube handle: ${handle}`);

            // Step A: Try direct channel lookup by handle
            const hRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${YOUTUBE_API_KEY}`
            );
            const hData = await hRes.json();
            if (hData.items?.[0]?.id) return hData.items[0].id;

            // Step B: Fallback to Search (more robust for custom URLs/names)
            const sRes = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${YOUTUBE_API_KEY}`
            );
            const sData = await sRes.json();

            if (sData.items?.[0]?.snippet?.channelId) {
                return sData.items[0].snippet.channelId;
            }

            throw new Error(`Channel not found for: ${handle}. Try using the full Channel URL.`);
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
                if (id.includes('.com/') || id.includes('.tv/')) {
                    try {
                        const url = new URL(id.includes('http') ? id : `https://${id}`);
                        const pathParts = url.pathname.split('/').filter(p => p);
                        id = pathParts[0] || id;
                    } catch (e) {
                        id = id.split('/').pop() || id;
                    }
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
