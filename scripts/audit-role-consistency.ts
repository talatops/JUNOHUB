#!/usr/bin/env tsx
import "dotenv/config"
import { prisma } from "../src/lib/prisma"

async function main() {
    const shouldApply = process.argv.includes("--apply")
    const mode = shouldApply ? "APPLY" : "DRY_RUN"

    console.log(`[ROLE_AUDIT] Starting role consistency audit in ${mode} mode`)

    const mismatches = await prisma.user.findMany({
        where: {
            role: {
                not: "SUPPLIER",
            },
            supplierProfile: {
                isNot: null,
            },
        },
        select: {
            id: true,
            email: true,
            role: true,
            supplierProfile: {
                select: {
                    id: true,
                    companyName: true,
                },
            },
        },
        orderBy: {
            createdAt: "asc",
        },
    })

    if (mismatches.length === 0) {
        console.log("[ROLE_AUDIT] No mismatches found.")
        return
    }

    console.log(`[ROLE_AUDIT] Found ${mismatches.length} mismatched users:`)
    for (const user of mismatches) {
        console.log(
            ` - userId=${user.id} email=${user.email ?? "N/A"} currentRole=${user.role} supplierProfileId=${user.supplierProfile?.id ?? "N/A"} company=${user.supplierProfile?.companyName ?? "N/A"}`
        )
    }

    if (!shouldApply) {
        console.log(
            '[ROLE_AUDIT] Dry run only. Re-run with "--apply" to update these users to role=SUPPLIER.'
        )
        return
    }

    type MismatchUser = (typeof mismatches)[number]
    const result = await prisma.user.updateMany({
        where: {
            id: {
                in: mismatches.map((u: MismatchUser) => u.id),
            },
        },
        data: {
            role: "SUPPLIER",
        },
    })

    console.log(`[ROLE_AUDIT] Updated ${result.count} user role(s) to SUPPLIER.`)
}

main()
    .catch((error) => {
        console.error("[ROLE_AUDIT] Failed:", error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
