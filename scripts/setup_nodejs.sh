#!/bin/bash

# GraphDone Node.js Auto-Installation Script
# Installs Node.js using platform-specific methods
#
# Installation methods by platform:
# Linux: NodeSource repository, system package managers
# macOS: Homebrew, official installer

set -euo pipefail

# Cleanup function
cleanup() {
    rm -f "/tmp/nodesource_setup.sh" 2>/dev/null || true
}

# Set up signal handlers
trap cleanup EXIT INT TERM

USER=$(whoami)

# Helper function to check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Error handling function
handle_error() {
    local exit_code=$?
    local line_number=$1
    echo "✗ Error occurred at line ${line_number}, exit code: ${exit_code}" >&2
    cleanup
    exit "${exit_code}"
}

# Set up error handler
trap 'handle_error ${LINENO}' ERR

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    else
        OS="unknown"
        printf "  ${YELLOW}✗${NC} ${BOLD}Unsupported OS${NC} ${GRAY}${OSTYPE}${NC}\n" >&2
        printf "  ${BLUE}ⓘ${NC} ${GRAY}Supported: macOS, Linux${NC}\n" >&2
        exit 1
    fi
}

detect_os

# Modern color palette
if [ -t 1 ]; then
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        CYAN='\033[38;5;51m'
        GREEN='\033[38;5;154m'  
        YELLOW='\033[38;5;220m'
        PURPLE='\033[38;5;135m'
        BLUE='\033[38;5;33m'
        GRAY='\033[38;5;244m'
        BOLD='\033[1m'
        DIM='\033[2m'
        NC='\033[0m'
    else
        CYAN='\033[0;36m'
        GREEN='\033[0;32m'
        YELLOW='\033[0;33m' 
        PURPLE='\033[0;35m'
        BLUE='\033[0;34m'
        GRAY='\033[0;90m'
        BOLD='\033[1m'
        DIM='\033[2m'
        NC='\033[0m'
    fi
else
    CYAN='' GREEN='' YELLOW='' PURPLE='' BLUE='' GRAY='' BOLD='' DIM='' NC=''
fi

echo ""
printf "        ${CYAN}${BOLD}📦 Node.js Setup${NC}\n"
printf "        ${GRAY}${DIM}──────────────────────────${NC}\n"

# Function to check if Node.js is installed with correct version
check_nodejs_installed() {
    if command -v node &> /dev/null; then
        local node_version=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo '0')
        local npm_version=$(npm --version 2>/dev/null | cut -d. -f1 || echo '0')
        
        if [ "$node_version" -ge 18 ] && [ "$npm_version" -ge 9 ]; then
            local node_full=$(node --version 2>/dev/null || echo 'unknown')
            local npm_full=$(npm --version 2>/dev/null || echo 'unknown')
            printf "        ${GREEN}✓${NC} Node.js ${node_full} and npm ${npm_full} already installed\n"
            return 0
        else
            printf "        ${YELLOW}⚠${NC} Node.js ${node_full:-unknown} found but version requirements not met\n"
            printf "        ${GRAY}  Required: Node.js >= 18.0.0, npm >= 9.0.0${NC}\n"
            return 1
        fi
    else
        printf "        ${BLUE}◉${NC} Node.js not found - installing latest version\n"
        return 1
    fi
}

# Function to install Node.js with platform-specific methods
install_nodejs() {
    case "${OS}" in
        "macos")
            install_nodejs_macos
            ;;
        "linux")
            install_nodejs_linux
            ;;
        *)
            echo "✗ Unsupported operating system: ${OSTYPE}" >&2
            return 1
            ;;
    esac
}

