import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"
import { logger } from "@/lib/logger"

// This is a simple mock-up of a newsletter subscription API
// In a real app, you would save the email to a database (e.g., Prisma)
export async function POST(req: Request) {
    try {
        const { email } = await req.json()

        if (!email || !email.includes("@")) {
            return NextResponse.json(
                { message: "Invalid email address" },
                { status: 400 }
            )
        }

        // 1. In a production app, you would check if the email already exists
        // and then save it to your 'Newsletter' table.
        // For now, we'll proceed to sending the welcome email.

        const subject = "Welcome to the JUNOHUB Newsletter! ⚡"
        const emailHtml = generateNewsletterWelcomeHtml(email)

        const result = await sendEmail({
            to: email,
            subject,
            html: emailHtml
        })

        if (result.success) {
            return NextResponse.json({ message: "Subscription successful" })
        } else {
            logger.error("Failed to send newsletter welcome email", result.error)
            // Even if email fails, we might still want to say success if we saved the record
            return NextResponse.json({ message: "Subscription received, but email failed to send" })
        }
    } catch (error) {
        logger.error("Newsletter subscription error", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}

function generateNewsletterWelcomeHtml(email: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to JUNOHUB</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0e1a; color: #ffffff;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 50px 40px 30px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);">
                            <div style="text-align: center;">
                                <div style="display: inline-flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 20px;">
                                    <div style="width: 56px; height: 56px; background-color: rgba(255, 255, 255, 0.2); border-radius: 16px; display: inline-block; vertical-align: middle;">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-top: 12px;">
                                            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="white"/>
                                        </svg>
                                    </div>
                                    <h1 style="margin: 0; font-size: 32px; font-weight: 900; color: #ffffff; letter-spacing: -1px; display: inline-block; vertical-align: middle; margin-left: 10px;">JUNOHUB</h1>
                                </div>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            <h2 style="margin: 0 0 20px; font-size: 28px; font-weight: 800; color: #ffffff; line-height: 1.2;">
                                YOU&apos;RE IN THE LOOP. ⚡
                            </h2>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                Welcome to the JUNOHUB inner circle. You&apos;ve successfully subscribed to our newsletter.
                            </p>
                            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                                Get ready for exclusive insights into global supply chain trends, early access to new features, and strategies to scale your commerce ecosystem.
                            </p>
                            
                            <div style="background-color: rgba(79, 70, 229, 0.1); border: 1px solid rgba(79, 70, 229, 0.2); border-radius: 16px; padding: 30px; margin: 32px 0;">
                                <h3 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #ffffff;">What&apos;s Next?</h3>
                                <ul style="margin: 0; padding: 0; list-style: none; text-align: left;">
                                    <li style="margin-bottom: 12px; color: #94a3b8; font-size: 14px;">
                                        <span style="color: #6366f1; margin-right: 8px;">✓</span> Stay tuned for our monthly deep-dives.
                                    </li>
                                    <li style="margin-bottom: 12px; color: #94a3b8; font-size: 14px;">
                                        <span style="color: #6366f1; margin-right: 8px;">✓</span> Check out our <a href="https://app.jurassiq-dev.org/platform" style="color: #818cf8; text-decoration: none;">Platform technology</a>.
                                    </li>
                                    <li style="margin: 0; color: #94a3b8; font-size: 14px;">
                                        <span style="color: #6366f1; margin-right: 8px;">✓</span> Connect with us on social media.
                                    </li>
                                </ul>
                            </div>
                            
                            <table role="presentation" style="width: 100%; margin: 40px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="https://app.jurassiq-dev.org" style="display: inline-block; padding: 16px 40px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 800; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                                            Explore Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.1);">
                            <p style="margin: 0 0 12px; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
                                You are receiving this because you subscribed with ${email}.<br>
                                <a href="#" style="color: #4f46e5; text-decoration: none;">Unsubscribe</a> • <a href="https://app.jurassiq-dev.org/privacy-policy" style="color: #4f46e5; text-decoration: none;">Privacy Policy</a>
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #475569; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                                © 2026 JUNOHUB Systems. Powering Modern Commerce.
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
