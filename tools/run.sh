#!/bin/bash

# GraphDone Development Runner Script

set -e

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
        
        # Check if database is running
        if ! docker-compose -f deployment/docker-compose.yml ps postgres | grep -q "Up"; then
            echo "🐘 Starting database..."
            docker-compose -f deployment/docker-compose.yml up -d postgres redis
            echo "⏳ Waiting for database..."
            sleep 5
        fi
        
        # Start development servers
        npm run dev
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