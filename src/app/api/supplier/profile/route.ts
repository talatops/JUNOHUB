import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { supplierProfileUpsertSchema } from "@/lib/api-schemas/business"
import { validationErrorResponse } from "@/lib/api-schemas/validate"

/**
 * GET /api/supplier/profile
 * Get supplier profile for authenticated user
 */
export async function GET() {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const supplierProfile = await prisma.supplierProfile.findUnique({
            where: { userId: session.user.id },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: {
                        products: true,
                        connections: true
                    }
                }
            }
        })

        if (!supplierProfile) {
            return NextResponse.json({ message: "Supplier profile not found" }, { status: 404 })
        }

        return NextResponse.json({ profile: supplierProfile })
    } catch (error) {
        console.error("Error fetching supplier profile:", error)
        return NextResponse.json(
            { message: "Failed to fetch supplier profile" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/supplier/profile
 * Create or update supplier profile
 */
export async function POST(req: Request) {
    try {
        const session = await auth()

        if (!session?.user?.id || session.user.role !== "SUPPLIER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const raw = await req.json().catch(() => ({}))
        const parsed = supplierProfileUpsertSchema.safeParse(raw)
        if (!parsed.success) {
            return validationErrorResponse(parsed.error)
        }
        const { companyName, description } = parsed.data

        // Upsert supplier profile
        const supplierProfile = await prisma.supplierProfile.upsert({
            where: { userId: session.user.id },
            update: {
                companyName,
                description: description?.trim() ? description : null,
            },
            create: {
                userId: session.user.id,
                companyName,
                description: description?.trim() ? description : null,
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        })

        return NextResponse.json({
            message: "Supplier profile updated successfully",
            profile: supplierProfile
        })
    } catch (error) {
        console.error("Error updating supplier profile:", error)
        return NextResponse.json(
            { message: "Failed to update supplier profile" },
            { status: 500 }
        )
    }
}
