'use client'

import { useState, useEffect, useCallback } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export function usePushNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(true)

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
    }

    const checkSubscription = useCallback(async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setLoading(false)
            return
        }

        const TIMEOUT_MS = 8000

        try {
            // Ensure SW is registered so "ready" can resolve (PWARegistration may not have run yet)
            if (!navigator.serviceWorker.controller) {
                navigator.serviceWorker.register('/sw.js').catch(() => {})
            }

            const registration = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise<ServiceWorkerRegistration | null>((resolve) =>
                    setTimeout(() => resolve(null), TIMEOUT_MS)
                )
            ])

            if (registration) {
                const subscription = await registration.pushManager.getSubscription()
                setIsSubscribed(!!subscription)
            }
            setPermission(Notification.permission)
        } catch (error) {
            console.error('Error checking push subscription:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkSubscription()
    }, [checkSubscription])

    const subscribe = async (): Promise<{ success: boolean; error?: string }> => {
        if (!VAPID_PUBLIC_KEY) {
            console.error('VAPID public key not found')
            return { success: false, error: 'Server configuration error. Please try again later or contact support.' }
        }

        if (Notification.permission === 'denied') {
            return {
                success: false,
                error: 'Notifications are blocked. In your browser, click the lock icon in the address bar → Site settings → Notifications → set to Allow, then refresh this page.'
            }
        }

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            })

            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            })

            if (response.ok) {
                setIsSubscribed(true)
                setPermission(Notification.permission)
                return { success: true }
            }

            const data = await response.json().catch(() => ({}))
            const msg = data?.message || (response.status === 401 ? 'Please log in again.' : 'Server error. Please try again later.')
            return { success: false, error: msg }
        } catch (error) {
            console.error('Error subscribing to push notifications:', error)
            const isPermissionDenied = error instanceof Error && (
                error.name === 'NotAllowedError' ||
                (error as DOMException).name === 'NotAllowedError'
            )
            if (isPermissionDenied) {
                return {
                    success: false,
                    error: 'Notification permission was denied. To enable: click the lock icon in the address bar → Site settings → Notifications → Allow, then refresh.'
                }
            }
            return {
                success: false,
                error: 'Could not enable notifications. Make sure the site is allowed to show notifications in your browser settings, then try again.'
            }
        }
    }

    const unsubscribe = async () => {
        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()

            if (subscription) {
                await fetch('/api/notifications/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                })
                await subscription.unsubscribe()
                setIsSubscribed(false)
            }
            return true
        } catch (error) {
            console.error('Error unsubscribing from push notifications:', error)
            return false
        }
    }

    return {
        permission,
        isSubscribed,
        loading,
        subscribe,
        unsubscribe
    }
}
