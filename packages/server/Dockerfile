FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/core ./packages/core
COPY packages/server ./packages/server
COPY tsconfig.json ./

# Build the application
RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start"]