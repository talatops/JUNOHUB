import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/integrations/gmail/callback
 * Handle Google OAuth callback and store tokens
 */
export async function GET(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            const baseUrl =
                process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                "http://localhost:3000"
            return NextResponse.redirect(
                new URL("/login?error=unauthorized", baseUrl)
            )
        }

        const { searchParams } = new URL(req.url)
        const code = searchParams.get("code")
        const error = searchParams.get("error")
        const _state = searchParams.get("state")

        // Handle OAuth errors
        if (error) {
            console.error("Gmail OAuth error:", error)
            const baseUrl =
                process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                "http://localhost:3000"
            return NextResponse.redirect(
                new URL("/dashboard/juno-engine/gmail-connect?error=oauth_failed", baseUrl)
            )
        }

        if (!code) {
            const baseUrl =
                process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                "http://localhost:3000"
            return NextResponse.redirect(
                new URL("/dashboard/juno-engine/gmail-connect?error=no_code", baseUrl)
            )
        }

        // Exchange authorization code for tokens
        // IMPORTANT: This redirect URI must exactly match what was sent in the authorization request
        const baseUrl =
            process.env.AUTH_URL ||
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000"
        const redirectUri = `${baseUrl}/api/integrations/gmail/callback`
        
        console.log("Gmail OAuth Callback - Redirect URI:", redirectUri) // Log for debugging
        
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
            }),
        })

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}))
            console.error("Token exchange error:", errorData)
            console.error("Redirect URI used:", redirectUri)
            
            // Provide more specific error message if it's a redirect_uri_mismatch
            if (errorData.error === "redirect_uri_mismatch") {
                const baseUrlForError =
                    process.env.AUTH_URL ||
                    process.env.NEXTAUTH_URL ||
                    process.env.NEXT_PUBLIC_APP_URL ||
                    "http://localhost:3000"
                return NextResponse.redirect(
                    new URL(
                        `/dashboard/juno-engine/gmail-connect?error=redirect_uri_mismatch&redirect_uri=${encodeURIComponent(redirectUri)}`,
                        baseUrlForError
                    )
                )
            }
            
            const baseUrlForError =
                process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                "http://localhost:3000"
            return NextResponse.redirect(
                new URL("/dashboard/juno-engine/gmail-connect?error=token_exchange_failed", baseUrlForError)
            )
        }

        const tokens = await tokenResponse.json()

        // Get user's Gmail email address
        // Try userinfo endpoint first (requires email/profile scopes)
        let userInfo: { email: string } | null = null
        
        try {
            const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
            })

            if (userInfoResponse.ok) {
                userInfo = await userInfoResponse.json()
            } else {
                // Fallback: Try Gmail API profile endpoint
                const gmailProfileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                    },
                })

                if (gmailProfileResponse.ok) {
                    const profile = await gmailProfileResponse.json()
                    userInfo = { email: profile.emailAddress }
                } else {
                    const errorData = await gmailProfileResponse.json().catch(() => ({}))
                    console.error("Failed to fetch user info from both endpoints:", {
                        userinfo: userInfoResponse.status,
                        gmail: gmailProfileResponse.status,
                        error: errorData
                    })
                    throw new Error("Failed to fetch user email")
                }
            }
        } catch (error) {
            console.error("Error fetching user info:", error)
            const baseUrlForError =
                process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                "http://localhost:3000"
            return NextResponse.redirect(
                new URL("/dashboard/juno-engine/gmail-connect?error=user_info_failed", baseUrlForError)
            )
        }

        if (!userInfo?.email) {
            console.error("No email found in user info")
            const baseUrlForError =
                process.env.AUTH_URL ||
                process.env.NEXTAUTH_URL ||
                process.env.NEXT_PUBLIC_APP_URL ||
                "http://localhost:3000"
            return NextResponse.redirect(
                new URL("/dashboard/juno-engine/gmail-connect?error=user_info_failed", baseUrlForError)
            )
        }

        // Calculate token expiration
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))

        // Store or update Gmail integration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).gmailIntegration.upsert({
            where: {
                userId: session.user.id
            },
            create: {
                userId: session.user.id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || null,
                expiresAt,
                email: userInfo.email,
                scope: tokens.scope || ""
            },
            update: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || null,
                expiresAt,
                email: userInfo.email,
                scope: tokens.scope || ""
            }
        })

        const baseUrlDone =
            process.env.AUTH_URL ||
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000"
        return NextResponse.redirect(
            new URL("/dashboard/juno-engine/gmail-connect?connected=true", baseUrlDone)
        )
    } catch (error) {
        console.error("Gmail callback error:", error)
        const baseUrlError =
            process.env.AUTH_URL ||
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000"
        return NextResponse.redirect(
            new URL("/dashboard/juno-engine/gmail-connect?error=callback_failed", baseUrlError)
        )
    }
}
