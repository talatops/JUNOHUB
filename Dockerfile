FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application code (includes .env created in CI from EC2_ENV for NEXT_PUBLIC_* at build time)
COPY . .

# Regenerate Prisma Client with final schema before building Next.js
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
