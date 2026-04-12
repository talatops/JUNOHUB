#!/usr/bin/env bash
# Use ONCE on a database that already matches prisma/schema.prisma but has no (or incomplete)
# _prisma_migrations history — e.g. after P3005 on `prisma migrate deploy`.
# This does NOT run migration SQL; it only records each folder under prisma/migrations as applied.
# If your DB is missing tables/columns, fix schema first (e.g. prisma db execute or manual SQL).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "WARNING: This marks all migrations as applied without running them."
echo "Only continue if your database schema already matches the Prisma schema."
if [[ "${SKIP_CONFIRM:-}" != "YES" ]]; then
  read -r -p "Type YES to continue: " ok
  if [[ ! "$ok" == "YES" ]]; then
    echo "Aborted."
    exit 1
  fi
fi
for dir in prisma/migrations/*/; do
  name="$(basename "$dir")"
  if [[ "$name" == "migration_lock.toml" ]] || [[ ! -d "$dir" ]]; then
    continue
  fi
  echo "Recording as applied: $name"
  npx prisma migrate resolve --applied "$name"
done
echo "Done. Run: npx prisma migrate status"