# macOS Node.js installation
install_nodejs_macos() {
    # Check if Homebrew is available
    if command -v brew &> /dev/null; then
        # Set environment to avoid prompts
        export HOMEBREW_NO_AUTO_UPDATE=1
        export HOMEBREW_NO_ENV_HINTS=1
        
        # Install Node.js latest with minimal output
        printf "        ${BLUE}◉${NC} Installing Node.js (latest)"
        
        # Start installation in background
        brew install node >/dev/null 2>&1 &
        install_pid=$!
        
        # Show spinner while installing
        spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        i=0
        
        while kill -0 $install_pid 2>/dev/null; do
            printf "\r        ${BLUE}◉${NC} Installing Node.js (latest) ${CYAN}${spin:i:1}${NC}"
            i=$(( (i+1) % ${#spin} ))
            sleep 0.15
        done
        wait $install_pid
        
        printf "\r        ${GREEN}✓${NC} Node.js installed                    \n"
        return 0
    else
        # Fallback to official installer
        printf "${YELLOW}!${NC} Please install from: https://nodejs.org/en/download/prebuilt-installer\n"
        printf "${CYAN}❯${NC} ${BOLD}Have you installed Node.js?${NC} ${GRAY}[Press Enter when done]${NC}\n"
        read -r response
        return 0
    fi
}

# Linux Node.js installation
install_nodejs_linux() {
    # Try NodeSource repository (recommended for latest version)
    printf "${BLUE}◉${NC} Installing Node.js via NodeSource repository\n"
    
    # Download NodeSource setup script
    printf "${BLUE}◉${NC} ${GRAY}Adding NodeSource repository${NC}"
    curl -fsSL https://deb.nodesource.com/setup_current.x > /tmp/nodesource_setup.sh 2>&1 &
    download_pid=$!
    
    # Show spinner while downloading
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    i=0
    
    while kill -0 $download_pid 2>/dev/null; do
        printf "\r${BLUE}◉${NC} ${GRAY}Adding NodeSource repository${NC} ${CYAN}${spin:i:1}${NC}"
        i=$(( (i+1) % ${#spin} ))
        sleep 0.15
    done
    wait $download_pid
    
    if [ -f "/tmp/nodesource_setup.sh" ]; then
        # Run the setup script
        printf "\r${BLUE}◉${NC} ${GRAY}Configuring repository${NC}        \n"
        if sudo bash /tmp/nodesource_setup.sh >/dev/null 2>&1; then
            printf "${GREEN}✓${NC} NodeSource repository configured\n"
            
            # Install Node.js
            printf "${BLUE}◉${NC} ${GRAY}Installing Node.js${NC}"
            sudo apt-get install -y nodejs >/dev/null 2>&1 &
            install_pid=$!
            
            # Show spinner while installing
            i=0
            while kill -0 $install_pid 2>/dev/null; do
                printf "\r${BLUE}◉${NC} ${GRAY}Installing Node.js${NC} ${CYAN}${spin:i:1}${NC}"
                i=$(( (i+1) % ${#spin} ))
                sleep 0.15
            done
            wait $install_pid
            
            printf "\r${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}installed successfully${NC}        \n"
            cleanup
            return 0
        fi
    fi
    
    # Fallback to system package manager
    printf "\r${YELLOW}!${NC} ${GRAY}Trying system package manager${NC}        \n"
    if command -v apt-get >/dev/null 2>&1; then
        printf "${BLUE}◉${NC} Installing via apt-get\n"
        sudo apt-get update >/dev/null 2>&1
        sudo apt-get install -y nodejs npm >/dev/null 2>&1
        return 0
    elif command -v yum >/dev/null 2>&1; then
        printf "${BLUE}◉${NC} Installing via yum\n"
        sudo yum install -y nodejs npm >/dev/null 2>&1
        return 0
    elif command -v dnf >/dev/null 2>&1; then
        printf "${BLUE}◉${NC} Installing via dnf\n"
        sudo dnf install -y nodejs npm >/dev/null 2>&1
        return 0
    else
        printf "${RED}✗${NC} No supported package manager found\n"
        printf "${YELLOW}!${NC} ${GRAY}Please install manually from: https://nodejs.org/en/download/package-manager${NC}\n"
        return 1
    fi
}

# Function to verify Node.js installation
verify_nodejs() {
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        local node_version=$(node --version 2>/dev/null || echo "unknown")
        local npm_version=$(npm --version 2>/dev/null || echo "unknown")
        local node_major=$(echo "$node_version" | sed 's/v//' | cut -d. -f1 || echo "0")
        local npm_major=$(echo "$npm_version" | cut -d. -f1 || echo "0")
        
        if [ "$node_major" -ge 18 ] && [ "$npm_major" -ge 9 ]; then
            printf "        ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${node_version}${NC} and ${BOLD}npm${NC} ${GREEN}${npm_version}${NC} ready\n"
            return 0
        else
            printf "${YELLOW}!${NC} Node.js installed but version requirements not met\n"
            printf "${GRAY}  Found: Node.js ${node_version}, npm ${npm_version}${NC}\n"
            printf "${GRAY}  Required: Node.js >= 18.0.0, npm >= 9.0.0${NC}\n"
            return 1
        fi
    else
        printf "${RED}✗${NC} Node.js installation verification failed\n"
        return 1
    fi
}

# Function to update npm if needed
update_npm() {
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version 2>/dev/null | cut -d. -f1 || echo "0")
        if [ "$npm_version" -lt 9 ]; then
            printf "${BLUE}◉${NC} Updating npm to latest version\n"
            if npm install -g npm@latest >/dev/null 2>&1; then
                local npm_new=$(npm --version 2>/dev/null || echo "unknown")
                printf "${GREEN}✓${NC} npm updated to ${GREEN}${npm_new}${NC}\n"
                return 0
            else
                printf "${RED}✗${NC} npm update failed\n"
                return 1
            fi
        fi
    fi
    return 0
}

# Main execution
main() {
    # Skip redundant check if called from install script  
    if [ "${1:-}" = "--skip-check" ]; then
        # Skip check message - jump straight to installation
        true
    else
        if check_nodejs_installed; then
            return 0  # Node.js installed and meets requirements - we're done
        fi
    fi

    # Proceed with installation
    if ! install_nodejs; then
        printf "${RED}✗${NC} Node.js installation failed\n"
        exit 1
    fi
    
    # Update npm if needed
    if ! update_npm; then
        printf "${YELLOW}!${NC} npm update failed but Node.js is installed\n"
    fi
    
    # Verify final installation
    if verify_nodejs; then
        printf "\n        ${GREEN}✓${NC} Node.js setup complete\n"
    else
        printf "\n${YELLOW}!${NC} Node.js installed but may need manual verification\n"
        exit 1
    fi
}

# Execute main function with error handling
if ! main "$@"; then
    printf "\n${YELLOW}✗${NC} ${BOLD}Node.js setup${NC} ${YELLOW}failed${NC}\n" >&2
    exit 1
fi