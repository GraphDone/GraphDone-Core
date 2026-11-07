#!/bin/bash

# GraphDone Deployment Script

set -e

# Default options
ENVIRONMENT="staging"
BUILD=true
MIGRATE=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env|-e)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --no-build)
            BUILD=false
            shift
            ;;
        --no-migrate)
            MIGRATE=false
            shift
            ;;
        --help|-h)
            echo "GraphDone Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --env ENV, -e ENV       Target environment (staging, production)"
            echo "  --no-build              Skip build step"
            echo "  --no-migrate            Skip database migration"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh                      # Deploy to staging"
            echo "  ./deploy.sh --env production     # Deploy to production"
            echo "  ./deploy.sh --no-build           # Deploy without rebuilding"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 Deploying GraphDone to $ENVIRONMENT..."

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Valid environments: staging, production"
    exit 1
fi

# Build if requested
if [ "$BUILD" = true ]; then
    echo "🏗️  Building for deployment..."
    (cd "$(dirname "$0")/../.." && ./start build)
fi

# Run database migrations if requested
if [ "$MIGRATE" = true ]; then
    echo "🗄️  Running database migrations..."
    case $ENVIRONMENT in
        "staging")
            echo "📊 Migrating staging database..."
            # Add staging migration logic here
            ;;
        "production")
            echo "⚠️  Migrating production database..."
            echo "🚨 This will affect the production database. Continue? (y/N)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                # Add production migration logic here
                echo "✅ Production migration completed"
            else
                echo "❌ Migration cancelled"
                exit 1
            fi
            ;;
    esac
fi

# Deploy based on environment
case $ENVIRONMENT in
    "staging")
        echo "🎭 Deploying to staging environment..."
        # Add staging deployment logic here
        # Example: docker-compose -f docker-compose.staging.yml up -d
        echo "✅ Deployed to staging"
        echo "🌐 Staging URL: https://staging.graphdone.app"
        ;;
    "production")
        echo "🏭 Deploying to production environment..."
        echo "⚠️  This will deploy to production. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            # Add production deployment logic here
            # Example: kubernetes, docker swarm, etc.
            echo "✅ Deployed to production"
            echo "🌐 Production URL: https://graphdone.app"
        else
            echo "❌ Deployment cancelled"
            exit 1
        fi
        ;;
esac

echo "🎉 Deployment completed successfully!"