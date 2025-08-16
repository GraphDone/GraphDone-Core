# Multi-stage build for production
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/

RUN npm ci --only=production

# Build the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build all packages
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 graphdone

# Copy built application
COPY --from=builder --chown=graphdone:nodejs /app/packages/server/dist ./server
COPY --from=builder --chown=graphdone:nodejs /app/packages/web/dist ./web
COPY --from=deps --chown=graphdone:nodejs /app/node_modules ./node_modules

USER graphdone

EXPOSE 4000 3000

CMD ["node", "server/index.js"]