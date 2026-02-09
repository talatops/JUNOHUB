FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma

# Install dependencies and generate Prisma client
RUN npm install --only=production && npx prisma generate

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

EXPOSE 3000

# Use production start command
CMD ["npm", "start"]
