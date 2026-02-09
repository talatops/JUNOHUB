import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"
import bcrypt from "bcryptjs"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    ...authConfig,
    callbacks: {
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
                session.user.role = token.role as import("@prisma/client").UserRole
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
        } as unknown as import("@auth/core/providers").Provider
    ]
})
