#!/bin/bash

# GraphDone Simple Launcher
# Super quick way to start GraphDone

echo "🚀 GraphDone Quick Start"
echo "========================"
echo ""

# Quick check for dependencies
if ! command -v node &> /dev/null || ! command -v docker &> /dev/null; then
    echo "❌ Missing dependencies. Please ensure Node.js and Docker are installed."
    exit 1
fi

# Run setup if needed, then start
if [ ! -f "packages/server/.env" ]; then
    echo "⚡ Running quick setup..."
    ./tools/setup.sh
fi

echo "🎯 Starting development servers..."
./tools/run.sh

echo ""
echo "✅ GraphDone is running at http://localhost:3000"