"use client"

import { useState, useEffect, useCallback } from "react"
import { ChatCrypto } from "@/lib/chat-crypto"

export const PRIVATE_KEY_STORAGE_KEY = "juno_chat_private_key"
export const PUBLIC_KEY_STORAGE_KEY = "juno_chat_public_key"

export function useChatCrypto() {
    const [privateKey, setPrivateKey] = useState<string | null>(null)
    const [hasKeys, setHasKeys] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const stored = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY)
        if (stored) {
            setPrivateKey(stored)
            setHasKeys(true)
        }
        setLoading(false)
    }, [])

    const setupKeys = useCallback(async () => {
        setLoading(true)
        try {
            const keys = await ChatCrypto.generateKeyPair()

            localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, keys.privateKey)
            localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, keys.publicKey)
            setPrivateKey(keys.privateKey)
            setHasKeys(true)

            const res = await fetch("/api/user/chat-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicKey: keys.publicKey })
            })

            if (!res.ok) throw new Error("Failed to save public key")

            return keys.publicKey
        } catch (error) {
            console.error("Setup keys error:", error)
            throw error
        } finally {
            setLoading(false)
        }
    }, [])

    const getStoredPublicKey = useCallback((): string | null => {
        if (typeof window === "undefined") return null
        return localStorage.getItem(PUBLIC_KEY_STORAGE_KEY)
    }, [])

    return {
        privateKey,
        hasKeys,
        loading,
        setupKeys,
        getStoredPublicKey
    }
}
