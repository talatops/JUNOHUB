import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

vi.mock("@/auth", () => ({
    auth: vi.fn(),
}))

vi.mock("@/lib/push", () => ({
    sendPushNotification: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
    applyRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        chatMessage: { create: vi.fn() },
    },
}))

vi.mock("@/lib/chat/chatThreadAccess", () => ({
    resolveB2bChatPair: vi.fn(),
    hasChatConnectionForStore: vi.fn(),
    countConnectionsForPair: vi.fn(),
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe("POST /api/chat/messages authorization", () => {
    it("returns 403 when the chat pair cannot use the requested store", async () => {
        const { auth } = await import("@/auth")
        const access = await import("@/lib/chat/chatThreadAccess")

        vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never)
        vi.mocked(access.resolveB2bChatPair).mockResolvedValue({
            vendorUserId: "v",
            supplierUserId: "s",
        } as never)
        vi.mocked(access.hasChatConnectionForStore).mockResolvedValue(false)

        const req = new Request("http://localhost/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                receiverId: "other-user",
                storeId: "store-foreign",
                content: "hello",
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(403)
    })
})
