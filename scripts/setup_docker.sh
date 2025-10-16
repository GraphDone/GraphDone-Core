#!/bin/sh
# GraphDone Docker Setup Script (POSIX-compatible)
# Linux: Docker Engine via official repository
# macOS/Windows: Manual Docker Desktop installation required

set -eu

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    GRAY='\033[0;90m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' GRAY='' BOLD='' NC=''
fi

# Spinner function
show_spinner() {
    pid=$1
    msg="$2"
    i=0
    spin_char=""
    
    while kill -0 "$pid" 2>/dev/null; do
        case $((i % 10)) in
            0) spin_char='⠋' ;;
            1) spin_char='⠙' ;;
            2) spin_char='⠹' ;;
            3) spin_char='⠸' ;;
            4) spin_char='⠼' ;;
            5) spin_char='⠴' ;;
            6) spin_char='⠦' ;;
            7) spin_char='⠧' ;;
            8) spin_char='⠇' ;;
            9) spin_char='⠏' ;;
        esac
        printf "\r        ${GRAY}%s${NC} ${CYAN}%s${NC}" "$msg" "$spin_char"
        i=$((i + 1))
        sleep 0.15
    done
    wait "$pid"
    return $?
}

# Detect OS
detect_os() {
    os_type="${OSTYPE:-$(uname -s 2>/dev/null || echo 'unknown')}"
    case "$os_type" in
        Linux|linux*) OS="linux" ;;
        Darwin|darwin*) OS="macos" ;;
        *) OS="unknown" ;;
    esac
}

detect_os

# Check if Docker is installed
check_docker() {
    if command -v docker >/dev/null 2>&1; then
        docker_version=$(docker --version 2>/dev/null | cut -d' ' -f3 | sed 's/,//')
        if [ -n "$docker_version" ]; then
            printf "        ${GREEN}✓${NC} Docker %s already installed\n" "$docker_version"
            
            # Check if running
            if docker ps >/dev/null 2>&1; then
                printf "        ${GREEN}✓${NC} Docker is running\n"
                return 0
            else
                printf "        ${YELLOW}!${NC} Docker is installed but not running\n"
                printf "        ${GRAY}  Please start Docker manually${NC}\n"
                return 1
            fi
        fi
    fi
    return 1
}

# Install Docker on Linux
install_docker_linux() {
    printf "        ${BLUE}◉${NC} Installing Docker via snap\n"
    
    # Check if snap is available
    if ! command -v snap >/dev/null 2>&1; then
        printf "        ${YELLOW}!${NC} Snap not found, using apt method\n"
        install_docker_apt
        return $?
    fi
    
    # Request sudo password upfront
    printf "        ${GRAY}Requesting administrative privileges...${NC}\n"
    if ! sudo -v; then
        printf "        ${RED}✗${NC} Failed to obtain sudo privileges\n"
        return 1
    fi
    
    # Install Docker via snap with spinner
    sudo snap install docker >/dev/null 2>&1 &
    show_spinner $! "Installing Docker snap package"
    
    if [ $? -eq 0 ]; then
        printf "\r        ${GREEN}✓${NC} Docker installed successfully via snap                    \n"
        return 0
    else
        printf "\r        ${YELLOW}!${NC} Snap installation failed, trying apt method\n"
        install_docker_apt
        return $?
    fi
}

# Install Docker via apt (fallback)
install_docker_apt() {
    printf "        ${BLUE}◉${NC} Installing Docker Engine via apt\n"
    
    # Update package index
    printf "        ${GRAY}Updating package lists...${NC}\n"
    sudo apt-get update >/dev/null 2>&1
    
    # Install prerequisites
    printf "        ${GRAY}Installing prerequisites...${NC}\n"
    sudo apt-get install -y ca-certificates curl gnupg lsb-release >/dev/null 2>&1
    
    # Add Docker GPG key
    printf "        ${GRAY}Adding Docker GPG key...${NC}\n"
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg >/dev/null 2>&1
    
    # Add Docker repository
    printf "        ${GRAY}Adding Docker repository...${NC}\n"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    
    # Update package index again
    sudo apt-get update >/dev/null 2>&1
    
    # Install Docker
    printf "        ${GRAY}Installing Docker Engine...${NC}\n"
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1
    
    # Add user to docker group
    printf "        ${GRAY}Adding user to docker group...${NC}\n"
    sudo usermod -aG docker "$USER"
    
    printf "        ${GREEN}✓${NC} Docker installed successfully\n"
    printf "        ${YELLOW}!${NC} ${GRAY}Please log out and back in for group changes to take effect${NC}\n"
    return 0
}

# Main
printf "\n        ${CYAN}${BOLD}🐳 Docker Setup${NC}\n"
printf "        ${GRAY}──────────────────────────${NC}\n"

# Check if already installed
if check_docker; then
    exit 0
fi

# Install based on OS
case "$OS" in
    linux)
        install_docker_linux
        ;;
    macos)
        printf "        ${YELLOW}!${NC} macOS detected\n"
        printf "        ${GRAY}  Please install Docker Desktop from: https://www.docker.com/products/docker-desktop${NC}\n"
        exit 1
        ;;
    *)
        printf "        ${RED}✗${NC} Unsupported OS\n"
        exit 1
        ;;
esac
