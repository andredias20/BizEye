import React, { useState } from 'react';
import type { Platform } from '../types';
import './AddStreamModal.css';

interface AddStreamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (id: string, platform: Platform, title?: string) => void;
}

const AddStreamModal: React.FC<AddStreamModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [platform, setPlatform] = useState<Platform>('youtube');
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use Vite environment variable for the API Key
    const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

    if (!isOpen) return null;

    const resolveYoutubeId = async (input: string): Promise<{ id: string; title: string }> => {
        const cleanInput = input.trim();

        // 1. Try to extract Video ID from watch?v= or youtu.be/
        if (cleanInput.includes('youtube.com/watch') || cleanInput.includes('youtu.be/')) {
            try {
                const url = new URL(cleanInput.includes('http') ? cleanInput : `https://${cleanInput}`);
                if (url.hostname.includes('youtu.be')) {
                    const id = url.pathname.slice(1);
                    return { id, title: id }; // Default title to ID for direct video links
                }
                const videoId = url.searchParams.get('v');
                if (videoId) return { id: videoId, title: videoId };
            } catch (e) {
                // fall through
            }
        }

        // 2. Try to find a UC ID directly (regex)
        const ucMatch = cleanInput.match(/UC[a-zA-Z0-9_-]{22}/);
        if (ucMatch) return { id: ucMatch[0], title: ucMatch[0] };

        // 3. Identify Handle or Channel Name
        let handle = '';
        if (cleanInput.includes('youtube.com/')) {
            try {
                const url = new URL(cleanInput.includes('http') ? cleanInput : `https://${cleanInput}`);
                const pathParts = url.pathname.split('/').filter(p => !['c', 'user', 'channel'].includes(p) && p !== '');
                handle = pathParts[0] || '';
            } catch (e) {
                handle = cleanInput.split('/').pop() || '';
            }
        } else {
            handle = cleanInput;
        }

        // Standardize handle format
        if (handle && !handle.startsWith('@') && !handle.startsWith('UC')) {
            handle = `@${handle}`;
        }

        if (!handle) throw new Error('Could not identify a YouTube handle or ID in the input.');

        // 4. API Resolution
        if (!YOUTUBE_API_KEY) {
            throw new Error('YT CONFIG ERROR: YouTube API Key missing. Enter UC ID directly or fix .env.');
        }

        try {
            console.log(`Step 1: Trying forHandle resolution for: ${handle}`);

            // Step A: Try direct channel lookup by handle
            const hRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`
            );

            if (hRes.ok) {
                const hData = await hRes.json();
                if (hData.items?.[0]) {
                    return {
                        id: hData.items[0].id,
                        title: hData.items[0].snippet?.title || handle
                    };
                }
            }

            console.log(`Step 2: Fallback to Search for: ${handle}`);
            // Step B: Fallback to Search (more robust for custom URLs/names)
            const sRes = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${YOUTUBE_API_KEY}`
            );

            if (sRes.ok) {
                const sData = await sRes.json();
                if (sData.items?.[0]?.snippet?.channelId) {
                    return {
                        id: sData.items[0].snippet.channelId,
                        title: sData.items[0].snippet.title || handle
                    };
                }
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
            let title = id;
            if (!id) throw new Error('Please enter a link or ID');

            if (platform === 'youtube') {
                const resolved = await resolveYoutubeId(id);
                id = resolved.id;
                title = resolved.title;
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
                title = id;
            }

            console.log(`Adding ${platform} stream: ${id} (${title})`);
            onAdd(id, platform, title || id);
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
