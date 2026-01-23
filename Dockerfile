# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for node-gyp or other native modules if any
RUN apk add --no-cache openssl

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the app
RUN pnpm build

# --- Production Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

# Install pnpm
RUN npm install -g pnpm

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Set environment variables
ENV NODE_ENV=production

# Expose port (NestJS default is 3000)
EXPOSE 3000

# Start command: run migrations then start the app
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
