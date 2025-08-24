#!/bin/bash

# GraphDone MCP Server Setup Script
# This script sets up the MCP server so Claude Code can control your GraphDone graph

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get the project root directory
get_project_root() {
    cd "$(dirname "$0")/.."
    pwd
}

# Main setup function
main() {
    echo "=================================================="
    echo "🔗 GraphDone MCP Server Setup for Claude Code"
    echo "=================================================="
    echo
    echo "What is MCP? MCP (Model Context Protocol) allows Claude Code to directly"
    echo "interact with your GraphDone graph - browse nodes, create tasks, manage"
    echo "relationships, and more - all through natural language commands."
    echo
    
    # Check prerequisites
    print_info "Checking system requirements..."
    
    if ! command_exists node; then
        print_error "Node.js is required but not installed."
        echo "Please install Node.js from https://nodejs.org/ and try again."
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is required but not installed."
        echo "Please install npm and try again."
        exit 1
    fi
    
    print_success "Node.js and npm are installed"
    
    # Get project information
    PROJECT_ROOT=$(get_project_root)
    NODE_PATH=$(which node)
    MCP_DIST_PATH="$PROJECT_ROOT/packages/mcp-server/dist/index.js"
    
    # Navigate to project root
    cd "$PROJECT_ROOT"
    
    # Verify we're in the right place
    if [[ ! -f "package.json" ]] || ! grep -q "graphdone" package.json; then
        print_error "This doesn't appear to be the GraphDone project directory."
        exit 1
    fi
    
    print_info "Found GraphDone project at: $PROJECT_ROOT"
    
    # Install dependencies and build
    print_info "Installing dependencies and building MCP server..."
    npm install --silent
    npm run build --filter=@graphdone/mcp-server --silent
    
    # Check if build was successful
    if [[ ! -f "$MCP_DIST_PATH" ]]; then
        print_error "MCP server build failed. Please check for errors above."
        exit 1
    fi
    
    print_success "MCP server built successfully!"
    
    # Configure with Claude Code
    print_info "Configuring MCP server with Claude Code..."
    
    if ! command_exists claude; then
        print_warning "Claude CLI not found."
        echo "Please make sure Claude Code is installed and updated."
        show_manual_setup
        return
    fi
    
    # Ask user if they want automatic setup
    echo
    echo "Would you like to automatically configure the MCP server? (recommended)"
    read -p "Press Enter for yes, or type 'n' for manual setup: " -r
    echo
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        show_manual_setup
        return
    fi
    
    # Automatic setup using claude mcp command
    print_info "Adding GraphDone MCP server to Claude Code..."
    
    if claude mcp add graphdone "$NODE_PATH" "$MCP_DIST_PATH" \
        --env "NEO4J_URI=${NEO4J_URI:-bolt://localhost:7687}" \
        --env "NEO4J_USER=${NEO4J_USER:-neo4j}" \
        --env "NEO4J_PASSWORD=${NEO4J_PASSWORD:-graphdone_password}" 2>/dev/null; then
        
        print_success "GraphDone MCP server configured successfully!"
        show_success_instructions
    else
        print_error "Automatic configuration failed. Showing manual setup..."
        show_manual_setup
    fi
}

# Show manual setup instructions
show_manual_setup() {
    echo
    echo "=================================================="
    echo "📋 Manual Setup Instructions"
    echo "=================================================="
    echo
    echo "Run this command in your terminal:"
    echo
    echo "claude mcp add graphdone \"$NODE_PATH\" \"$MCP_DIST_PATH\" \\"
    echo "  --env \"NEO4J_URI=bolt://localhost:7687\" \\"
    echo "  --env \"NEO4J_USER=neo4j\" \\"
    echo "  --env \"NEO4J_PASSWORD=graphdone_password\""
    echo
    echo "Or manually add this to your Claude Code settings:"
    echo
    echo "Settings file locations:"
    echo "  • Linux: ~/.config/claude-code/config.json"
    echo "  • macOS: ~/Library/Application Support/claude-code/config.json"
    echo "  • Windows: %APPDATA%/claude-code/config.json"
    echo
    echo "Add this configuration:"
    echo "{"
    echo "  \"mcpServers\": {"
    echo "    \"graphdone\": {"
    echo "      \"command\": \"$NODE_PATH\","
    echo "      \"args\": [\"$MCP_DIST_PATH\"],"
    echo "      \"env\": {"
    echo "        \"NEO4J_URI\": \"bolt://localhost:7687\","
    echo "        \"NEO4J_USER\": \"neo4j\","
    echo "        \"NEO4J_PASSWORD\": \"graphdone_password\""
    echo "      }"
    echo "    }"
    echo "  }"
    echo "}"
    echo
    show_next_steps
}

# Show success instructions
show_success_instructions() {
    echo
    echo "=================================================="
    echo "🎉 Setup Complete!"
    echo "=================================================="
    echo
    echo "The GraphDone MCP server is now configured and ready to use!"
    echo
    show_next_steps
}

# Show next steps
show_next_steps() {
    echo "Next steps:"
    echo
    echo "1. 🗄️  Start your Neo4j database:"
    echo "   docker-compose up -d"
    echo
    echo "2. 🚀 Start GraphDone development server:"
    echo "   npm run dev"
    echo
    echo "3. 🔍 Verify MCP connection in Claude Code:"
    echo "   Type: /mcp"
    echo "   You should see 'graphdone' listed as connected"
    echo
    echo "4. 🎯 Try these MCP commands in Claude Code:"
    echo "   • \"Show me all nodes in the graph\""
    echo "   • \"Create a new task called 'Test MCP'\""
    echo "   • \"Find paths between node A and node B\""
    echo
    echo "Available MCP tools:"
    echo "  📊 browse_graph      - Explore and query nodes"
    echo "  ➕ create_node       - Add new tasks, epics, etc."
    echo "  ✏️  update_node       - Modify existing nodes"
    echo "  🗑️  delete_node       - Remove nodes"
    echo "  🔗 create_edge       - Create relationships between nodes"
    echo "  ✂️  delete_edge       - Remove relationships"
    echo "  🔍 get_node_details  - Get detailed node information"
    echo "  🛤️  find_path         - Find paths between nodes"
    echo "  🔄 detect_cycles     - Detect circular dependencies"
    echo
    echo "If you need to customize the database connection, set these environment"
    echo "variables before running this script:"
    echo "  • NEO4J_URI (default: bolt://localhost:7687)"
    echo "  • NEO4J_USER (default: neo4j)"
    echo "  • NEO4J_PASSWORD (default: graphdone_password)"
    echo
    print_success "Ready to control GraphDone with Claude Code!"
}

# Run the setup
main "$@"