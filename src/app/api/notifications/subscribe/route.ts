import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors'

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
        }

        const subscription = await req.json()

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return NextResponse.json({ message: 'Invalid subscription data' }, { status: 400 })
        }

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

        const { endpoint } = await req.json()

        if (!endpoint) {
            return NextResponse.json({ message: 'Endpoint is required' }, { status: 400 })
        }

        await prisma.pushSubscription.delete({
            where: { endpoint }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return handleApiError(error, 'push-unsubscribe')
    }
}
