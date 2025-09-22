#!/bin/bash

# GraphDone Docker Auto-Installation Script
# Installs Docker using platform-specific methods and sets up proper permissions
#
# Installation methods by platform:
# Linux: Snap, Official repository
# macOS: Docker Desktop, Homebrew
# Windows: Docker Desktop (WSL)

set -euo pipefail

# Cleanup function
cleanup() {
    rm -f "/tmp/.docker_just_installed" 2>/dev/null || true
}

# Set up signal handlers
trap cleanup EXIT INT TERM

USER=$(whoami)
DOCKER_SOCK="/var/snap/docker/common/var-lib-docker.sock"
DOCKER_SOCK_ALT="/var/run/docker.sock"

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
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        OS="unknown"
        printf "  ${YELLOW}✗${NC} ${BOLD}Unsupported OS${NC} ${GRAY}${OSTYPE}${NC}\n" >&2
        printf "  ${BLUE}ⓘ${NC} ${GRAY}Supported: macOS, Linux, Windows${NC}\n" >&2
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
printf "${CYAN}${BOLD}🐳 Docker Desktop Setup${NC}\n"
printf "${GRAY}${DIM}──────────────────────────${NC}\n"

# Function to check if Docker is installed
check_docker_installed() {
    if command -v docker &> /dev/null; then
        local version=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo 'unknown')
        printf "${GREEN}✓${NC} Docker ${version} already installed\n"
        return 0
    else
        printf "${BLUE}◉${NC} Docker not found - installing automatically\n"
        return 1
    fi
}

# Function to install Docker with platform-specific methods
install_docker() {
    case "${OS}" in
        "macos")
            install_docker_macos
            ;;
        "linux")
            install_docker_linux
            ;;
        "windows")
            install_docker_windows
            ;;
        *)
            echo "✗ Unsupported operating system: ${OSTYPE}" >&2
            return 1
            ;;
    esac
}

