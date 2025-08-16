#!/bin/bash

# GraphDone Build Script

set -e

# Default options
CLEAN=false
PRODUCTION=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --production|--prod)
            PRODUCTION=true
            shift
            ;;
        --help|-h)
            echo "GraphDone Build Script"
            echo ""
            echo "Usage: ./build.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean                 Clean before building"
            echo "  --production, --prod    Build for production"
            echo "  --help, -h              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🏗️  Building GraphDone..."

# Clean if requested
if [ "$CLEAN" = true ]; then
    echo "🧹 Cleaning previous builds..."
    npm run clean
fi

# Set environment
if [ "$PRODUCTION" = true ]; then
    echo "🏭 Building for production..."
    export NODE_ENV=production
else
    echo "🔧 Building for development..."
    export NODE_ENV=development
fi

# Run pre-build checks
echo "🔍 Running pre-build checks..."
npm run lint
npm run typecheck

# Build packages
echo "📦 Building packages..."
npm run build

# Run tests to ensure build is working
echo "🧪 Running tests to verify build..."
npm run test

echo "✅ Build completed successfully!"

if [ "$PRODUCTION" = true ]; then
    echo ""
    echo "📦 Production build artifacts:"
    echo "  packages/core/dist/"
    echo "  packages/server/dist/"
    echo "  packages/web/dist/"
    echo ""
    echo "🚀 Ready for deployment!"
fi