FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages ./packages
# Compile the native binding against this image's libc instead of accepting a
# prebuilt SQLite binary that may require a newer glibc than the runtime image.
RUN npm ci --legacy-peer-deps --no-audit --no-fund && npm rebuild sqlite3 --build-from-source
RUN npm run build -w @graphdone/core && npm run build -w @graphdone/server
RUN VITE_GRAPHQL_URL=/api/graphql npm run build -w @graphdone/web
FROM node:22-bookworm-slim AS api
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/packages/server ./packages/server
RUN mkdir -p /app/packages/server/data && chown -R node:node /app/packages/server/data
WORKDIR /app/packages/server
USER node
EXPOSE 4127
CMD ["node","dist/index.js"]
FROM nginx:alpine AS web
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY deployment/self-host/nginx.conf /etc/nginx/conf.d/default.conf