# macOS Docker installation
install_docker_macos() {
    # Check if Homebrew is available
    if command -v brew &> /dev/null; then
        # Set environment to avoid prompts and timeouts
        export HOMEBREW_NO_AUTO_UPDATE=1
        export HOMEBREW_NO_ENV_HINTS=1
        
        # Check if Docker.app actually exists, even if Homebrew thinks it's installed
        if [ ! -d "/Applications/Docker.app" ]; then
            printf "${BLUE}◉${NC} Installing Docker Desktop\n"
            
            # Start installation in background - capture password prompts elegantly
            (brew reinstall --cask docker-desktop --no-quarantine --force || \
             brew install --cask docker-desktop --no-quarantine --force) 2>&1 | \
            while IFS= read -r line; do
                case "$line" in
                    *"Password"*|*"password"*)
                        # Clear any spinner first, then show clean password prompt
                        printf "\r\033[K\n${YELLOW}◉${NC} ${BOLD}Administrator password required${NC}\n"
                        printf "%s\n" "$line"
                        ;;
                    *"latest version is already installed"*|*"Not upgrading"*|*"outdated dependents"*|*"Warning:"*|*"==>"*)
                        # Suppress warnings and upgrade messages
                        ;;
                    *) 
                        # Suppress all other verbose output
                        ;;
                esac
            done &
            
            # Wait for password entry first, then show progress
            install_pid=$!
            password_entered=false
            
            # Wait silently until password is entered
            while kill -0 $install_pid 2>/dev/null && [ "$password_entered" = "false" ]; do
                if ! ps aux | grep -q "[s]udo.*brew"; then
                    # Password has been entered, sudo process is gone
                    password_entered=true
                    printf "${BLUE}◉${NC} ${GRAY}Preparing installation${NC}${DIM}...${NC}\n"
                    sleep 0.5  # Brief pause to show preparation message
                fi
                sleep 0.2
            done
            
            # Now show download progress with spinner AFTER password
            if [ "$password_entered" = "true" ]; then
                spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
                i=0
                
                while kill -0 $install_pid 2>/dev/null; do
                    printf "\r${BLUE}◉${NC} ${GRAY}Downloading Docker Desktop${NC} ${CYAN}${spin:i:1}${NC}"
                    i=$(( (i+1) % ${#spin} ))
                    sleep 0.15
                done
            fi
            wait $install_pid
            
            printf "\r${GREEN}✓${NC} ${BOLD}Docker Desktop${NC} ${GREEN}installed successfully${NC}\n"
            
            if [ -d "/Applications/Docker.app" ]; then
                # Installation successful - will show message later
                true
            else
                # Check if Docker.app was still installed despite the failure
                if [ ! -d "/Applications/Docker.app" ]; then
                    return 1
                else
                    echo "✓ Docker.app found - installation appears successful"
                fi
            fi
        else
            brew install --cask docker-desktop --no-quarantine --force 2>&1 | \
            while IFS= read -r line; do
                case "$line" in
                    *"Password"*|*"password"*)
                        printf "\n$line\n"
                        ;;
                    *"latest version is already installed"*|*"Not upgrading"*|*"outdated dependents"*|*"Warning:"*|*"==>"*)
                        # Suppress warnings and upgrade messages
                        ;;
                    *)
                        # Suppress all other output
                        ;;
                esac
            done
        fi
        
        if [ -d "/Applications/Docker.app" ]; then
            open -a Docker 2>/dev/null || true
            touch "/tmp/.docker_just_installed"
            
            # Smart Docker startup with automatic restart for broken sockets (macOS specific)
            local attempts=0
            printf "${BLUE}◉${NC} ${GRAY}Starting Docker Desktop${NC}\n"
            
            # Wait for Docker to start with enhanced feedback
            while ! docker ps &> /dev/null && [ $attempts -lt 20 ]; do
                if [ $attempts -eq 0 ]; then
                    printf "${BLUE}◉${NC} ${GRAY}Waiting for Docker engine${NC}"
                fi
                printf "."
                sleep 3
                attempts=$((attempts + 1))
                
                # If Docker processes exist but daemon isn't responding, restart
                if [ $attempts -eq 8 ] && ps aux | grep -q "[D]ocker" && ! docker info &> /dev/null 2>&1; then
                    printf "\n${YELLOW}!${NC} ${GRAY}Docker processes detected but daemon not responding${NC}\n"
                    printf "${BLUE}◉${NC} ${GRAY}Restarting Docker Desktop${NC}\n"
                    pkill -f "Docker" 2>/dev/null || true
                    sleep 2
                    open -a Docker 2>/dev/null || true
                    printf "${BLUE}◉${NC} ${GRAY}Waiting for Docker engine${NC}"
                fi
            done
            
            if ! docker ps &> /dev/null; then
                printf "\n${YELLOW}!${NC} ${GRAY}Docker startup taking longer than expected${NC}\n"
                printf "${YELLOW}!${NC} ${GRAY}Please wait for Docker to fully start, then rerun installer${NC}\n"
                rm -f "/tmp/.docker_just_installed"
                return 1
            else
                printf "\n${GREEN}✓${NC} ${GRAY}Docker Desktop ready and running${NC}\n"
                rm -f "/tmp/.docker_just_installed"
                return 0
            fi
            return 0
        fi
    fi
    
    echo "▶ Manual install: https://docs.docker.com/desktop/install/mac/"
    
    read -p "Have you installed Docker Desktop? (Y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "✓ Docker Desktop installation confirmed"
        return 0
    else
        return 1
    fi
}

# Linux Docker installation (existing logic)
install_docker_linux() {
    # Try snap without sudo first
    if snap install docker 2>/dev/null; then
        echo "✓ Docker installed via snap successfully"
        export PATH="/snap/bin:$PATH"
        return 0
    fi

    # Snap with sudo
    read -p "Install with sudo? (Y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if sudo snap install docker; then
            echo "✓ Docker installed via snap with sudo"
            export PATH="/snap/bin:$PATH"
            return 0
        fi
    fi

    # Method 3: Try package manager installation (APT/YUM/DNF)
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu systems
        read -p "Install Docker via APT? (Y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if sudo apt-get update && sudo apt-get install -y docker.io docker-compose; then
                # Start Docker service
                sudo systemctl start docker 2>/dev/null || sudo service docker start
                sudo systemctl enable docker 2>/dev/null || true
                echo "✓ Docker installed via APT successfully"
                return 0
            fi
        fi
    elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then
        # RedHat/Fedora/CentOS systems
        read -p "Install Docker via YUM/DNF? (Y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            local PKG_MGR="yum"
            if command -v dnf &> /dev/null; then
                PKG_MGR="dnf"
            fi
            
            if sudo $PKG_MGR install -y docker docker-compose; then
                # Start Docker service
                sudo systemctl start docker
                sudo systemctl enable docker
                echo "✓ Docker installed via $PKG_MGR successfully"
                return 0
            fi
        fi
    fi

    # Method 4: Official Docker repository (latest version)
    read -p "Install Docker from official repository? (Y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Update package list
        sudo apt-get update

        # Install prerequisites
        sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common

        # Add Docker's official GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

        # Add Docker repository
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        # Update package list again
        sudo apt-get update

        # Install Docker
        if sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
            echo "✓ Docker installed from official repository"
            return 0
        fi
    fi

    # All methods failed
    echo "✗ Installation failed - visit: https://docs.docker.com/get-docker/"
    return 1
}

