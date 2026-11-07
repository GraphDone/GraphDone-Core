#!/bin/bash

# GraphDone VM Tools Setup
# This script sets up the prerequisites for VM management

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}GraphDone VM Tools Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for Multipass
echo -e "${CYAN}Checking Multipass...${NC}"
if ! command -v multipass &> /dev/null; then
    echo -e "${RED}❌ Multipass is not installed${NC}"
    echo ""
    echo "Please install Multipass first:"
    echo ""
    echo -e "  ${GREEN}macOS:${NC}   brew install --cask multipass"
    echo -e "  ${GREEN}Ubuntu:${NC}  sudo snap install multipass"
    echo -e "  ${GREEN}Windows:${NC} Download from https://multipass.run"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ Multipass is installed: $(multipass version | head -1)${NC}"
fi

# Check Multipass authentication
echo ""
echo -e "${CYAN}Checking Multipass authentication...${NC}"
if multipass list &> /dev/null; then
    echo -e "${GREEN}✅ Multipass is authenticated${NC}"
else
    echo -e "${YELLOW}⚠️  Multipass needs authentication${NC}"
    echo ""
    echo "Please run: ${GREEN}multipass authenticate${NC}"
    echo "Then re-run this script."
    exit 1
fi

# Install yq if not present
echo ""
echo -e "${CYAN}Checking yq (YAML processor)...${NC}"
if command -v yq &> /dev/null; then
    echo -e "${GREEN}✅ yq is installed: $(yq --version)${NC}"
else
    echo -e "${YELLOW}⚠️  yq is not installed. Installing...${NC}"

    # Detect OS and install yq
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        YQ_VERSION="v4.35.1"
        YQ_BINARY="yq_linux_amd64"

        # Try to install to user's local bin first
        mkdir -p ~/.local/bin

        echo -e "${CYAN}Downloading yq ${YQ_VERSION}...${NC}"
        wget -q "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/${YQ_BINARY}" -O ~/.local/bin/yq
        chmod +x ~/.local/bin/yq

        # Add to PATH if not already there
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            echo ""
            echo -e "${YELLOW}Adding ~/.local/bin to PATH...${NC}"
            echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
            export PATH="$HOME/.local/bin:$PATH"
        fi

        echo -e "${GREEN}✅ yq installed to ~/.local/bin/yq${NC}"

    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &> /dev/null; then
            brew install yq
            echo -e "${GREEN}✅ yq installed via Homebrew${NC}"
        else
            echo -e "${RED}❌ Homebrew not found. Please install yq manually:${NC}"
            echo "  brew install yq"
            exit 1
        fi
    else
        echo -e "${RED}❌ Unsupported OS. Please install yq manually from:${NC}"
        echo "  https://github.com/mikefarah/yq"
        exit 1
    fi
fi

# Verify yq works
echo ""
echo -e "${CYAN}Verifying yq installation...${NC}"
if yq --version &> /dev/null; then
    echo -e "${GREEN}✅ yq is working correctly${NC}"
else
    echo -e "${RED}❌ yq installation failed${NC}"
    exit 1
fi

# All checks passed
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ VM Tools Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "You can now use VM commands:"
echo ""
echo -e "  ${CYAN}./start vm launch${NC}           - Launch a new VM"
echo -e "  ${CYAN}./start vm list${NC}             - List all VMs"
echo -e "  ${CYAN}./start vm shell${NC}            - Connect to VM"
echo -e "  ${CYAN}./start vm --help${NC}           - Show all commands"
echo ""
echo "Quick start:"
echo -e "  ${GREEN}./start vm launch --branch main --cpus 4 --memory 8G${NC}"
echo ""
