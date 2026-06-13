import type { CreatorProfile, Stream } from '../types';

export const starterStreams: Stream[] = [
    { id: 'UCvgSmIdI92W4KnP15fJwfwA', platform: 'youtube', title: 'ACF' },
    { id: 'UCwRM1SXROyxSSJqrOTQzILw', platform: 'youtube', title: 'Tonimek' },
    { id: 'UCP9uupJdJnpOEJzTtigLPOg', platform: 'youtube', title: 'EE Brasil', fallbackVideoId: 'zhqVdiazXQA' },
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
        title: 'Tonimek',
        handle: 'UCwRM1SXROyxSSJqrOTQzILw',
        description: 'Canal base para acompanhar as transmissoes da Tonimek.',
    },
    {
        id: 'UCP9uupJdJnpOEJzTtigLPOg',
        platform: 'youtube',
        title: 'EE Brasil',
        handle: '@enriedu',
        fallbackVideoId: 'zhqVdiazXQA',
        description: 'Canal EEbrasil incluido na lista inicial de lives.',
    },
];
