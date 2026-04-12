#!/bin/sh
set -e

echo "Waiting for database to be ready..."
until node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => { client.end(); process.exit(0); })
  .catch(() => { process.exit(1); });
" 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

# Optional: recover from P3009 / failed migration (set in compose or .env, then remove after success).
# Rolled back = migration will run again from scratch (only if DB objects from that migration are gone or safe to re-run).
if [ -n "$PRISMA_MIGRATE_RESOLVE_ROLLED_BACK" ]; then
  echo "prisma migrate resolve --rolled-back $PRISMA_MIGRATE_RESOLVE_ROLLED_BACK"
  npx prisma migrate resolve --rolled-back "$PRISMA_MIGRATE_RESOLVE_ROLLED_BACK" ||
    echo "[entrypoint] resolve --rolled-back skipped (not failed state or already cleared)"
fi

# Optional: mark a migration as already applied when the DB matches but _prisma_migrations recorded a failure.
if [ -n "$PRISMA_MIGRATE_RESOLVE_APPLIED" ]; then
  echo "prisma migrate resolve --applied $PRISMA_MIGRATE_RESOLVE_APPLIED"
  npx prisma migrate resolve --applied "$PRISMA_MIGRATE_RESOLVE_APPLIED" ||
    echo "[entrypoint] resolve --applied skipped (already applied or invalid)"
fi

# Clear legacy low-stock rows when the table exists (avoids NOT NULL add failures if db push was used earlier).
if [ "${PRISMA_PRE_MIGRATE_CLEANUP:-1}" != "0" ]; then
  echo "Prisma pre-migrate: clearing LowStockAlertState if table exists..."
  npx prisma db execute --file scripts/prisma-pre-migrate-cleanup.sql 2>/dev/null || true
fi

# P3009: failed row for this migration blocks deploy forever. Migration SQL is idempotent; safe to clear and re-apply.
# No-op when the migration is not in a failed state (resolve exits non-zero → ignored).
echo "Prisma: clear failed supplier_automations lock if present (P3009)..."
npx prisma migrate resolve --rolled-back "20260412180000_supplier_automations" 2>/dev/null || true

echo "Applying Prisma migrations (migrate deploy)..."
if ! npx prisma migrate deploy; then
  echo ""
  echo "migrate deploy failed. If you see P3009 (failed migrations), fix _prisma_migrations then restart."
  echo "Examples (run on host with DATABASE_URL set, or docker compose exec app sh -lc '...'):"
  echo "  npx prisma migrate resolve --rolled-back 20260412180000_supplier_automations"
  echo "  npx prisma migrate resolve --applied 20260412180000_supplier_automations"
  echo "Or set env on the app service once: PRISMA_MIGRATE_RESOLVE_ROLLED_BACK or PRISMA_MIGRATE_RESOLVE_APPLIED"
  exit 1
fi

echo "Regenerating Prisma Client..."
npx prisma generate

echo "Starting application..."
exec "$@"
