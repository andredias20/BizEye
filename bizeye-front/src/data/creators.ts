import type { CreatorProfile, Stream } from '../types';

export const starterStreams: Stream[] = [
    { id: 'UCvgSmIdI92W4KnP15fJwfwA', platform: 'youtube', title: 'ACF' },
    { id: 'UCwRM1SXROyxSSJqrOTQzILw', platform: 'youtube', title: 'Tonimec' },
    { id: 'UCP9uupJdJnpOEJzTtigLPOg', platform: 'youtube', title: 'EEBrasil' },
    { id: 'UCZiYbVptd3PVPf4f6eR6UaQ', platform: 'youtube', title: 'CazeTV' },
];

export const featuredCreators: CreatorProfile[] = [
    {
        id: 'UCvgSmIdI92W4KnP15fJwfwA',
        platform: 'youtube',
        title: 'ACF',
        handle: 'UCvgSmIdI92W4KnP15fJwfwA',
        description: 'Canal inicial para acompanhar lives e conteudo recorrente.',
    },
    {
        id: 'UCwRM1SXROyxSSJqrOTQzILw',
        platform: 'youtube',
        title: 'Tonimec',
        handle: 'UCwRM1SXROyxSSJqrOTQzILw',
        description: 'Exemplo pronto para entrar na tela Watch sem configurar nada.',
    },
    {
        id: 'UCP9uupJdJnpOEJzTtigLPOg',
        platform: 'youtube',
        title: 'EEBrasil',
        handle: '@enriedu',
        description: 'Canal fixo para resolver live ativa pelo backend quando necessario.',
    },
    {
        id: 'UCZiYbVptd3PVPf4f6eR6UaQ',
        platform: 'youtube',
        title: 'CazeTV',
        handle: '@CazeTV',
        description: 'Canal sugerido para acompanhar transmissões ao vivo via resolver do backend.',
    },
];
