import { auth } from "@/auth"
import { LandingNavbar } from "@/components/landing/LandingNavbar"
import { LandingHero } from "@/components/landing/LandingHero"
import { LandingFeatures } from "@/components/landing/LandingFeatures"
import { LandingSolutions } from "@/components/landing/LandingSolutions"
import { LandingFooter } from "@/components/landing/LandingFooter"

export default async function HomePage() {
  const session = await auth()
  const isLoggedIn = !!session

  return (
    <div className="min-h-screen bg-[#0a0e1a] selection:bg-indigo-500/30">
      <LandingNavbar isLoggedIn={isLoggedIn} />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingSolutions />
      </main>
      <LandingFooter />
    </div>
  )
}
