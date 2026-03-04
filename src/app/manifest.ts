import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
    name: 'JUNO',
    short_name: 'JUNO',
        description: 'The Unified Supply Chain Hub',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0e1a',
        theme_color: '#0a0e1a',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/apple-icon.png',
                sizes: '180x180',
                type: 'image/png',
            }
        ],
    }
}
