import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import OnboardingClient from "./onboarding-client"

export default async function OnboardingPage() {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    // Multi-store: redirect if user has at least one store with onboarding complete
    const storeWithOnboarding = await prisma.store.findFirst({
        where: { userId: session.user.id, onboardingComplete: true }
    })

    if (storeWithOnboarding) {
        redirect("/dashboard")
    }

    return <OnboardingClient />
}
