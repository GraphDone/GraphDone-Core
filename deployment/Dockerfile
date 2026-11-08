FROM node:22-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/web/package.json ./packages/web/
RUN npm ci --legacy-peer-deps --no-audit --no-fund && npm rebuild sqlite3 --build-from-source
COPY packages ./packages
RUN npm run build
RUN find packages/core/dist packages/server/dist packages/mcp-server/dist -type f \( -name '*.test.*' -o -name '*.spec.*' \) -delete

FROM node:22-alpine AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/web/package.json ./packages/web/
RUN npm ci --legacy-peer-deps --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --workspace=@graphdone/core --workspace=@graphdone/server --workspace=@graphdone/mcp-server --include-workspace-root=true
COPY --from=build /app/node_modules/sqlite3/build/Release/node_sqlite3.node ./node_modules/sqlite3/build/Release/node_sqlite3.node

FROM node:22-alpine AS runner
RUN apk add --no-cache curl && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 graphdone
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/packages ./packages
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/mcp-server/dist ./packages/mcp-server/dist
COPY --from=build /app/packages/web/dist ./web
RUN mkdir -p /app/packages/server/data && chown graphdone:nodejs /app/packages/server/data
USER graphdone
WORKDIR /app/packages/server
EXPOSE 4127
CMD ["node", "dist/index.js"]
