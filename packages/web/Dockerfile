FROM node:18-alpine AS builder

# Build argument for base path
ARG BASE_PATH=/

WORKDIR /app

# Copy package files
COPY package.json package-lock.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/core ./packages/core
COPY packages/web ./packages/web
COPY tsconfig.json ./

# Build the application with BASE_PATH
ENV BASE_PATH=${BASE_PATH}
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]