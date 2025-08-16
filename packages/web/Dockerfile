FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/core ./packages/core
COPY packages/web ./packages/web
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]