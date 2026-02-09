FROM node:20-alpine

WORKDIR /app

COPY package*.json prisma.config.ts ./
COPY prisma ./prisma

RUN npm install && npx prisma generate

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
