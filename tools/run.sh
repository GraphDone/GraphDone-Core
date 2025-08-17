#!/bin/bash

# GraphDone Development Runner Script

set -e

# Function to ensure Node.js is available
ensure_nodejs() {
    # If node/npm not found, try to source nvm
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        echo "⚠️  Node.js/npm not found in PATH, attempting to load from nvm..."
        
        # Try to load nvm
        export NVM_DIR="$HOME/.nvm"
        if [ -s "$NVM_DIR/nvm.sh" ]; then
            source "$NVM_DIR/nvm.sh"
            if [ -s "$NVM_DIR/bash_completion" ]; then
                source "$NVM_DIR/bash_completion"
            fi
            
            # Use the latest installed version or 18
            if nvm list | grep -q "v18"; then
                nvm use 18
            else
                nvm use node
            fi
            
            echo "✅ Loaded Node.js from nvm: $(node --version)"
        else
            echo "❌ Node.js not found and nvm not available."
            echo "Please restart your terminal or run:"
            echo "  source ~/.bashrc  # or ~/.zshrc"
            echo "  ./tools/run.sh"
            exit 1
        fi
    fi
}

# Default mode
MODE="dev"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            MODE="prod"
            shift
            ;;
        --docker)
            MODE="docker"
            shift
            ;;
        --docker-dev)
            MODE="docker-dev"
            shift
            ;;
        --help|-h)
            echo "GraphDone Development Runner"
            echo ""
            echo "Usage: ./run.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --prod, --production    Run in production mode"
            echo "  --docker                Run with Docker (production)"
            echo "  --docker-dev            Run with Docker (development)"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Default: Development mode with local servers"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 Starting GraphDone in $MODE mode..."

case $MODE in
    "dev")
        echo "📦 Starting development servers..."
        
        # Ensure Node.js is available
        ensure_nodejs
        
        # Check if environment files exist
        if [ ! -f "packages/server/.env" ] || [ ! -f "packages/web/.env" ]; then
            echo "⚠️  Environment files missing. Running setup first..."
            ./tools/setup.sh
        fi
        
        # Check if we need sudo for Docker (detect from previous setup)
        DOCKER_SUDO=""
        if ! docker ps &> /dev/null; then
            echo "⚠️  Docker permission issue detected. Trying with sudo..."
            if sudo docker ps &> /dev/null; then
                DOCKER_SUDO="sudo "
                echo "✅ Using sudo for Docker commands"
            else
                echo "❌ Docker not working even with sudo. Please check Docker installation."
                exit 1
            fi
        fi
        
        # Check if database is running
        echo "🔍 Checking database status..."
        if ! ${DOCKER_SUDO}docker-compose -f deployment/docker-compose.yml ps postgres 2>/dev/null | grep -q "Up"; then
            echo "🐘 Starting database..."
            ${DOCKER_SUDO}docker-compose -f deployment/docker-compose.yml up -d postgres redis
            echo "⏳ Waiting for database to be ready..."
            
            # Wait for PostgreSQL to be ready
            until ${DOCKER_SUDO}docker-compose -f deployment/docker-compose.yml exec -T postgres pg_isready -U graphdone 2>/dev/null; do
                echo "⏳ Database not ready yet, waiting..."
                sleep 2
            done
            echo "✅ Database is ready!"
            
            # Generate Prisma client and run migrations if needed
            echo "🔧 Generating Prisma client..."
            (cd packages/server && npx prisma generate)
            echo "🗄️  Running database migrations..."
            (cd packages/server && npm run db:migrate)
        else
            echo "✅ Database is already running"
        fi
        
        # Start development servers
        echo "🚀 Starting development servers..."
        
        # Start dev servers in background and monitor for readiness
        npm run dev &
        DEV_PID=$!
        
        # Function to check if services are ready
        check_services() {
            local web_ready=false
            local server_ready=false
            
            # Check if web server is responding
            if curl -s http://localhost:3000 > /dev/null 2>&1; then
                web_ready=true
            fi
            
            # Check if GraphQL server is responding
            if curl -s http://localhost:4000/health > /dev/null 2>&1; then
                server_ready=true
            fi
            
            if [ "$web_ready" = true ] && [ "$server_ready" = true ]; then
                return 0
            else
                return 1
            fi
        }
        
        # Wait for services to be ready (max 60 seconds)
        echo "⏳ Waiting for services to start..."
        timeout=60
        elapsed=0
        
        while [ $elapsed -lt $timeout ]; do
            if check_services; then
                break
            fi
            sleep 2
            elapsed=$((elapsed + 2))
        done
        
        # Show status box
        echo ""
        echo -e "\033[0;32m"
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                                                                ║"
        echo "║                    🎉 GraphDone is Ready! 🎉                   ║"
        echo "║                                                                ║"
        echo "║  📍 Access your application:                                   ║"
        echo "║     🌐 Web App:      http://localhost:3000                     ║"
        echo "║     🔌 GraphQL API:  http://localhost:4000/graphql             ║"
        echo "║     🩺 Health Check: http://localhost:4000/health              ║"
        echo "║                                                                ║"
        echo "║  💡 Tips:                                                      ║"
        echo "║     • Press Ctrl+C to stop all services                        ║"
        echo "║     • Check logs above for any issues                          ║"
        echo "║     • Visit the web app to start using GraphDone               ║"
        echo "║                                                                ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo -e "\033[0m"
        echo ""
        
        # Wait for the background process
        wait $DEV_PID
        ;;
        
    "prod")
        echo "🏭 Building for production..."
        npm run build
        
        echo "🚀 Starting production servers..."
        # In a real setup, you'd use pm2 or similar
        npm run start
        ;;
        
    "docker")
        echo "🐳 Starting with Docker (production)..."
        docker-compose -f deployment/docker-compose.yml up --build
        ;;
        
    "docker-dev")
        echo "🐳 Starting with Docker (development)..."
        docker-compose -f deployment/docker-compose.dev.yml up --build
        ;;
esac