import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// Keep this union in sync with the NotificationType enum in prisma/schema.prisma
type NotificationType =
    | "INVITATION_ACCEPTED"
    | "INVITATION_RECEIVED"
    | "CONNECTION_STATUS_CHANGED"
    | "ORDER_RECEIVED"
    | "PRODUCT_UPDATED"
    | "PRODUCT_SYNC_REQUESTED"
    | "PRODUCT_SYNC_ACCEPTED"
    | "PRODUCT_SYNC_REJECTED"

interface CreateNotificationParams {
    userId: string
    type: NotificationType
    title: string
    message: string
    metadata?: Record<string, unknown>
}

/**
 * Create a notification for a user
 */
export async function createNotification({
    userId,
    type,
    title,
    message,
    metadata
}: CreateNotificationParams) {
    try {
        // Use dynamic access to handle environments where the Notification model
        // is not yet reflected in the generated Prisma client types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const notification = await (prisma as any).notification.create({
            data: {
                userId,
                type,
                title,
                message,
                metadata: metadata ? metadata : undefined
            }
        })
        return notification
    } catch (error) {
        logger.error("Error creating notification", error)
        throw error
    }
}

/**
 * Create notification for vendor when supplier accepts invitation
 */
export async function notifyInvitationAccepted(
    vendorUserId: string,
    supplierName: string,
    storeName: string,
    connectionId: string
) {
    return createNotification({
        userId: vendorUserId,
        type: "INVITATION_ACCEPTED",
        title: "Invitation Accepted",
        message: `${supplierName} has accepted your invitation to connect with ${storeName}`,
        metadata: {
            connectionId,
            supplierName,
            storeName
        }
    })
}

/**
 * Create notification for supplier when they receive an invitation
 */
export async function notifyInvitationReceived(
    supplierUserId: string,
    vendorName: string,
    storeName: string,
    invitationId: string
) {
    return createNotification({
        userId: supplierUserId,
        type: "INVITATION_RECEIVED",
        title: "New Invitation",
        message: `${vendorName} (${storeName}) has sent you a connection invitation`,
        metadata: {
            invitationId,
            vendorName,
            storeName
        }
    })
}

/**
 * Create notification when connection status changes
 */
export async function notifyConnectionStatusChanged(
    userId: string,
    status: "CONNECTED" | "REJECTED",
    otherPartyName: string,
    connectionId: string
) {
    const isConnected = status === "CONNECTED"
    return createNotification({
        userId,
        type: "CONNECTION_STATUS_CHANGED",
        title: isConnected ? "Connection Established" : "Connection Rejected",
        message: isConnected
            ? `Your connection with ${otherPartyName} has been established`
            : `Your connection request with ${otherPartyName} was rejected`,
        metadata: {
            connectionId,
            status,
            otherPartyName
        }
    })
}

/**
 * Create notification for product sync request
 */
export async function notifyProductSyncRequested(
    supplierUserId: string,
    vendorName: string,
    productTitle: string,
    syncId: string
) {
    return createNotification({
        userId: supplierUserId,
        type: "PRODUCT_SYNC_REQUESTED",
        title: "Product Sync Request",
        message: `${vendorName} wants to sync product "${productTitle}" with you`,
        metadata: {
            syncId,
            vendorName,
            productTitle
        }
    })
}

/**
 * Create notification for product sync acceptance/rejection
 */
export async function notifyProductSyncStatusChanged(
    vendorUserId: string,
    supplierName: string,
    productTitle: string,
    status: "ACCEPTED" | "REJECTED",
    syncId: string
) {
    const isAccepted = status === "ACCEPTED"
    return createNotification({
        userId: vendorUserId,
        type: isAccepted ? "PRODUCT_SYNC_ACCEPTED" : "PRODUCT_SYNC_REJECTED",
        title: isAccepted ? "Product Sync Accepted" : "Product Sync Rejected",
        message: isAccepted
            ? `${supplierName} has accepted your product sync request for "${productTitle}"`
            : `${supplierName} has rejected your product sync request for "${productTitle}"`,
        metadata: {
            syncId,
            supplierName,
            productTitle,
            status
        }
    })
}
