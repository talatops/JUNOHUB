"use client"

import { useState, useEffect, useCallback } from "react"
import { ChatCrypto } from "@/lib/chat-crypto"

export const PRIVATE_KEY_STORAGE_KEY = "juno_chat_private_key"
export const PUBLIC_KEY_STORAGE_KEY = "juno_chat_public_key"

export function useChatCrypto(userId?: string) {
    const [privateKey, setPrivateKey] = useState<string | null>(null)
    const [hasKeys, setHasKeys] = useState(false)
    const [loading, setLoading] = useState(true)

    const privateKeyKey = userId ? `${PRIVATE_KEY_STORAGE_KEY}_${userId}` : PRIVATE_KEY_STORAGE_KEY
    const publicKeyKey = userId ? `${PUBLIC_KEY_STORAGE_KEY}_${userId}` : PUBLIC_KEY_STORAGE_KEY

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            return
        }

        const stored = typeof window !== "undefined" ? localStorage.getItem(privateKeyKey) : null
        if (stored) {
            setPrivateKey(stored)
            setHasKeys(true)
            setLoading(false)
            return
        }

        // No local key – try to restore from server backup
        ; (async () => {
            try {
                const res = await fetch("/api/user/chat-key", { cache: "no-store" })
                if (!res.ok) {
                    setLoading(false)
                    return
                }
                const data = await res.json()
                if (data.hasBackup && data.privateKey && typeof window !== "undefined") {
                    localStorage.setItem(privateKeyKey, data.privateKey as string)
                    localStorage.setItem(publicKeyKey, (data.publicKey as string | undefined) ?? localStorage.getItem(publicKeyKey) ?? "")
                    setPrivateKey(data.privateKey as string)
                    setHasKeys(true)
                } else {
                    setPrivateKey(null)
                    setHasKeys(false)
                }
            } catch (error) {
                console.error("restore chat key failed", error)
            } finally {
                setLoading(false)
            }
        })()
    }, [userId, privateKeyKey, publicKeyKey])

    const setupKeys = useCallback(async () => {
        if (!userId) throw new Error("User ID required for chat setup")
        setLoading(true)
        try {
            const keys = await ChatCrypto.generateKeyPair()

            localStorage.setItem(privateKeyKey, keys.privateKey)
            localStorage.setItem(publicKeyKey, keys.publicKey)
            setPrivateKey(keys.privateKey)
            setHasKeys(true)

            const res = await fetch("/api/user/chat-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicKey: keys.publicKey, privateKey: keys.privateKey })
            })

            if (!res.ok) throw new Error("Failed to save public key")

            return keys.publicKey
        } catch (error) {
            console.error("Setup keys error:", error)
            throw error
        } finally {
            setLoading(false)
        }
    }, [userId, privateKeyKey, publicKeyKey])

    const getStoredPublicKey = useCallback((): string | null => {
        if (typeof window === "undefined" || !userId) return null
        return localStorage.getItem(publicKeyKey)
    }, [userId, publicKeyKey])

    return {
        privateKey,
        hasKeys,
        loading,
        setupKeys,
        getStoredPublicKey
    }
}
