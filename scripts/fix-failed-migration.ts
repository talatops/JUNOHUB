#!/usr/bin/env tsx
/**
 * Fix Prisma failed migration (P3009) when database has partial schema.
 *
 * Use when: migrate deploy fails with "UserRole already exists" or similar,
 * and Prisma reports a failed migration that blocks new migrations.
 *
 * This script:
 * 1. Marks the failed migration as rolled back
 * 2. Drops and recreates the public schema (clears all objects)
 * 3. Re-applies migrations
 *
 * Usage: npx tsx scripts/fix-failed-migration.ts
 *
 * Requires: DATABASE_URL in .env (e.g. postgresql://postgres:password@localhost:5444/dropshipping)
 */

import "dotenv/config"
import { execSync } from "child_process"
import { Client } from "pg"

const MIGRATION_NAME = "20260216152711_init_schema"

async function main() {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
        console.error("DATABASE_URL is not set in .env")
        process.exit(1)
    }

    console.log("Step 1: Marking failed migration as rolled back...")
    try {
        execSync(`npx prisma migrate resolve --rolled-back ${MIGRATION_NAME}`, {
            stdio: "inherit",
            env: { ...process.env, DATABASE_URL: dbUrl },
        })
        console.log("  ✓ Migration marked as rolled back")
    } catch (e) {
        // May fail if migration record doesn't exist - continue anyway
        console.log("  (Migration resolve completed or migration not in failed state)")
    }

    console.log("\nStep 2: Dropping and recreating public schema...")
    const client = new Client({ connectionString: dbUrl })
    await client.connect()

    try {
        await client.query("DROP SCHEMA public CASCADE")
        await client.query("CREATE SCHEMA public")
        await client.query("GRANT ALL ON SCHEMA public TO postgres")
        await client.query("GRANT ALL ON SCHEMA public TO public")
        await client.query("CREATE EXTENSION IF NOT EXISTS vector")
        console.log("  ✓ Schema reset complete")
    } finally {
        await client.end()
    }

    console.log("\nStep 3: Applying migrations...")
    execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: dbUrl },
    })
    console.log("\n✓ Migration fix complete. Database is ready.")
}

main().catch((err) => {
    console.error("Fix failed:", err)
    process.exit(1)
})
