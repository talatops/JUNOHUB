import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { isVendorPortalRole } from "@/lib/auth-roles"
import { prisma } from "@/lib/prisma"
import { sendEmail, generateInvitationEmailHtml } from "@/lib/email"
import { notifyInvitationReceived } from "@/lib/notifications"
import { getBaseUrl } from "@/lib/utils"
import crypto from "crypto"
import { vendorInviteDeleteSchema, vendorInvitePostSchema, validationErrorResponse } from "@/lib/api-schemas"

/**
 * DELETE /api/vendors/suppliers/[supplierId]/invite
 * Cancel a pending invitation
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ supplierId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { supplierId } = await params
        const raw = await req.json().catch(() => ({}))
        const parsed = vendorInviteDeleteSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const storeId = parsed.data.storeId ?? undefined

        // Get vendor's stores
        const vendorStores = await prisma.store.findMany({
            where: {
                userId: session.user.id,
                onboardingComplete: true
            }
        })

        if (vendorStores.length === 0) {
            return NextResponse.json(
                { message: "No stores found" },
                { status: 400 }
            )
        }

        type DeleteFlowStoreRow = (typeof vendorStores)[number]
        const storeIdsToCheck = storeId
            ? [storeId]
            : vendorStores.map((s: DeleteFlowStoreRow) => s.id)

        // Find and delete pending invitations
        const pendingInvitations = await prisma.invitation.findMany({
            where: {
                storeId: { in: storeIdsToCheck },
                supplierId: supplierId,
                used: false,
                expiresAt: {
                    gt: new Date()
                }
            }
        })

        if (pendingInvitations.length === 0) {
            return NextResponse.json(
                { message: "No pending invitations found" },
                { status: 404 }
            )
        }

        // Delete all pending invitations
        type PendingInvRow = (typeof pendingInvitations)[number]
        await prisma.invitation.deleteMany({
            where: {
                id: { in: pendingInvitations.map((inv: PendingInvRow) => inv.id) }
            }
        })

        return NextResponse.json({
            message: `Successfully cancelled ${pendingInvitations.length} invitation(s)`
        })
    } catch (error) {
        console.error("Error cancelling invitation:", error)
        return NextResponse.json(
            { message: "Failed to cancel invitation" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/vendors/suppliers/[supplierId]/invite
 * Send invitation to a supplier
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ supplierId: string }> }
) {
    try {
        const session = await auth()

        if (!session?.user?.id || !isVendorPortalRole(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { supplierId } = await params
        const raw = await req.json().catch(() => ({}))
        const parsed = vendorInvitePostSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const connectToAllStores = parsed.data.connectToAllStores === true

        // Get vendor's stores
        const vendorStores = await prisma.store.findMany({
            where: {
                userId: session.user.id,
                onboardingComplete: true // Only include completed stores
            },
            select: {
                id: true,
                businessName: true,
                userId: true,
                isActive: true
            }
        })

        if (vendorStores.length === 0) {
            return NextResponse.json(
                { message: "No stores found. Please complete onboarding first." },
                { status: 400 }
            )
        }

        type PostFlowStoreRow = (typeof vendorStores)[number]

        // Determine which stores to connect
        const storesToConnect = connectToAllStores
            ? vendorStores
            : vendorStores.filter((store: PostFlowStoreRow) => store.isActive)

        if (storesToConnect.length === 0) {
            return NextResponse.json(
                { message: "No active store found. Please activate a store or complete onboarding." },
                { status: 400 }
            )
        }

        // Get supplier profile with user info
        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { id: supplierId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier not found" }, { status: 404 })
        }

        // Validate email exists
        if (!supplierProfile.user.email) {
            return NextResponse.json(
                { message: "Supplier email not found" },
                { status: 400 }
            )
        }

        // Check for existing connections and invitations for all stores
        const storeIds = storesToConnect.map((s: PostFlowStoreRow) => s.id)
        const existingConnections = await prisma.connection.findMany({
            where: {
                storeId: { in: storeIds },
                supplierId: supplierProfile.id
            }
        })

        const existingInvitations = await prisma.invitation.findMany({
            where: {
                storeId: { in: storeIds },
                supplierId: supplierProfile.id,
                used: false,
                expiresAt: {
                    gt: new Date()
                }
            }
        })

        type ExistingConnectionRow = (typeof existingConnections)[number]
        type ExistingInvitationRow = (typeof existingInvitations)[number]

        // Filter out stores that already have connections or pending invitations
        const connectedStoreIds = new Set([
            ...existingConnections.map((c: ExistingConnectionRow) => c.storeId),
            ...existingInvitations.map((i: ExistingInvitationRow) => i.storeId)
        ])

        const storesToInvite = storesToConnect.filter(
            (store: PostFlowStoreRow) => !connectedStoreIds.has(store.id)
        )

        if (storesToInvite.length === 0) {
            const allConnected = storesToConnect.length === existingConnections.length + existingInvitations.length
            return NextResponse.json(
                {
                    message: allConnected
                        ? "All selected stores are already connected or have pending invitations"
                        : "No stores available to invite (all have existing connections or pending invitations)"
                },
                { status: 400 }
            )
        }

        // Generate invitation tokens and create invitations for each store
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

        const invitations: Array<{ id: string; storeId: string; token: string }> = []
        const storeNames = storesToInvite.map((s: PostFlowStoreRow) => s.businessName).join(", ")

        for (const store of storesToInvite) {
            const invitationToken = crypto.randomBytes(32).toString("hex").toUpperCase().slice(0, 16)

            try {
                const invitation = await prisma.invitation.create({
                    data: {
                        token: invitationToken,
                        storeId: store.id,
                        supplierId: supplierProfile.id,
                        email: supplierProfile.user.email,
                        expiresAt
                    }
                })
                invitations.push({ id: invitation.id, storeId: store.id, token: invitationToken })
            } catch (dbError: unknown) {
                console.error(`Database error creating invitation for store ${store.id}:`, dbError)
                // Continue with other stores
            }
        }

        if (invitations.length === 0) {
            return NextResponse.json(
                { message: "Failed to create invitations" },
                { status: 500 }
            )
        }

        // Send invitation email (use first store's name or combined names)
        const primaryStore = storesToInvite[0]
        const invitationLink = `${getBaseUrl()}/supplier/vendors?token=${invitations[0].token}`

        const emailSubject = connectToAllStores && storesToInvite.length > 1
            ? `Invitation to Connect - ${storesToInvite.length} Stores`
            : `Invitation to Connect - ${primaryStore.businessName}`

        const emailResult = await sendEmail({
            to: supplierProfile.user.email,
            subject: emailSubject,
            html: generateInvitationEmailHtml(
                supplierProfile.user.name || supplierProfile.companyName,
                connectToAllStores && storesToInvite.length > 1 ? storeNames : primaryStore.businessName,
                invitations[0].token, // Use first token in email
                invitationLink
            )
        })

        if (!emailResult.success) {
            console.warn("Email sending failed (but invitations created):", emailResult.error)
            // Continue anyway - invitations are created, supplier can use tokens manually
        }

        // Create notification for supplier about the invitation
        try {
            const vendorName = session.user.name || storesToInvite[0].businessName
            const storeDisplayName = connectToAllStores && storesToInvite.length > 1
                ? `${storesToInvite.length} Stores`
                : primaryStore.businessName

            await notifyInvitationReceived(
                supplierProfile.user.id,
                vendorName,
                storeDisplayName,
                invitations[0].id // Use first invitation ID
            )
        } catch (notifError) {
            console.error("Error creating notification:", notifError)
            // Don't fail the request if notification fails
        }

        return NextResponse.json({
            message: connectToAllStores && storesToInvite.length > 1
                ? `Invitations sent successfully to ${invitations.length} store(s)`
                : "Invitation sent successfully",
            invitations: invitations.map((inv) => ({
                id: inv.id,
                storeId: inv.storeId,
                token: inv.token,
                expiresAt
            })),
            storesConnected: invitations.length,
            totalStores: storesToConnect.length
        })
    } catch (error) {
        console.error("Error sending invitation:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        const errorStack = error instanceof Error ? error.stack : undefined
        console.error("Error details:", { errorMessage, errorStack })
        return NextResponse.json(
            {
                message: "Failed to send invitation",
                error: errorMessage
            },
            { status: 500 }
        )
    }
}
