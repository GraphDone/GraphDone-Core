#!/bin/bash

# GraphDone Node.js Auto-Setup Script
# Sets up Node.js using multiple methods for GraphDone development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 GraphDone Node.js Auto-Setup${NC}"
echo "================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Node.js is already available
if command_exists node && command_exists npm; then
    echo -e "${GREEN}✅ Node.js is already installed: $(node --version)${NC}"
    echo -e "${GREEN}✅ npm is available: $(npm --version)${NC}"
    exit 0
fi

echo -e "${YELLOW}⚠️  Node.js not found, installing automatically...${NC}"

# Method 1: Try snap without sudo first
echo "🔧 Attempting snap installation (no sudo)..."
if snap install node --classic 2>/dev/null; then
    echo -e "${GREEN}✅ Node.js installed via snap successfully${NC}"
    # Add snap to PATH
    export PATH="/snap/bin:$PATH"

    # Verify installation
    if command_exists node; then
        echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
        echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"

        # Update shell profile to include snap in PATH
        if [ -f "$HOME/.bashrc" ] && ! grep -q "/snap/bin" "$HOME/.bashrc"; then
            echo 'export PATH="/snap/bin:$PATH"' >> "$HOME/.bashrc"
            echo -e "${CYAN}📝 Added /snap/bin to ~/.bashrc${NC}"
        fi

        echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
        exit 0
    fi
fi

# Method 2: Try with sudo if user approves
echo -e "${YELLOW}⚠️  Standard snap installation failed${NC}"
echo "Node.js installation requires administrator privileges."
read -p "Install Node.js with sudo? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Installing Node.js via snap with sudo..."

    if sudo snap install node --classic; then
        # Add snap to PATH
        export PATH="/snap/bin:$PATH"

        # Verify installation
        if command_exists node; then
            echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
            echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"

            # Update shell profile
            if [ -f "$HOME/.bashrc" ] && ! grep -q "/snap/bin" "$HOME/.bashrc"; then
                echo 'export PATH="/snap/bin:$PATH"' >> "$HOME/.bashrc"
                echo -e "${CYAN}📝 Added /snap/bin to ~/.bashrc${NC}"
            fi

            echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
            exit 0
        fi
    fi
fi

# Method 3: Fallback to nvm (no sudo needed)
echo -e "${YELLOW}📦 Falling back to nvm installation (no sudo required)...${NC}"

# Install nvm
if ! command_exists nvm; then
    echo "🔧 Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

    # Load nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install Node.js via nvm
if command_exists nvm; then
    echo "🔧 Installing Node.js 18 via nvm..."
    nvm install 18
    nvm use 18
    nvm alias default 18

    if command_exists node; then
        echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
        echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
        echo -e "${GREEN}🎉 Node.js installation completed via nvm!${NC}"
        exit 0
    fi
fi

# If all methods failed
echo -e "${RED}❌ All installation methods failed${NC}"
echo "Please install Node.js manually:"
echo "  1. Visit: https://nodejs.org/"
echo "  2. Or run: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
exit 1