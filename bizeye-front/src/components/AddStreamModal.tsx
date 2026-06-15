import React, { useState } from 'react';
import { resolveKickInput } from '../services/kickResolver';
import { resolveTwitchInput } from '../services/twitchResolver';
import { resolveYoutubeInput } from '../services/youtubeResolver';
import type { Platform } from '../types';
import './AddStreamModal.css';

interface AddStreamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (id: string, platform: Platform, title?: string, chatIdentifier?: string) => void;
}

const getErrorMessage = (err: unknown) => {
    return err instanceof Error ? err.message : 'Unexpected error';
};

const AddStreamModal: React.FC<AddStreamModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [platform, setPlatform] = useState<Platform>('youtube');
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            let id = inputValue.trim();
            let chatIdentifier: string | undefined;
            let title = id;
            if (!id) throw new Error('Please enter a link or ID');

            if (platform === 'youtube') {
                const resolved = await resolveYoutubeInput(id);
                id = resolved.id;
                title = resolved.title;
            } else if (platform === 'kick') {
                const resolved = await resolveKickInput(inputValue);
                id = resolved.id;
                title = resolved.title;
                chatIdentifier = resolved.chatIdentifier;
            } else {
                const resolved = resolveTwitchInput(inputValue);
                id = resolved.id;
                title = resolved.title;
                chatIdentifier = resolved.chatIdentifier;
            }

            console.log(`Adding ${platform} stream: ${id} (${title})`);
            onAdd(id, platform, title || id, chatIdentifier);
            onClose();
            setInputValue('');
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>x</button>
                <h2>Adicionar stream</h2>

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
                            {platform === 'youtube' ? 'Channel URL, ID ou Handle (@...)' :
                                platform === 'twitch' ? 'Twitch username, link ou username|chat' :
                                    'Kick username, link ou username|chatroomId'}
                        </label>
                        <input
                            type="text"
                            autoFocus
                            placeholder={platform === 'youtube' ? '@canal ou UC...' : 'username'}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? 'RESOLVENDO...' : 'ADICIONAR NA WATCH'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddStreamModal;
