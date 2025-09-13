FROM node:18-alpine

WORKDIR /app

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

# Build server package
RUN npm run build --workspace=@graphdone/server

EXPOSE 4127

CMD ["npm", "run", "start", "--workspace=@graphdone/server"]