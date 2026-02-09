"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function JunoEnginePage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect to tickets page by default
        router.replace("/dashboard/juno-engine/tickets")
    }, [router])

    return null
}
