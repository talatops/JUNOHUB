import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { generateSecret, generateURI } from "otplib"
import { toDataURL } from "qrcode"
import { encryptString } from "@/lib/encryption"
import { logger } from "@/lib/logger"

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        })

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        // Generate a new secret
        const secret = generateSecret()
        
        // Create service name and account name for the QR code
        const serviceName = process.env.MFA_ISSUER_NAME || "JUNO"
        const accountName = user.email || user.name || "User"
        
        // Generate TOTP URI
        const otpAuthUrl = generateURI({
            secret,
            label: accountName,
            issuer: serviceName
        })

        // Generate QR code as data URL
        let qrCodeDataUrl: string
        try {
            qrCodeDataUrl = await toDataURL(otpAuthUrl)
        } catch (qrError) {
            logger.error("QR Code generation error", qrError)
            throw new Error(`Failed to generate QR code: ${qrError instanceof Error ? qrError.message : "Unknown error"}`)
        }

        // Store the secret temporarily (not enabled yet - will be enabled after verification)
        // Encrypt the secret at rest
        const encryptedSecret = encryptString(secret)
        await prisma.$executeRawUnsafe(
            `UPDATE "User" SET "mfaSecret" = $1 WHERE id = $2`,
            encryptedSecret,
            session.user.id
        )

        return NextResponse.json({
            secret,
            qrCode: qrCodeDataUrl,
            manualEntryKey: secret // For manual entry if QR code can't be scanned
        })
    } catch (error) {
        logger.error("MFA setup error", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error("MFA setup error details", { errorMessage, errorStack })
        return NextResponse.json(
            { message: "Internal server error", error: errorMessage },
            { status: 500 }
        )
    }
}
