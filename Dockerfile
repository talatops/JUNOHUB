FROM node:22-alpine

WORKDIR /app

# Prisma validate/generate needs DATABASE_URL before .env is copied; no DB connection occurs during generate
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
ENV DATABASE_URL=$DATABASE_URL

# Copy package files (.npmrc improves registry resilience during docker build)
COPY package*.json prisma.config.ts .npmrc ./
COPY prisma ./prisma

# Install ALL dependencies (including devDependencies needed for build)
# Retry full npm ci on transient network errors (e.g. ECONNRESET)
RUN set -e; \
  attempt=1; max=5; \
  until npm ci; do \
    attempt=$((attempt + 1)); \
    if [ "$attempt" -gt "$max" ]; then echo "npm ci failed after $max attempts"; exit 1; fi; \
    echo "npm ci failed (attempt $((attempt - 1))/$max), retrying in 15s..."; \
    sleep 15; \
  done && npx prisma generate

# Copy application code (includes .env created in CI from EC2_ENV for NEXT_PUBLIC_* at build time)
COPY . .

# Regenerate client after full tree copy (schema may differ from the early prisma/ layer).
RUN npx prisma generate

# Build the Next.js application (reads .env and embeds NEXT_PUBLIC_* into the bundle)
RUN npm run build

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# Use entrypoint to run migrations before starting the app
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
