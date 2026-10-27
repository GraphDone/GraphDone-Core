FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/web/package.json ./packages/web/
# Compile the native binding against this image's libc instead of accepting a
# prebuilt SQLite binary that may require a newer glibc than the runtime image.
RUN npm ci --legacy-peer-deps --no-audit --no-fund && npm rebuild sqlite3 --build-from-source
COPY packages ./packages
RUN npm run build -w @graphdone/core && npm run build -w @graphdone/server && npm run build -w @graphdone/mcp-server
RUN VITE_GRAPHQL_URL=/api/graphql npm run build -w @graphdone/web
RUN find packages/core/dist packages/server/dist packages/mcp-server/dist -type f \( -name '*.test.*' -o -name '*.spec.*' \) -delete
FROM node:22-bookworm-slim AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/web/package.json ./packages/web/
RUN npm ci --legacy-peer-deps --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --workspace=@graphdone/core --workspace=@graphdone/server --workspace=@graphdone/mcp-server --include-workspace-root=true
COPY --from=build /app/node_modules/sqlite3/build/Release/node_sqlite3.node ./node_modules/sqlite3/build/Release/node_sqlite3.node
FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade tzdata && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx
WORKDIR /app
COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/packages ./packages
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/mcp-server/dist ./packages/mcp-server/dist
RUN mkdir -p /app/packages/server/data && chown -R node:node /app/packages/server/data
WORKDIR /app/packages/server
USER node
EXPOSE 4127
CMD ["node","dist/index.js"]
FROM nginx:alpine AS web
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY deployment/self-host/nginx.conf /etc/nginx/conf.d/default.conf
