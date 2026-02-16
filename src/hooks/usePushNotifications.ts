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

        try {
            const registration = await navigator.serviceWorker.ready
            const subscription = await registration.pushManager.getSubscription()
            setIsSubscribed(!!subscription)
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

    const subscribe = async () => {
        if (!VAPID_PUBLIC_KEY) {
            console.error('VAPID public key not found')
            return false
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
                return true
            }
            return false
        } catch (error) {
            console.error('Error subscribing to push notifications:', error)
            return false
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
