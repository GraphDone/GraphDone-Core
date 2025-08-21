#!/bin/bash

# GraphDone Workspace Fix Script
# Run this if you're getting "Cannot find module @graphdone/core" errors

echo "🔧 GraphDone Workspace Fix"
echo "=========================="
echo ""
echo "This script will fix common workspace dependency issues."
echo ""

# Clean everything
echo "🧹 Cleaning workspace..."
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf packages/core/dist
rm -rf packages/server/dist
rm -rf packages/web/dist

# Remove build caches
rm -f packages/*/tsconfig.tsbuildinfo
rm -f tsconfig.tsbuildinfo

echo "✅ Cleanup complete"
echo ""

# Reinstall dependencies
echo "📦 Reinstalling dependencies..."
npm install

echo "✅ Dependencies installed"
echo ""

# Build core package first
echo "🏗️  Building core package..."
cd packages/core && npm run build && cd ../..

echo "✅ Core package built"
echo ""

# Verify workspace links
echo "🔍 Verifying workspace setup..."
if [ -L "node_modules/@graphdone/core" ]; then
    echo "✅ Workspace link exists: node_modules/@graphdone/core"
else
    echo "❌ Workspace link missing: node_modules/@graphdone/core"
    exit 1
fi

if [ -f "packages/core/dist/index.js" ]; then
    echo "✅ Core package compiled: packages/core/dist/index.js"
else
    echo "❌ Core package not compiled: packages/core/dist/index.js"
    exit 1
fi

echo ""
echo "✅ Workspace fix complete!"
echo ""
echo "🚀 You can now run: ./start"