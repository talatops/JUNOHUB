# PR checklist: validation and API safety

Use this for any change that adds or modifies user input, public endpoints, or tenant-scoped data.

1. **Server schema**: Mutating handlers (`POST` / `PUT` / `PATCH` / `DELETE`) that read JSON should validate with Zod (`safeParse`) and return structured `400` responses (see `validationErrorResponse` in `src/lib/api-schemas/validate.ts`).
2. **Rate limits**: Unauthenticated or abuse-prone endpoints should use `applyRateLimit` from `src/lib/rate-limit.ts` with an explicit window and max.
3. **Authorization**: For routes with `storeId`, `supplierId`, `connectionId`, `orderId`, etc., confirm the authenticated user owns or is linked to that resource before mutating.
4. **Client parity**: High-traffic forms should mirror server limits (`maxLength`, optional Zod pre-check) for UX; never rely on client checks alone for security.
5. **HTML / XSS**: If user content is rendered as HTML, sanitize or use `textContent` / escaped strings; see `src/lib/sanitize/htmlPolicy.ts`.
6. **Tests**: Add or extend Zod unit tests in `src/lib/api-schemas/schemas.test.ts` for new schemas; add route-level tests when authz behavior is non-obvious.
7. **E2E (optional)**: With the dev server running, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test`.
