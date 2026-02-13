#!/bin/sh
set -e

echo "Waiting for database to be ready..."
# Wait for database to be available (already handled by depends_on in docker-compose, but extra safety)
# Use Node.js to check database connectivity since we have pg available
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

echo "Syncing database schema with Prisma (db push)..."
npx prisma db push

if [ "$RUN_TEMPLATE_SEED_ON_START" = "true" ]; then
  echo "Seeding predefined email templates..."
  # Run seed script; if it fails, log the error but continue starting the app
  if ! npx tsx scripts/seed-templates.ts; then
    echo "Template seeding failed, continuing without seeded templates."
  fi
fi

echo "Starting application..."
exec "$@"
