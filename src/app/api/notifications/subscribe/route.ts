import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors'
import { webPushSubscribeSchema, webPushUnsubscribeSchema } from '@/lib/api-schemas/notificationsPush'
import { validationErrorResponse } from '@/lib/api-schemas/validate'

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = webPushSubscribeSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const subscription = parsed.data

        // Upsert the subscription
        await prisma.pushSubscription.upsert({
            where: {
                endpoint: subscription.endpoint
            },
            update: {
                userId: session.user.id,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: req.headers.get('user-agent') || null
            },
            create: {
                userId: session.user.id,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: req.headers.get('user-agent') || null
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return handleApiError(error, 'push-subscribe')
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = webPushUnsubscribeSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { endpoint } = parsed.data

        await prisma.pushSubscription.delete({
            where: { endpoint }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return handleApiError(error, 'push-unsubscribe')
    }
}
