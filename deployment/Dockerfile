# Multi-stage build for production
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp-server/package.json ./packages/mcp-server/

RUN npm ci --legacy-peer-deps

# Build the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
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
COPY --from=builder --chown=graphdone:nodejs /app/package.json ./package.json
COPY --from=builder --chown=graphdone:nodejs /app/packages/core ./packages/core
COPY --from=builder --chown=graphdone:nodejs /app/packages/server ./packages/server
COPY --from=builder --chown=graphdone:nodejs /app/packages/web/dist ./web
COPY --from=deps --chown=graphdone:nodejs /app/node_modules ./node_modules

USER graphdone

EXPOSE 4127

WORKDIR /app/packages/server
CMD ["node", "dist/index.js"]
