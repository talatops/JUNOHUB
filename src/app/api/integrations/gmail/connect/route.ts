import { NextResponse } from "next/server"
import { auth } from "@/auth"
import crypto from "crypto"

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Check if Google OAuth credentials are configured
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return NextResponse.json(
                { message: "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables." },
                { status: 500 }
            )
        }

        // Generate state token for CSRF protection
        const state = crypto.randomBytes(32).toString("hex")
        
        // Store state in a cookie or session (for simplicity, we'll include it in the callback URL)
        // In production, use a proper session store or encrypted cookie
        
        // Gmail API scopes
        // Adding 'email' and 'profile' scopes to get user email address
        const scopes = [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile"
        ].join(" ")

        // Build Google OAuth 2.0 authorization URL
        // IMPORTANT: The redirect URI must exactly match what's configured in Google Cloud Console
        // For production: https://yourdomain.com/api/integrations/gmail/callback
        // For development: http://localhost:3000/api/integrations/gmail/callback
        // For ngrok: https://your-ngrok-url.ngrok-free.dev/api/integrations/gmail/callback
        const baseUrl =
            process.env.AUTH_URL ||
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            "http://localhost:3000"
        const redirectUri = `${baseUrl}/api/integrations/gmail/callback`
        
        console.log("Gmail OAuth - Redirect URI:", redirectUri) // Log for debugging
        
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
        authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID)
        authUrl.searchParams.set("redirect_uri", redirectUri)
        authUrl.searchParams.set("response_type", "code")
        authUrl.searchParams.set("scope", scopes)
        authUrl.searchParams.set("access_type", "offline") // Required to get refresh token
        authUrl.searchParams.set("prompt", "consent") // Force consent to get refresh token
        authUrl.searchParams.set("state", state)
        
        return NextResponse.json({
            authUrl: authUrl.toString(),
            state, // Return state so frontend can verify it on callback
            redirectUri, // Include redirect URI in response for debugging
            message: "Redirecting to Google OAuth"
        })
    } catch (error) {
        console.error("Error initiating Gmail OAuth:", error)
        return NextResponse.json(
            { message: "Failed to initiate Gmail connection" },
            { status: 500 }
        )
    }
}
