#!/bin/bash

# GraphDone Cleanup Script
# Kills any processes running on GraphDone's ports

echo "🧹 Cleaning up GraphDone processes..."

# Function to kill processes on a specific port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    
    if [ -n "$pids" ]; then
        echo "🔄 Killing processes on port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        
        # Check if any processes are still running
        local remaining=$(lsof -ti:$port 2>/dev/null)
        if [ -n "$remaining" ]; then
            echo "⚠️  Some processes on port $port are still running: $remaining"
        else
            echo "✅ Port $port is now free"
        fi
    else
        echo "✅ Port $port is already free"
    fi
}

# Clean up GraphDone ports
kill_port 3000  # Web server
kill_port 4000  # GraphQL API

# Also kill any npm/node processes that might be hanging
echo "🔄 Cleaning up any hanging npm/node processes..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true

echo ""
echo "✅ Cleanup complete! You can now run ./start again."