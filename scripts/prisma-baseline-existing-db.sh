#!/usr/bin/env bash
# Use when `prisma migrate deploy` fails on the FIRST migration with errors like:
#   type "UserRole" already exists
# That means the database was created with `db push`, SQL dumps, or old tooling — not via
# migrate history — but `_prisma_migrations` is empty or out of sync.
#
# This script:
# 1. Clears the failed migration record (if any).
# 2. Marks every migration folder EXCEPT the last one listed below as already applied
#    (adjust SKIP_DEPLOY if your DB is missing columns — then run deploy manually).
# 3. Runs `prisma migrate deploy` so pending migrations (e.g. CachedProduct.metafields) apply.
#
# If your database is EMPTY or disposable, prefer: wipe the Postgres volume and run only
#   pnpm prisma migrate deploy
#
set -euo pipefail
cd "$(dirname "$0")/.."

# Last migration to actually run via `deploy` (must match a folder under prisma/migrations).
# Change if you need deploy to apply more than one pending migration.
LAST_TO_APPLY="20260411210000_cached_product_metafields"

echo "==> Resolving failed init migration (ignore errors if none pending)"
pnpm exec prisma migrate resolve --rolled-back "20260216152711_init_schema" 2>/dev/null || true

echo "==> Marking historical migrations as already applied (DB already matches)"
for dir in $(ls -1 prisma/migrations | grep -E '^[0-9]{14}_' | sort); do
  if [[ "$dir" == "$LAST_TO_APPLY" ]]; then
    echo "    (skip) $dir — will be applied by migrate deploy"
    continue
  fi
  echo "    --applied $dir"
  pnpm exec prisma migrate resolve --applied "$dir"
done

echo "==> prisma migrate deploy"
pnpm exec prisma migrate deploy

echo "Done."
