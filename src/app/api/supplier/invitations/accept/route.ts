import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notifyInvitationAccepted } from "@/lib/notifications"
import { supplierInvitationAcceptSchema, validationErrorResponse } from "@/lib/api-schemas"

/**
 * POST /api/supplier/invitations/accept
 * Accept an invitation using token
 */
export async function POST(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = supplierInvitationAcceptSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { token } = parsed.data

        // Get supplier profile
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        // Find invitation by token
        // TypeScript may not recognize invitation model due to cache, but it exists at runtime
        const invitation = await prisma.invitation.findUnique({
            where: { token: token.toUpperCase() },
            include: {
                store: {
                    select: {
                        id: true,
                        businessName: true,
                        userId: true
                    }
                }
            }
        })

        if (!invitation) {
            return NextResponse.json(
                { message: "Invalid invitation token" },
                { status: 404 }
            )
        }

        // Security checks
        if (invitation.used) {
            return NextResponse.json(
                { message: "This invitation has already been used" },
                { status: 400 }
            )
        }

        if (new Date() > invitation.expiresAt) {
            return NextResponse.json(
                { message: "This invitation has expired" },
                { status: 400 }
            )
        }

        if (invitation.supplierId !== supplierProfile.id) {
            return NextResponse.json(
                { message: "This invitation is not for your supplier account" },
                { status: 403 }
            )
        }

        // Check if connection already exists
        const existingConnection = await prisma.connection.findUnique({
            where: {
                storeId_supplierId: {
                    storeId: invitation.storeId,
                    supplierId: supplierProfile.id
                }
            }
        })

        if (existingConnection) {
            // Mark invitation as used even if connection exists
            // TypeScript may not recognize invitation model due to cache, but it exists at runtime
            await prisma.invitation.update({
                where: { id: invitation.id },
                data: { used: true, usedAt: new Date() }
            })

            return NextResponse.json(
                { message: `Connection already exists with status: ${existingConnection.status}` },
                { status: 400 }
            )
        }

        // Create connection
        const connection = await prisma.connection.create({
            data: {
                storeId: invitation.storeId,
                supplierId: supplierProfile.id,
                status: "CONNECTED" // Auto-connect when supplier accepts via token
            }
        })

        // Mark invitation as used
        // TypeScript may not recognize invitation model due to cache, but it exists at runtime
        await (prisma as any).invitation.update({
            where: { id: invitation.id },
            data: {
                used: true,
                usedAt: new Date()
            }
        })

        // Create notification for vendor
        try {
            await notifyInvitationAccepted(
                invitation.store.userId,
                supplierProfile.companyName,
                invitation.store.businessName,
                connection.id
            )
        } catch (notifError) {
            console.error("Error creating notification:", notifError)
            // Don't fail the request if notification fails
        }

        return NextResponse.json({
            message: "Invitation accepted successfully. You are now connected!",
            connection: {
                id: connection.id,
                status: connection.status,
                vendor: {
                    businessName: invitation.store.businessName
                }
            }
        })
    } catch (error) {
        console.error("Error accepting invitation:", error)
        return NextResponse.json(
            { message: "Failed to accept invitation" },
            { status: 500 }
        )
    }
}
