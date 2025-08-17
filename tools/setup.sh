#!/bin/bash

# GraphDone Development Setup Script

echo "🚀 Setting up GraphDone development environment..."

# Function to install Node.js using Node Version Manager (nvm)
install_nodejs() {
    echo "🔧 Installing Node.js 18..."
    
    # Check if nvm is available
    if command -v nvm &> /dev/null; then
        echo "📦 Using existing nvm to install Node.js..."
        nvm install 18
        nvm use 18
    elif [ -f "$HOME/.nvm/nvm.sh" ]; then
        echo "📦 Loading nvm and installing Node.js..."
        source "$HOME/.nvm/nvm.sh"
        nvm install 18
        nvm use 18
    else
        echo "📥 Installing nvm (Node Version Manager) first..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        source "$HOME/.nvm/nvm.sh"
        nvm install 18
        nvm use 18
    fi
    
    echo "✅ Node.js 18 installed successfully!"
}

# Enhanced prerequisite checking with helpful installation guidance
check_nodejs() {
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is required but not installed."
        echo ""
        echo "🚀 Would you like to install Node.js 18 automatically? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            install_nodejs
        else
            echo ""
            echo "📋 Please install Node.js 18+ manually using one of these methods:"
            echo ""
            echo "🔹 Using Node Version Manager (nvm) - RECOMMENDED:"
            echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            echo "   source ~/.nvm/nvm.sh"
            echo "   nvm install 18"
            echo "   nvm use 18"
            echo ""
            echo "🔹 Download from official website:"
            echo "   https://nodejs.org/en/download/"
            echo ""
            echo "🔹 Using package managers:"
            echo "   • Ubuntu/Debian: sudo apt update && sudo apt install nodejs npm"
            echo "   • macOS (Homebrew): brew install node"
            echo "   • Windows (Chocolatey): choco install nodejs"
            echo ""
            echo "Then run this setup script again: ./tools/setup.sh"
            exit 1
        fi
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "❌ Node.js 18+ is required. Current version: $(node --version)"
        echo ""
        echo "🚀 Would you like to upgrade to Node.js 18 automatically? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            install_nodejs
        else
            echo "Please upgrade Node.js to version 18 or higher and run setup again."
            exit 1
        fi
    fi
}

check_command() {
    local cmd=$1
    local install_guide=$2
    
    if ! command -v $cmd &> /dev/null; then
        echo "❌ $cmd is required but not installed."
        if [ -n "$install_guide" ]; then
            echo ""
            echo "📋 Installation guide:"
            echo "$install_guide"
        fi
        echo ""
        exit 1
    fi
}

echo "📋 Checking prerequisites..."

# Check Node.js with automatic installation option
check_nodejs

# Check npm (should be available with Node.js)
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not found. This usually comes with Node.js."
    echo "Please reinstall Node.js or install npm separately."
    exit 1
fi

# Check Docker with installation guidance
check_command docker "🔹 Ubuntu/Debian: https://docs.docker.com/engine/install/ubuntu/
🔹 macOS: https://docs.docker.com/desktop/mac/install/
🔹 Windows: https://docs.docker.com/desktop/windows/install/"

# Check Docker permissions
check_docker_permissions() {
    if ! docker ps &> /dev/null; then
        echo "❌ Docker permission denied. This usually means your user needs to be added to the docker group."
        echo ""
        echo "🔧 To fix this issue, run these commands:"
        echo "   sudo usermod -aG docker \$USER"
        echo "   newgrp docker"
        echo ""
        echo "🔄 Or restart your terminal/computer after running:"
        echo "   sudo usermod -aG docker \$USER"
        echo ""
        echo "⚡ Quick fix for this session (requires password):"
        echo "   We can run Docker commands with sudo for now"
        echo ""
        echo "🚀 Would you like to continue with sudo for this setup? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            export DOCKER_SUDO=1
            echo "✅ Will use sudo for Docker commands in this session"
        else
            echo ""
            echo "Please fix Docker permissions and run setup again:"
            echo "  sudo usermod -aG docker \$USER"
            echo "  newgrp docker"
            echo "  ./tools/setup.sh"
            exit 1
        fi
    fi
}

# Check Docker Compose with installation guidance  
check_command docker-compose "🔹 Install with: sudo apt install docker-compose
🔹 Or use Docker Compose V2: docker compose
🔹 Guide: https://docs.docker.com/compose/install/"

# Check Docker permissions
check_docker_permissions

echo "✅ Prerequisites check passed"

# Re-enable strict error handling after interactive prompts
set -e

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
if [ "$DOCKER_SUDO" = "1" ]; then
    sudo docker-compose -f deployment/docker-compose.yml up -d postgres redis
else
    docker-compose -f deployment/docker-compose.yml up -d postgres redis
fi

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
if [ "$DOCKER_SUDO" = "1" ]; then
    until sudo docker-compose -f deployment/docker-compose.yml exec -T postgres pg_isready -U graphdone 2>/dev/null; do
        echo "⏳ Database not ready yet, waiting..."
        sleep 2
    done
else
    until docker-compose -f deployment/docker-compose.yml exec -T postgres pg_isready -U graphdone 2>/dev/null; do
        echo "⏳ Database not ready yet, waiting..."
        sleep 2
    done
fi
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