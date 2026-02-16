'use client'

import { useEffect } from 'react'

export function PWARegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator && window.self === window.top) {
            window.addEventListener('load', () => {
                navigator.serviceWorker
                    .register('/sw.js')
                    .then((registration) => {
                        console.log('PWA Service Worker registered with scope:', registration.scope)
                    })
                    .catch((error) => {
                        console.error('PWA Service Worker registration failed:', error)
                    })
            })
        }
    }, [])

    return null
}
