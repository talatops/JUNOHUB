import { test, expect } from "@playwright/test"

/**
 * Smoke checks against a running app (`pnpm dev` + PLAYWRIGHT_BASE_URL).
 * Skipped by default so `pnpm test` / CI unit runs stay self-contained.
 */
test.describe("public smoke", () => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, "set PLAYWRIGHT_BASE_URL to run E2E")

    test("login page responds", async ({ page }) => {
        const res = await page.goto("/login")
        expect(res?.ok()).toBeTruthy()
        await expect(page.locator("body")).toBeVisible()
    })
})
