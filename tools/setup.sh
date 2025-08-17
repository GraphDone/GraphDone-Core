#!/bin/bash

# GraphDone Development Setup Script

set -e

echo "🚀 Setting up GraphDone development environment..."

# Check for required tools
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is required but not installed. Please install it first."
        exit 1
    fi
}

echo "📋 Checking prerequisites..."
check_command node
check_command npm
check_command docker
check_command docker-compose

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set up environment variables
echo "🔧 Setting up environment variables..."
if [ ! -f "packages/server/.env" ]; then
    echo "📄 Creating packages/server/.env with default values"
    cat > packages/server/.env << 'EOF'
# Database
DATABASE_URL="postgresql://graphdone:graphdone_password@localhost:5432/graphdone"

# Server
PORT=4000
NODE_ENV=development

# CORS
CORS_ORIGIN="http://localhost:3000"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Secret (change in production)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
EOF
fi

if [ ! -f "packages/web/.env" ]; then
    echo "📄 Creating packages/web/.env with default values"
    cat > packages/web/.env << 'EOF'
# GraphQL API URLs
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_GRAPHQL_WS_URL=ws://localhost:4000/graphql

# Environment
VITE_NODE_ENV=development
EOF
fi

# Start database
echo "🐘 Starting PostgreSQL database..."
docker-compose -f deployment/docker-compose.yml up -d postgres redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until docker-compose -f deployment/docker-compose.yml exec -T postgres pg_isready -U graphdone 2>/dev/null; do
    echo "⏳ Database not ready yet, waiting..."
    sleep 2
done
echo "✅ Database is ready!"

# Generate Prisma client and run migrations
echo "🔧 Generating Prisma client..."
cd packages/server && npx prisma generate && cd ../..
echo "🗄️  Running database migrations..."
cd packages/server && npm run db:migrate && cd ../..

# Build packages in correct order (Turbo handles dependencies)
echo "🏗️  Building packages..."
# Clean any stale build cache that might prevent proper compilation
echo "🧹 Cleaning build cache..."
(cd packages/core && rm -f tsconfig.tsbuildinfo)
(cd packages/server && rm -f tsconfig.tsbuildinfo)
(cd packages/web && rm -f tsconfig.tsbuildinfo)
npm run build

echo "✅ Setup complete!"
echo ""
echo "🎯 Quick start commands:"
echo "  npm run dev              # Start development servers"
echo "  npm run test             # Run tests"
echo "  npm run docker:dev       # Start with Docker"
echo ""
echo "🌐 URLs:"
echo "  Web app:      http://localhost:3000"
echo "  GraphQL API:  http://localhost:4000/graphql"
echo "  Database:     postgresql://graphdone:graphdone_password@localhost:5432/graphdone"