import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

export default {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Do NOT allow dangerous automatic account linking; require explicit flows instead
            allowDangerousEmailAccountLinking: false,
        }),
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            // authorize is overridden in auth.ts where we have DB access
            async authorize() {
                return null
            },
        }),
    ],
} satisfies NextAuthConfig