# Windows Docker installation
install_docker_windows() {
    
    # Check Windows version compatibility
    if command -v powershell &> /dev/null; then
        local win_version=$(powershell -Command "[System.Environment]::OSVersion.Version.Major" 2>/dev/null)
        if [ "$win_version" = "6" ]; then
            # Windows 6.x = Windows 8/8.1
            read -p "Install Docker Toolbox? (Y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                
                # Try Chocolatey for Docker Toolbox
                if command_exists choco; then
                    if choco install docker-toolbox -y 2>/dev/null; then
                        echo "✓ Docker Toolbox installed via Chocolatey"
                        return 0
                    fi
                fi
                
                # Manual installation
                echo "▶ Install Docker Toolbox: https://github.com/docker/toolbox/releases"
                return 0
            else
                echo "▶ Native development: Install Neo4j from https://neo4j.com/download/"
                return 0
            fi
        fi
    fi
    
    # Method 1: Try Chocolatey
    if command_exists choco; then
        read -p "Install Docker Desktop via Chocolatey? (Y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if choco install docker-desktop -y 2>/dev/null; then
                echo "✓ Docker Desktop installed via Chocolatey"
                read -p "Have you started Docker Desktop? (Y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    # Wait for Docker daemon with timeout
                    local attempts=0
                    local max_attempts=60  # 2 minutes
                    
                    while [ $attempts -lt $max_attempts ]; do
                        if command_exists docker && docker info &> /dev/null; then
                            echo "✓ Docker Desktop is running!"
                            docker --version 2>/dev/null || echo "Docker version: unknown"
                            return 0
                        fi
                        sleep 2
                        attempts=$((attempts + 1))
                    done
                    
                    echo "! Docker Desktop is taking longer than expected"
                    return 0
                fi
            fi
        fi
    fi
    
    # Method 2: Try Scoop
    if command_exists scoop; then
        read -p "Install Docker Desktop via Scoop? (Y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Add extras bucket for Docker Desktop
            scoop bucket add extras 2>/dev/null || true
            if scoop install docker-desktop 2>/dev/null; then
                echo "✓ Docker Desktop installed via Scoop"
                return 0
            fi
        fi
    fi
    
    # Method 3: Manual installation
    echo "▶ Install Docker Desktop: https://docs.docker.com/desktop/install/windows/"
    
    # Try to open the download page automatically
    if command_exists powershell; then
        read -p "Open Docker Desktop download page? (Y/N): " -n 1 -r
        echo
        if [[ ${REPLY} =~ ^[Yy]$ ]]; then
            powershell -Command "Start-Process 'https://docs.docker.com/desktop/install/windows/'" 2>/dev/null || echo "! Failed to open browser"
        fi
    fi
    
    read -p "Have you installed Docker Desktop? (Y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "✓ Docker Desktop installation confirmed"
        return 0
    else
        return 1
    fi
}

# Function to check if Docker daemon is running
check_docker_running() {
    # Try without sudo first (macOS/Docker Desktop doesn't need sudo)
    if docker info &> /dev/null; then
        printf "${GREEN}✓${NC} ${GRAY}Docker daemon${NC} ${GREEN}running${NC}\n"
        return 0
    # Try with sudo for Linux systems
    elif [ "$OS" = "linux" ] && sudo docker info &> /dev/null; then
        printf "${GREEN}✓${NC} ${GRAY}Docker daemon${NC} ${GREEN}running${NC}\n"
        return 0
    else
        printf "${YELLOW}!${NC} ${GRAY}Docker daemon${NC} ${YELLOW}not running${NC}\n"
        return 1
    fi
}

