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

# Function to clean up processes and handle shutdown
cleanup() {
    echo ""
    echo "🛑 Shutting down GraphDone..."
    
    # Kill development servers
    if [ -n "$DEV_PID" ]; then
        kill $DEV_PID 2>/dev/null || true
    fi
    
    # Clean up any processes on our ports
    lsof -ti:3127 | xargs -r kill -9 2>/dev/null || true
    lsof -ti:4127 | xargs -r kill -9 2>/dev/null || true
    lsof -ti:3128 | xargs -r kill -9 2>/dev/null || true  # HTTPS web
    lsof -ti:4128 | xargs -r kill -9 2>/dev/null || true  # HTTPS API
    
    echo "✅ Cleanup complete"
    exit 0
}

# Set up signal handlers for clean shutdown
trap cleanup SIGINT SIGTERM

# Default mode is Docker production HTTPS
MODE="docker"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            MODE="dev"
            shift
            ;;
        --docker-dev)
            MODE="docker-dev"
            shift
            ;;
        --help|-h)
            echo "GraphDone Production Runner"
            echo ""
            echo "Usage: ./run.sh [OPTIONS]"
            echo ""
            echo "PRODUCTION MODE (default):"
            echo "  ./run.sh                Start production Docker stack with HTTPS"
            echo ""
            echo "DEVELOPMENT MODES:"
            echo "  --dev                   Run with local npm servers (development)"
            echo "  --docker-dev            Run with Docker (development HTTP only)"
            echo ""
            echo "OTHER OPTIONS:"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Production Features:"
            echo "  • Full HTTPS encryption (web + API)"
            echo "  • Auto-generated SSL certificates"
            echo "  • Secure WebSocket connections (WSS)"
            echo "  • Production-optimized containers"
            echo "  • Complete database stack (Neo4j + Redis)"
            echo ""
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
        
        # Clean up any existing Docker containers first
        echo "🧹 Cleaning up any existing Docker containers..."
        ${DOCKER_SUDO}docker-compose -f deployment/docker-compose.yml down 2>/dev/null || true
        ${DOCKER_SUDO}docker-compose -f deployment/docker-compose.dev.yml down 2>/dev/null || true
        
        # Check if database is running
        echo "🔍 Starting database services..."
        echo "🗄️  Starting Neo4j and Redis databases..."
        ${DOCKER_SUDO}docker-compose -f deployment/docker-compose.dev.yml up -d graphdone-neo4j graphdone-redis
        echo "⏳ Waiting for Neo4j to be ready..."
        
        # Wait for Neo4j to be ready
        until ${DOCKER_SUDO}docker-compose -f deployment/docker-compose.dev.yml exec -T graphdone-neo4j cypher-shell -u neo4j -p graphdone_password "RETURN 1" 2>/dev/null; do
            echo "⏳ Neo4j not ready yet, waiting..."
            sleep 3
        done
        echo "✅ Neo4j is ready!"
        
        # Clean up any hanging processes on our ports
        echo "🧹 Cleaning up any processes on ports 3127 and 4127..."
        lsof -ti:3127 | xargs -r kill -9 2>/dev/null || true
        lsof -ti:4127 | xargs -r kill -9 2>/dev/null || true
        sleep 1
        
        # Ensure workspace dependencies are properly set up
        echo "🔧 Ensuring workspace dependencies are ready..."
        
        # Check if core package dist exists, if not run full setup
        if [ ! -f "packages/core/dist/index.js" ]; then
            echo "⚠️  Core package not built. Running workspace setup..."
            npm install
            (cd packages/core && npm run build)
        else
            echo "✅ Core package already built"
        fi
        
        # Double-check that workspace links are working
        if [ ! -L "node_modules/@graphdone/core" ]; then
            echo "⚠️  Workspace links missing. Reinstalling dependencies..."
            npm install
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
            if curl -s http://localhost:3127 > /dev/null 2>&1; then
                web_ready=true
            fi
            
            # Check if GraphQL server is responding
            if curl -s http://localhost:4127/health > /dev/null 2>&1; then
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
        
        # Check if database has data, if not, seed it
        if check_services; then
            echo "🌱 Checking database data..."
            
            # Check if database is empty by trying to get work items count
            work_items_count=$(curl -s -X POST http://localhost:4127/graphql \
                -H "Content-Type: application/json" \
                -d '{"query":"{ workItems { id } }"}' \
                | grep -o '"workItems":\[[^]]*\]' \
                | grep -o '\[.*\]' \
                | grep -o ',' \
                | wc -l 2>/dev/null || echo "0")
            
            # If no work items found, seed the database
            if [ "$work_items_count" -eq 0 ] 2>/dev/null; then
                echo "📊 No data found. Seeding database with sample data..."
                if (cd packages/server && npm run db:seed); then
                    echo "✅ Database seeded!"
                else
                    echo "❌ Database seeding failed!"
                    echo "⚠️  GraphDone is running in LIMITED AUTH-ONLY mode"
                    echo "   Neo4j connection failed - only authentication will work"
                    # Don't show the success banner
                    SEEDING_FAILED=true
                fi
            else
                echo "✅ Database already has data"
            fi
        fi
        
        # Show status box - different based on whether DB connection worked
        echo ""
        if [ "$SEEDING_FAILED" = true ]; then
            echo -e "\033[0;33m"  # Yellow for warning
            echo "╔════════════════════════════════════════════════════════════════╗"
            echo "║                                                                ║"
            echo "║                ⚠️  GraphDone LIMITED MODE ⚠️                   ║"
            echo "║                                                                ║"
            echo "║  📍 Services running (AUTHENTICATION ONLY):                   ║"
            echo "║     🌐 Web App:      http://localhost:3127                     ║"
            echo "║     🔌 GraphQL API:  http://localhost:4127/graphql             ║"
            echo "║     🩺 Health Check: http://localhost:4127/health              ║"
            echo "║                                                                ║"
            echo "║  ❌ DATABASE UNAVAILABLE:                                      ║"
            echo "║     • Neo4j connection failed                                  ║"
            echo "║     • Graph features disabled                                  ║"
            echo "║     • Only user authentication works                          ║"
            echo "║                                                                ║"
            echo "║  🔧 To fix: Check Docker containers and network connectivity  ║"
            echo "║                                                                ║"
            echo "╚════════════════════════════════════════════════════════════════╝"
        else
            echo -e "\033[0;32m"  # Green for success
            echo "╔════════════════════════════════════════════════════════════════╗"
            echo "║                                                                ║"
            echo "║                    🎉 GraphDone is Ready! 🎉                   ║"
            echo "║                                                                ║"
            echo "║  📍 Access your application:                                   ║"
            echo "║     🌐 Web App:      http://localhost:3127                     ║"
            echo "║     🔌 GraphQL API:  http://localhost:4127/graphql             ║"
            echo "║     🩺 Health Check: http://localhost:4127/health              ║"
            echo "║                                                                ║"
            echo "║  💡 Tips:                                                      ║"
            echo "║     • Press Ctrl+C to stop all services                        ║"
            echo "║     • Check logs above for any issues                          ║"
            echo "║     • Visit the web app to start using GraphDone               ║"
            echo "║                                                                ║"
            echo "╚════════════════════════════════════════════════════════════════╝"
        fi
        echo -e "\033[0m"
        echo ""
        
        # Wait for the background process
        wait $DEV_PID
        ;;
        
    "docker")
        echo "🐳 Starting with Docker (production HTTPS)..."
        
        # Ensure SSL certificates exist for production
        if [ ! -f "deployment/certs/server-cert.pem" ] || [ ! -f "deployment/certs/server-key.pem" ]; then
            echo "🔐 Generating SSL certificates for production..."
            ./scripts/generate-ssl-certs.sh
        fi
        
        # Use main compose file (HTTPS production)
        docker-compose -f deployment/docker-compose.yml up --build
        ;;
        
    "docker-dev")
        echo "🐳 Starting with Docker (development)..."
        docker-compose -f deployment/docker-compose.dev.yml up --build
        ;;
esac