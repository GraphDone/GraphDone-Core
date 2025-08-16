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
    cp packages/server/.env.example packages/server/.env
    echo "📄 Created packages/server/.env from example"
fi

if [ ! -f "packages/web/.env" ]; then
    cp packages/web/.env.example packages/web/.env
    echo "📄 Created packages/web/.env from example"
fi

# Start database
echo "🐘 Starting PostgreSQL database..."
docker-compose -f deployment/docker-compose.yml up -d postgres redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️  Running database migrations..."
cd packages/server && npm run db:migrate && cd ../..

# Build packages
echo "🏗️  Building packages..."
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