# Function to start Docker daemon
start_docker() {
    case "${OS}" in
        "macos")
            # Intelligent Docker restart for broken socket issues (common on macOS)
            if ps aux | grep -q "[D]ocker" && ! docker info &> /dev/null 2>&1; then
                printf "${YELLOW}!${NC} ${GRAY}Docker processes detected but daemon not responding${NC}\n"
                printf "${BLUE}◉${NC} ${GRAY}Restarting Docker Desktop to fix broken socket${NC}\n"
                
                # Kill all Docker processes to force clean restart
                pkill -f "Docker" 2>/dev/null || true
                sleep 2
                
                printf "${BLUE}◉${NC} ${GRAY}Starting fresh Docker Desktop${NC}\n"
            else
                printf "${BLUE}◉${NC} ${GRAY}Starting Docker Desktop${NC}\n"
            fi
            
            open -a Docker 2>/dev/null || true
            
            # Wait for Docker to start with enhanced feedback
            local attempts=0
            local max_attempts=20  # 60 seconds total
            
            while ! docker ps &> /dev/null && [ $attempts -lt $max_attempts ]; do
                if [ $attempts -eq 0 ]; then
                    printf "${BLUE}◉${NC} ${GRAY}Waiting for Docker engine${NC}"
                fi
                printf "."
                sleep 3
                attempts=$((attempts + 1))
            done
            
            if ! docker ps &> /dev/null; then
                printf "\n${YELLOW}!${NC} ${GRAY}Docker startup taking longer than expected${NC}\n"
                printf "${YELLOW}!${NC} ${GRAY}Please wait for Docker to fully start, then rerun installer${NC}\n"
                return 1
            else
                printf "\n${GREEN}✓${NC} ${GRAY}Docker Desktop ready and running${NC}\n"
                return 0
            fi
            ;;
        "linux")
            if sudo snap start docker 2>/dev/null; then
                sleep 3
                if check_docker_running; then
                    echo "✓ Docker daemon started successfully"
                else
                    echo "✗ Failed to start Docker daemon" >&2
                    return 1
                fi
            else
                echo "✗ Failed to start Docker service" >&2
                return 1
            fi
            ;;
        *)
            echo "✗ Cannot start Docker automatically on ${OS}" >&2
            return 1
            ;;
    esac
}

# Function to fix Docker permissions (Linux only)
fix_docker_permissions() {
    case "${OS}" in
        "macos")
            return 0
            ;;
        "linux")

            # Create docker group if it doesn't exist (needed for snap Docker)
            if ! getent group docker >/dev/null; then
                sudo groupadd docker
            fi

            # Add user to docker group
            if ! sudo usermod -aG docker "${USER}" 2>/dev/null; then
                echo "! Warning: Failed to add user to docker group" >&2
            fi

            # Fix snap docker socket permissions (more permissive for snap)
            if [ -S "${DOCKER_SOCK}" ]; then
                sudo chmod 666 "${DOCKER_SOCK}" 2>/dev/null || true
            fi

            # Fix standard docker socket permissions with proper group ownership
            if [ -S "${DOCKER_SOCK_ALT}" ]; then
                sudo chown root:docker "${DOCKER_SOCK_ALT}" 2>/dev/null || true
                sudo chmod 660 "${DOCKER_SOCK_ALT}" 2>/dev/null || true
            fi

            # Restart snap docker service to refresh permissions
            sudo snap restart docker 2>/dev/null || true

            # Wait for socket to be recreated
            sleep 2

            # Re-fix socket permissions after restart (critical for snap Docker)
            if [ -S "${DOCKER_SOCK_ALT}" ]; then
                sudo chown root:docker "${DOCKER_SOCK_ALT}" 2>/dev/null || true
                sudo chmod 660 "${DOCKER_SOCK_ALT}" 2>/dev/null || true
            fi

            # Also fix snap socket again if it was recreated
            if [ -S "${DOCKER_SOCK}" ]; then
                sudo chmod 666 "${DOCKER_SOCK}" 2>/dev/null || true
            fi

            echo "✓ Docker permissions configured"
            ;;
        *)
            echo "! Unable to configure Docker permissions on ${OS}" >&2
            return 0
            ;;
    esac
}

