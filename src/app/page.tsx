"use client"

import { useMediaQuery } from "@/hooks/useMediaQuery"
import { LandingNavbar } from "@/components/landing/LandingNavbar"
import { LandingHero } from "@/components/landing/LandingHero"
import { LandingFeatures } from "@/components/landing/LandingFeatures"
import { LandingFooter } from "@/components/landing/LandingFooter"
import { MobileHero } from "@/components/landing/mobile/MobileHero"
import { MobileFeatures } from "@/components/landing/mobile/MobileFeatures"

import dynamic from "next/dynamic"

const LandingSolutions = dynamic(() => import("@/components/landing/LandingSolutions").then(mod => mod.LandingSolutions), {
  ssr: true,
  loading: () => <div className="min-h-[400px] bg-[#0a0e1a]" />
})

export default function HomePage() {
  const isMobile = useMediaQuery("(max-width: 768px)")

  return (
    <div className="min-h-screen bg-[#0a0e1a] selection:bg-indigo-500/30">
      <LandingNavbar isLoggedIn={false} />
      <main>
        {isMobile ? (
          <>
            <MobileHero />
            <MobileFeatures />
            <LandingSolutions />
          </>
        ) : (
          <>
            <LandingHero />
            <LandingFeatures />
            <LandingSolutions />
          </>
        )}
      </main>
      <LandingFooter />
    </div>
  )
}
