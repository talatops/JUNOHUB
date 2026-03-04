"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Lenis from "lenis"

export function SmoothScroll({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    useEffect(() => {
        // Disable Lenis on app-style dashboards so native scrolling works
        if (pathname.startsWith("/dashboard") || pathname.startsWith("/supplier")) {
            return
        }

        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
            infinite: false,
        })

        function raf(time: number) {
            lenis.raf(time)
            requestAnimationFrame(raf)
        }

        requestAnimationFrame(raf)

        return () => {
            lenis.destroy()
        }
    }, [pathname])

    return <>{children}</>
}