# Function to test Docker access
test_docker_access() {

    if docker ps &> /dev/null; then
        echo "✓ Docker is working!"
        return 0
    fi

    case "${OS}" in
        "macos")
            return 1
            ;;
        "linux")
            # Check if user is in docker group
            if id -nG "$USER" | grep -qw docker; then
                echo "✓ User successfully added to docker group"

                # Try docker test (might work immediately after group add)
                if docker ps &> /dev/null; then
                    echo "✓ Docker is working immediately!"
                    return 0
                fi

                # Apply direct socket permissions as immediate fix
                if [ -S "/var/run/docker.sock" ]; then
                    sudo chmod 666 "/var/run/docker.sock" 2>/dev/null

                    # Test if this fixed the issue
                    if docker ps &> /dev/null; then
                        echo "✓ Docker is working with direct permissions!"
                        return 0
                    fi
                fi

                return 0  # Success - user was added to group
            else
                echo "✗ User not found in docker group - attempting to fix..."

                # Try to fix the issue automatically

                # Ensure docker group exists and add user (with error handling)
                if sudo groupadd docker 2>/dev/null || true; then
                    echo "✓ Docker group created/verified"
                fi

                if sudo usermod -aG docker "${USER}" 2>/dev/null; then
                    echo "✓ User added to docker group successfully"

                    # Verify the fix worked
                    if id -nG "${USER}" | grep -qw docker; then
                        echo "✓ Group membership verified"
                        echo "! Open new terminal and run: ./install.sh"
                    else
                        echo "✗ Group add still failed - trying alternative method..."

                        # Alternative method: direct socket permissions
                        echo "▶ Using alternative permission method..."
                        if [ -S "/var/run/docker.sock" ]; then
                            sudo chmod 666 "/var/run/docker.sock" 2>/dev/null || true
                            echo "✓ Applied direct socket permissions"

                            # Test if this worked
                            if docker ps &> /dev/null; then
                                echo "✓ Docker is working with direct permissions!"
                                return 0
                            fi
                        fi

                        echo "✗ Manual fix required - open new terminal and run: ./install.sh"
                        return 1
                    fi
                else
                    echo "✗ Failed to add user to docker group"
                    return 1
                fi
            fi
            return 1
            ;;
        *)
            echo "✗ Unable to test Docker access on ${OS}" >&2
            return 1
            ;;
    esac
}

# Function to check if we can run sudo commands
check_sudo_access() {
    # Check if we have sudo privileges without prompting
    if sudo -n true 2>/dev/null; then
        return 0  # We can sudo without password
    else
        return 1  # Need password for sudo
    fi
}

# Function to request sudo access upfront
request_sudo() {
    echo "◉ Administrator password required for Docker setup:"

    # Request sudo access and cache credentials
    if sudo -v; then
        echo "✓ Administrator access granted"
        return 0
    else
        echo "✗ Administrator access denied"
        return 1
    fi
}

# Main execution
main() {
    # Skip redundant check if called from install script  
    if [ "${1:-}" = "--skip-check" ]; then
        # Skip check message - jump straight to installation
        true
    else
        if check_docker_installed; then
            # Docker is installed, but check if it's running
            if check_docker_running; then
                return 0  # Docker installed AND running - we're done
            fi
            # Docker installed but not running - continue to start it
        fi
    fi

    # Proceed with installation (check already done if not skipped)
    if true; then
        # For macOS with Homebrew, we might not need sudo
        if [ "$OS" != "macos" ] || ! command -v brew &> /dev/null; then
            if ! check_sudo_access; then
                if ! request_sudo; then
                    echo "✗ Cannot proceed without administrator privileges"
                    exit 1
                fi
            fi
        fi
        install_docker
    fi

    # Start Docker if needed and verify it's ready
    if command -v docker &>/dev/null; then
        if ! check_docker_running; then
            # Skip duplicate startup if we just started it during installation
            if [ ! -f "/tmp/.docker_just_installed" ]; then
                start_docker
            else
                echo "◉ Docker Desktop starting up..."
            fi
        fi
    else
        echo "✗ Docker not found after installation" >&2
        return 1
    fi

    # Fix permissions if needed  
    if ! docker ps &> /dev/null 2>&1; then
        fix_docker_permissions
        test_docker_access
    fi

    printf "\n${GREEN}✓${NC} Docker setup complete\n"
}

# Execute main function with error handling
if ! main "$@"; then
    printf "\n${YELLOW}✗${NC} ${BOLD}Docker setup${NC} ${YELLOW}failed${NC}\n" >&2
    exit 1
fi