FROM node:18-alpine AS builder

# Build arguments
ARG BASE_PATH=/
ARG GIT_BRANCH=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_TAG=unknown

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

# Build the application with BASE_PATH and version info
ENV BASE_PATH=${BASE_PATH}
ENV VITE_GIT_BRANCH=${GIT_BRANCH}
ENV VITE_GIT_COMMIT=${GIT_COMMIT}
ENV VITE_BUILD_TAG=${BUILD_TAG}
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]