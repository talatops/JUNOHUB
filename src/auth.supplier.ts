import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { decryptString } from "@/lib/encryption"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    // Required when behind proxies/tunnels (e.g. ngrok) in production.
    trustHost: true,
    // Ensure OAuth callback URLs match the role-scoped NextAuth route.
    basePath: "/api/auth/supplier",
    ...authConfig,
    // Role-scoped session cookie to prevent cross-private-window session overwrites.
    cookies: {
        sessionToken: {
            name: "authjs.session-token-supplier",
        },
    },
    callbacks: {
        async signIn({ user, credentials }) {
            // Allow non-email-based sign-in flows to proceed as usual
            if (!user?.email) return true

            // Never constrain the admin account via role toggle
            if (user.email === ADMIN_EMAIL || user.role === "ADMIN") {
                return true
            }

            // Read the desired role from the role toggle cookie set on the client
            const cookieStore = await cookies()
            const cookieRole = cookieStore.get("juno_login_role")?.value
            const credentialsRole =
                typeof credentials?.role === "string" ? credentials.role : null
            const desiredRoleRaw = cookieRole ?? credentialsRole
            const desiredRole =
                desiredRoleRaw === "SUPPLIER" || desiredRoleRaw === "VENDOR"
                    ? desiredRoleRaw
                    : null

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
            if (!session.user) return session

            const userIdFromToken =
                typeof (token as { id?: unknown })?.id === "string"
                    ? (token as { id: string }).id
                    : null
            const userIdFromSession =
                typeof (session.user as { id?: unknown }).id === "string"
                    ? (session.user as { id: string }).id
                    : null

            const sessionEmail =
                typeof session.user.email === "string" ? session.user.email : null

            const userId = userIdFromToken ?? userIdFromSession

            const user = userId
                ? await prisma.user.findUnique({
                      where: { id: userId },
                      select: { id: true, role: true, chatPublicKey: true },
                  })
                : sessionEmail
                    ? await prisma.user.findUnique({
                          where: { email: sessionEmail },
                          select: { id: true, role: true, chatPublicKey: true },
                      })
                    : null

            if (user) {
                session.user.id = user.id
                session.user.role = user.role
                session.user.chatPublicKey = user.chatPublicKey ?? undefined
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
            async authorize(credentials: { email: string; password: string; mfaCode?: string; role?: string }) {
                if (!credentials?.email || !credentials?.password) return null

                const email = credentials.email as string
                const password = credentials.password as string
                const mfaCode = typeof credentials.mfaCode === "string" ? credentials.mfaCode.trim() : ""

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

                if (user.mfaEnabled) {
                    const secret = decryptString(user.mfaSecret)
                    if (!secret || !mfaCode) return null

                    const { verify } = await import("otplib")
                    const verifyResult = await verify({ token: mfaCode, secret })
                    const isValidMfa = verifyResult.valid ?? false
                    if (!isValidMfa) return null
                }

                return user
            },
        } as unknown as import("@auth/core/providers").Provider,
    ],
})

