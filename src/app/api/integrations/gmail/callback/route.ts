import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getBaseUrl } from "@/lib/utils"
import { cookies } from "next/headers"
import crypto from "crypto"

/**
 * GET /api/integrations/gmail/callback
 * Handle Google OAuth callback and store tokens
 */
export async function GET(req: Request) {
    try {
        const cookieStore = await cookies()
        const stateCookie = cookieStore.get("juno_gmail_oauth_state")?.value
        const redirectWithError = (errorCode: string, extra?: Record<string, string>) => {
            const url = new URL(`/dashboard/juno-engine/gmail-connect?error=${errorCode}`, getBaseUrl())
            if (extra) {
                for (const [key, value] of Object.entries(extra)) {
                    url.searchParams.set(key, value)
                }
            }
            const response = NextResponse.redirect(url)
            response.cookies.delete("juno_gmail_oauth_state")
            return response
        }

        const session = await auth()
        if (!session?.user?.id) {
            const response = NextResponse.redirect(new URL("/login?error=unauthorized", getBaseUrl()))
            response.cookies.delete("juno_gmail_oauth_state")
            return response
        }

        const { searchParams } = new URL(req.url)
        const code = searchParams.get("code")
        const error = searchParams.get("error")
        const state = searchParams.get("state")

        // Handle OAuth errors
        if (error) {
            console.error("Gmail OAuth error:", error)
            return redirectWithError("oauth_failed")
        }

        if (!code) {
            return redirectWithError("no_code")
        }

        if (!state || !stateCookie) {
            return redirectWithError("invalid_state")
        }

        const stateBuffer = Buffer.from(state)
        const cookieBuffer = Buffer.from(stateCookie)
        if (
            stateBuffer.length !== cookieBuffer.length ||
            !crypto.timingSafeEqual(stateBuffer, cookieBuffer)
        ) {
            return redirectWithError("invalid_state")
        }

        // Exchange authorization code for tokens
        // IMPORTANT: This redirect URI must exactly match what was sent in the authorization request
        const redirectUri = `${getBaseUrl()}/api/integrations/gmail/callback`

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
                return redirectWithError("redirect_uri_mismatch", {
                    redirect_uri: redirectUri,
                })
            }

            return redirectWithError("token_exchange_failed")
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
            return redirectWithError("user_info_failed")
        }

        if (!userInfo?.email) {
            console.error("No email found in user info")
            return redirectWithError("user_info_failed")
        }

        // Calculate token expiration
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))

        // Store or update Gmail integration
        await prisma.gmailIntegration.upsert({
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

        const successResponse = NextResponse.redirect(
            new URL("/dashboard/juno-engine/gmail-connect?connected=true", getBaseUrl())
        )
        successResponse.cookies.delete("juno_gmail_oauth_state")
        return successResponse
    } catch (error) {
        console.error("Gmail callback error:", error)
        const response = NextResponse.redirect(
            new URL("/dashboard/juno-engine/gmail-connect?error=callback_failed", getBaseUrl())
        )
        response.cookies.delete("juno_gmail_oauth_state")
        return response
    }
}
