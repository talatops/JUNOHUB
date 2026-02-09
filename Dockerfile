FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci && npx prisma generate

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

EXPOSE 3000

# Use production start command
CMD ["npm", "start"]
