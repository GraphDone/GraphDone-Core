FROM node:18-alpine AS builder

WORKDIR /app

# Accept build arguments for Vite environment variables
ARG VITE_GRAPHQL_URL
ARG VITE_GRAPHQL_WS_URL

# Set environment variables from build args
ENV VITE_GRAPHQL_URL=${VITE_GRAPHQL_URL}
ENV VITE_GRAPHQL_WS_URL=${VITE_GRAPHQL_WS_URL}

# Copy all package files for monorepo workspace
COPY package.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp-server/package.json ./packages/mcp-server/

# Install all dependencies (monorepo workspace)
RUN npm install --legacy-peer-deps

# Copy all source code (needed for monorepo dependencies)
COPY packages/ ./packages/
COPY tsconfig.json ./

# Build core package first (dependency)
RUN npm run build --workspace=@graphdone/core

# Build web package with environment variables
RUN npm run build --workspace=@graphdone/web

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy HTTPS redirect page
COPY packages/web/https_redirect.html /usr/share/nginx/html/

# Copy nginx configuration
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3127

CMD ["nginx", "-g", "daemon off;"]