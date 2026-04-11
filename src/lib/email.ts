import nodemailer from "nodemailer"
import { logger } from "@/lib/logger"
import { getBaseUrl } from "@/lib/utils"

/** Returns the absolute URL for the JUNO logo (for use in outbound HTML emails) */
export function getEmailLogoUrl(): string {
    return `${getBaseUrl()}/icon.png`
}

// Create reusable transporter (only if SMTP is configured)
function getTransporter() {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        return null
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    })
}

export interface EmailOptions {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
    try {
        // Skip sending in development if SMTP is not configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            logger.info("Email not configured. Would send", { to, subject })
            return { success: true, message: "Email skipped (not configured)" }
        }

        const transporter = getTransporter()
        if (!transporter) {
            logger.warn("Email transporter not available. Would send", { to, subject })
            return { success: true, message: "Email skipped (transporter not available)" }
        }

        const info = await transporter.sendMail({
            from: `"JUNO" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        })

        return { success: true, messageId: info.messageId }
    } catch (error) {
        logger.error("Error sending email", error)
        // Don't throw - let the caller handle it
        return { 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown email error" 
        }
    }
}

export function generateInvitationEmailHtml(
    supplierName: string,
    vendorCompanyName: string,
    invitationToken: string,
    invitationLink: string
): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Supplier Invitation - JUNO</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0e1a;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                            <div style="text-align: center;">
                                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px;">
                                    <img src="${getEmailLogoUrl()}" alt="JUNO" width="48" height="48" style="display: block; border-radius: 12px; object-fit: contain;" />
                                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">JUNO</h1>
                                </div>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                                You've Been Invited!
                            </h2>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                Hello ${supplierName || "Supplier"},
                            </p>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                <strong style="color: #ffffff;">${vendorCompanyName}</strong> has invited you to connect on JUNO. They're interested in partnering with you and would like to explore your product catalog.
                            </p>
                            
                            <!-- Invitation Token Box -->
                            <div style="background-color: rgba(79, 70, 229, 0.1); border: 1px solid rgba(79, 70, 229, 0.3); border-radius: 12px; padding: 24px; margin: 32px 0; text-align: center;">
                                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px;">
                                    Your Invitation Token
                                </p>
                                <div style="background-color: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 16px; margin: 12px 0;">
                                    <code style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                                        ${invitationToken}
                                    </code>
                                </div>
                                <p style="margin: 12px 0 0; font-size: 13px; color: #94a3b8;">
                                    Use this token in your supplier portal to accept the invitation
                                </p>
                            </div>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin: 32px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${invitationLink}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; transition: background-color 0.2s;">
                                            Accept Invitation
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                                Or copy the invitation token above and paste it in the <strong style="color: #cbd5e1;">Vendors</strong> section of your supplier portal.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.1);">
                            <p style="margin: 0 0 8px; font-size: 13px; color: #64748b; text-align: center;">
                                This invitation will expire in 7 days.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #475569; text-align: center;">
                                © 2026 JUNO Systems. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `
}
