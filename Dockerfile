FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci && npx prisma generate

# Copy application code
COPY . .

# Build-time env vars (NEXT_PUBLIC_* are embedded into the JS bundle)
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Build the Next.js application
RUN npm run build

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# Use entrypoint to run migrations before starting the app
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
