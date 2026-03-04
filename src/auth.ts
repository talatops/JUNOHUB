import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    trustHost: true, // Trust all hosts (needed for ngrok/proxies)
    ...authConfig,
    callbacks: {
        async signIn({ user, account }) {
            // Allow non-email-based sign-in flows to proceed as usual
            if (!user?.email) return true

            // Never constrain the admin account via role toggle
            if (user.email === ADMIN_EMAIL || user.role === "ADMIN") {
                return true
            }

            // Read the desired role from the role toggle cookie set on the client
            const cookieStore = await cookies()
            const cookieRole = cookieStore.get("juno_login_role")?.value
            const desiredRole =
                cookieRole === "SUPPLIER" || cookieRole === "VENDOR" ? cookieRole : null

            // If no role was explicitly chosen (e.g. legacy flows), fall back to existing behaviour
            if (!desiredRole) {
                return true
            }

            const existingUser = await prisma.user.findUnique({
                where: { email: user.email },
                select: { id: true, role: true },
            })

            // New user via OAuth: align their role with the chosen role on first sign-in
            if (existingUser && existingUser.role !== desiredRole) {
                // If the role already exists and differs, block sign-in with a clear error code
                const url = new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000")
                url.searchParams.set("error", "SigninRoleMismatch")
                url.searchParams.set("existingRole", existingUser.role || "VENDOR")
                url.searchParams.set("desiredRole", desiredRole)
                return url.toString()
            }

            // If the user record exists but has the default role and this is effectively a first login
            // we keep the current behaviour and let onboarding/layouts route correctly.
            return true
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string
                if (token.role) {
                    session.user.role = token.role as "VENDOR" | "SUPPLIER" | "ADMIN"
                }
                // Load chatPublicKey from DB so it stays current after chat-setup
                const user = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { chatPublicKey: true },
                })
                if (user) session.user.chatPublicKey = user.chatPublicKey ?? undefined
            }
            return session
        },
    },
    providers: [
        ...authConfig.providers.filter((p) => (p as { id?: string }).id !== "credentials"),
        {
            id: "credentials",
            name: "Credentials",
            type: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials: { email: string; password: string }) {
                if (!credentials?.email || !credentials?.password) return null

                const email = credentials.email as string
                const password = credentials.password as string

                // Handle env-configured admin login
                if (ADMIN_EMAIL && ADMIN_PASSWORD && email === ADMIN_EMAIL) {
                    // Ensure an ADMIN user exists (create or update on the fly)
                    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10)

                    const adminUser = await prisma.user.upsert({
                        where: { email: ADMIN_EMAIL },
                        update: {
                            password: hashedPassword,
                            role: "ADMIN",
                        },
                        create: {
                            email: ADMIN_EMAIL,
                            password: hashedPassword,
                            role: "ADMIN",
                            name: "Admin",
                        },
                    })

                    const isValid = await bcrypt.compare(password, adminUser.password!)
                    if (!isValid) return null

                    return adminUser
                }

                // Default credentials flow for non-admin users
                const user = await prisma.user.findUnique({
                    where: { email },
                })

                if (!user || !user.password) return null

                const isValid = await bcrypt.compare(password, user.password)
                if (!isValid) return null

                return user
            },
        } as unknown as import("@auth/core/providers").Provider,
    ],
})
