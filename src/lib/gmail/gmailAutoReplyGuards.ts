import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const GMAIL_AUTO_REPLY_TRIGGERS = [
    "GMAIL_WEBHOOK",
    "GMAIL_POLL",
    "AI_L1_REPLY",
] as const

export function parseEnvInt(name: string, defaultVal: number): number {
    const v = process.env[name]
    if (v == null || v === "") return defaultVal
    const n = Number.parseInt(v, 10)
    return Number.isFinite(n) && n >= 0 ? n : defaultVal
}

export function parseEnvFloat(name: string, defaultVal: number): number {
    const v = process.env[name]
    if (v == null || v === "") return defaultVal
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : defaultVal
}

/**
 * Per-sender caps on automated Gmail replies (loop / abuse mitigation).
 * Set env to 0 to disable that check.
 */
export async function checkGmailAutoReplyRateLimits(
    storeId: string,
    senderEmail: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
    const maxPerHour = parseEnvInt("GMAIL_AUTO_REPLY_MAX_PER_SENDER_PER_HOUR", 15)
    const burstMax = parseEnvInt("GMAIL_AUTO_REPLY_BURST_MAX_PER_10MIN", 6)
    if (maxPerHour <= 0 && burstMax <= 0) return { ok: true }

    const now = Date.now()
    const oneHourAgo = new Date(now - 60 * 60 * 1000)
    const tenMinAgo = new Date(now - 10 * 60 * 1000)

    const baseWhere = {
        storeId,
        to: senderEmail,
        isAutomated: true,
        status: "SENT" as const,
        trigger: { in: [...GMAIL_AUTO_REPLY_TRIGGERS] },
    }

    const [hourlyCount, burstCount] = await Promise.all([
        maxPerHour > 0
            ? prisma.emailLog.count({
                  where: { ...baseWhere, sentAt: { gte: oneHourAgo } },
              })
            : Promise.resolve(0),
        burstMax > 0
            ? prisma.emailLog.count({
                  where: { ...baseWhere, sentAt: { gte: tenMinAgo } },
              })
            : Promise.resolve(0),
    ])

    if (burstMax > 0 && burstCount >= burstMax) {
        return { ok: false, reason: "burst_auto_reply_cap" }
    }
    if (maxPerHour > 0 && hourlyCount >= maxPerHour) {
        return { ok: false, reason: "hourly_auto_reply_cap" }
    }
    return { ok: true }
}

/** Returns false if this inbound Gmail message was already processed (idempotency). */
export async function tryAcquireGmailInboundLease(
    userId: string,
    storeId: string,
    gmailMessageId: string
): Promise<boolean> {
    try {
        await prisma.gmailInboundAutoReply.create({
            data: { userId, storeId, gmailMessageId },
        })
        return true
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            return false
        }
        throw e
    }
}

export async function releaseGmailInboundLease(userId: string, gmailMessageId: string): Promise<void> {
    await prisma.gmailInboundAutoReply.deleteMany({
        where: { userId, gmailMessageId },
    })
}
