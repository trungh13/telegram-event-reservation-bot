# --- Build Stage ---
FROM node:24.13.0-alpine AS builder

WORKDIR /app

# Install dependencies needed for node-gyp or other native modules
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

# Generate Prisma client (provide dummy DATABASE_URL for build)
RUN DATABASE_URL=postgresql://dummy:dummy@dummy:5432/dummy pnpm prisma generate

# Build the app
RUN pnpm build

# --- Production Stage ---
FROM node:24.13.0-alpine AS runner

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Set environment
ENV NODE_ENV=production

# Copy built application and dependencies with proper ownership
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Use non-root user for security
USER node

# Expose port (NestJS default is 3000)
EXPOSE 3000

# Application entrypoint - Fixed: use dist/src/main path (NestJS nest-cli.json sourceRoot: src)
CMD [node, dist/src/main]
