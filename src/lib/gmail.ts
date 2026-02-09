import { prisma } from "./prisma"

/**
 * Refresh Gmail access token using refresh token
 */
export async function refreshGmailToken(userId: string): Promise<string | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const integration = await (prisma as any).gmailIntegration.findUnique({
            where: { userId }
        })

        if (!integration || !integration.refreshToken) {
            return null
        }

        // Check if token is still valid (not expired)
        if (integration.expiresAt > new Date()) {
            return integration.accessToken
        }

        // Refresh the token
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                refresh_token: integration.refreshToken,
                grant_type: "refresh_token",
            }),
        })

        if (!tokenResponse.ok) {
            console.error("Failed to refresh Gmail token")
            return null
        }

        const tokens = await tokenResponse.json()
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))

        // Update the integration with new token
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).gmailIntegration.update({
            where: { userId },
            data: {
                accessToken: tokens.access_token,
                expiresAt
            }
        })

        return tokens.access_token
    } catch (error) {
        console.error("Error refreshing Gmail token:", error)
        return null
    }
}

/**
 * Get valid Gmail access token (refreshes if needed)
 */
export async function getGmailAccessToken(userId: string): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integration = await (prisma as any).gmailIntegration.findUnique({
        where: { userId }
    })

    if (!integration) {
        return null
    }

    // If token is expired, refresh it
    if (integration.expiresAt <= new Date()) {
        return await refreshGmailToken(userId)
    }

    return integration.accessToken
}
