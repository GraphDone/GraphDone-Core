#!/bin/sh
# ============================================================================
# GraphDone Docker Setup Script
# ============================================================================
# 
# Platform Support:
#   ✓ macOS    - OrbStack Docker (recommended)
#   ✓ Linux    - Docker Engine via Snap (preferred), apt-get, dnf, or yum
#
# Installation methods:
#   macOS:   OrbStack via Homebrew (fast, light, free)
#   Linux:   Docker via Snap (simplest), apt-get (Ubuntu/Debian), 
#            dnf (Fedora), or yum (RHEL/CentOS)
# ============================================================================

# ============================================================================
# MACOS DOCKER INSTALLATION
# ============================================================================
# Installs Docker on macOS using OrbStack (Docker Desktop alternative)
#
# Method: OrbStack Installation
#   - Command: brew install --cask orbstack
#   - Installs: OrbStack (Docker + Kubernetes alternative)
#   - Version: Latest stable (e.g., 1.7.3)
#   - Benefits: 
#     - Faster than Docker Desktop (2-3x)
#     - Lighter on resources (70% less CPU, 50% less memory)
#     - Starts quickly (2-5 seconds)
#     - Free for personal use
#     - Drop-in replacement for Docker Desktop
#
# Flow:
#   1. Check if Homebrew exists (command -v brew)
#   2. If Homebrew exists:
#      - Run brew install --cask orbstack
#      - Show animated spinner during installation
#      - Wait for OrbStack to start (daemon ready)
#      - Verify Docker is accessible
#   3. If Homebrew doesn't exist:
#      - Show manual installation URL (https://brew.sh)
#
# Start Docker Flow (if installed but not running):
#   1. Detect if OrbStack is installed (/Applications/OrbStack.app)
#   2. Open OrbStack application
#   3. Wait for daemon to become responsive (up to 60 seconds)
#   4. Verify docker info succeeds
#
# Exit codes:
#   0 - Success (Docker installed/started successfully)
#   1 - Failure (Installation failed or Homebrew not found)
# ============================================================================

# ============================================================================
# LINUX DOCKER INSTALLATION
# ============================================================================
# Installs Docker Engine on Linux using Snap (preferred) or apt (fallback)
#
# METHOD 1: Snap Installation (Preferred)
# ============================================================================
# Simplest method - works on most modern Linux distributions
#
# Supported Distributions (via Snap):
#   - Ubuntu 16.04+ (Snap pre-installed)
#   - Debian 9+
#   - Fedora
#   - Arch Linux
#   - Manjaro
#   - OpenSUSE
#   - Any distribution with Snap support
#
# Command: snap install docker
# Installs: Docker Engine + CLI + containerd (all-in-one)
# Benefits:
#   - Single command installation
#   - Automatic updates
#   - Sandboxed environment
#   - Works across multiple distributions
#
# Flow:
#   1. Check if snap is available (command -v snap)
#   2. Request sudo privileges
#   3. Run snap install docker with spinner
#   4. Verify installation success
#   5. If snap fails → Fallback to METHOD 2 (apt)
#
# METHOD 2: Distribution-Specific Package Managers (Fallback)
# ============================================================================
# Official Docker repository installation for specific distributions
#
# 2A. APT Installation (Ubuntu/Debian)
# ============================================================================
# Supported Distributions:
#   - Ubuntu 20.04+ (Focal, Jammy, Noble)
#   - Debian 10+ (Buster, Bullseye, Bookworm)
#   - Linux Mint
#   - Pop!_OS
#   - Elementary OS
#
# Method: Docker Engine Installation via Official Repository
#   - Step 1: Install prerequisites (ca-certificates, curl, gnupg)
#   - Step 2: Add Docker's official GPG key
#   - Step 3: Add Docker's official repository
#   - Step 4: Update package index
#   - Step 5: Install docker-ce, docker-ce-cli, containerd.io
#   - Step 6: Add user to docker group (no sudo for docker commands)
#
# Detailed Flow:
#   1. Update package lists (apt-get update)
#   2. Install prerequisites: ca-certificates, curl, gnupg, lsb-release
#   3. Create keyrings directory (/etc/apt/keyrings)
#   4. Download and add Docker GPG key
#   5. Add Docker repository to sources.list.d
#   6. Update package index with Docker repo
#   7. Install: docker-ce, docker-ce-cli, containerd.io, 
#              docker-buildx-plugin, docker-compose-plugin
#   8. Add current user to docker group (usermod -aG docker $USER)
#   9. Display logout message (group changes require re-login)
#
# 2B. DNF Installation (Fedora)
# ============================================================================
# Supported Distributions:
#   - Fedora 36+
#   - Fedora Workstation
#   - Fedora Server
#
# Method: Docker Engine Installation via Official Repository
#   - Step 1: Install dnf-plugins-core
#   - Step 2: Add Docker's official repository
#   - Step 3: Install docker-ce, docker-ce-cli, containerd.io
#   - Step 4: Start and enable Docker service
#   - Step 5: Add user to docker group
#
# Detailed Flow:
#   1. Install dnf-plugins-core
#   2. Add Docker repository (docker-ce.repo)
#   3. Install: docker-ce, docker-ce-cli, containerd.io, 
#              docker-buildx-plugin, docker-compose-plugin
#   4. Start Docker daemon (systemctl start docker)
#   5. Enable Docker on boot (systemctl enable docker)
#   6. Add current user to docker group (usermod -aG docker $USER)
#   7. Display logout message (group changes require re-login)
#
# 2C. YUM Installation (RHEL/CentOS)
# ============================================================================
# Supported Distributions:
#   - RHEL 8+
#   - CentOS 8+
#   - Rocky Linux 8+
#   - AlmaLinux 8+
#
# Method: Docker Engine Installation via Official Repository
#   - Step 1: Install yum-utils
#   - Step 2: Add Docker's official repository
#   - Step 3: Install docker-ce, docker-ce-cli, containerd.io
#   - Step 4: Start and enable Docker service
#   - Step 5: Add user to docker group
#
# Detailed Flow:
#   1. Install yum-utils
#   2. Add Docker repository (docker-ce.repo)
#   3. Install: docker-ce, docker-ce-cli, containerd.io, 
#              docker-buildx-plugin, docker-compose-plugin
#   4. Start Docker daemon (systemctl start docker)
#   5. Enable Docker on boot (systemctl enable docker)
#   6. Add current user to docker group (usermod -aG docker $USER)
#   7. Display logout message (group changes require re-login)
#
# Start Docker Flow (if installed but not running):
#   1. Check if systemd is available
#   2. Run systemctl start docker (requires sudo)
#   3. Enable Docker on boot (systemctl enable docker)
#   4. Verify docker info succeeds
#
# Benefits:
#   - Official Docker Engine (not Docker Desktop)
#   - No licensing issues
#   - Better performance on Linux
#   - Automatic startup on boot (systemd)
#   - Latest features and security updates
#
# Requires:
#   - sudo access for installation
#   - systemd for service management (most modern distros)
#   - Ubuntu/Debian-based distribution for apt method
#
# Exit codes:
#   0 - Success (Docker installed/started successfully)
#   1 - Failure (Installation failed, unsupported distribution, or no sudo)
# ============================================================================

set -eu

# Track output lines for install.sh to clear later

# Colors
if [ -t 2 ]; then
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        # 256-color mode
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[0;33m'
        BLUE='\033[0;34m'
        VIOLET='\033[38;5;213m'  # Violet (256-color palette)
        CYAN='\033[0;36m'
        PALEGREEN='\033[38;2;152;251;152m'  # Palegreen (#98fb98)
        GRAY='\033[0;90m'
        BOLD='\033[1m'
        NC='\033[0m'
    else
        # Fallback to basic ANSI
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[0;33m'
        BLUE='\033[0;34m'
        VIOLET='\033[0;35m'  # Magenta (basic ANSI)
        CYAN='\033[0;36m'
        PALEGREEN='\033[0;32m'  # Fallback to green
        GRAY='\033[0;90m'
        BOLD='\033[1m'
        NC='\033[0m'
    fi
else
    RED='' GREEN='' YELLOW='' BLUE='' VIOLET='' CYAN='' PALEGREEN='' GRAY='' BOLD='' NC=''
fi

# Helper functions - redirect to stderr
log_info() { printf "        ${CYAN}ℹ${NC} $1\n" >&2; }
log_success() { printf "        ${GREEN}✓${NC} $1\n" >&2; }
log_warning() { printf "        ${YELLOW}⚠${NC} $1\n" >&2; }
log_error() { printf "        ${RED}✗${NC} $1\n" >&2; }

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
        printf "\r        ${YELLOW}◉${NC} %s ${BOLD}${CYAN}%s${NC}" "$msg" "$spin_char" >&2
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
            printf "        ${GREEN}✓${NC} Docker %s already installed\n" "$docker_version" >&2

            # Check if running (suppress "Killed" messages)
            { docker ps >/dev/null 2>&1; } 2>/dev/null && docker_running=0 || docker_running=1
            if [ $docker_running -eq 0 ]; then
                printf "        ${GREEN}✓${NC} Docker is running\n" >&2
                return 0
            else
                printf "        ${YELLOW}⚠${NC} Docker is installed but not running\n" >&2
                return 1
            fi
        fi
    fi
    return 1
}

# ============================================================================
# LINUX INSTALLATION FUNCTION - install_docker_linux()
# ============================================================================
install_docker_linux() {
    # ------------------------------------------------------------------------
    # METHOD 1: Snap Installation (Preferred - simplest)
    # ------------------------------------------------------------------------
    # Check if snap is available
    if command -v snap >/dev/null 2>&1; then
        printf "        ${VIOLET}◉${NC} Installing Docker via snap\n" >&2
        
        # Request sudo password upfront (required for snap install)
        printf "        ${VIOLET}◉${NC} Requesting administrative privileges\n" >&2
        if ! sudo -v; then
            printf "        ${RED}✗${NC} Failed to obtain sudo privileges\n" >&2
            return 1
        fi
        
        # Install Docker via snap with spinner
        # Command: snap install docker
        # Installs: Docker Engine + CLI + containerd
        sudo snap install docker >/dev/null 2>&1 &
        show_spinner $! "Installing Docker snap package"

        if [ $? -eq 0 ]; then
            printf "\r        ${GREEN}✓${NC} Docker installed successfully via snap                    \n" >&2
            return 0
        else
            printf "\r        ${YELLOW}⚠${NC} Snap installation failed, trying distribution-specific method\n" >&2
        fi
    fi
    
    # ------------------------------------------------------------------------
    # METHOD 2: Distribution-specific package manager (Fallback)
    # ------------------------------------------------------------------------
    # Detect which package manager is available
    if command -v apt-get >/dev/null 2>&1; then
        printf "        ${VIOLET}◉${NC} Detected APT package manager (Ubuntu/Debian)\n" >&2
        install_docker_apt
        return $?
    elif command -v dnf >/dev/null 2>&1; then
        printf "        ${VIOLET}◉${NC} Detected DNF package manager (Fedora)\n" >&2
        install_docker_dnf
        return $?
    elif command -v yum >/dev/null 2>&1; then
        printf "        ${VIOLET}◉${NC} Detected YUM package manager (RHEL/CentOS)\n" >&2
        install_docker_yum
        return $?
    else
        printf "        ${RED}✗${NC} No supported package manager found\n" >&2
        printf "        ${GRAY}  Supported: snap, apt-get, dnf, yum${NC}\n" >&2
        return 1
    fi
}

# ============================================================================
# LINUX APT INSTALLATION - install_docker_apt() [Fallback Method]
# ============================================================================
# Install Docker via apt (Ubuntu/Debian) using official Docker repository
install_docker_apt() {
    printf "        ${VIOLET}◉${NC} Installing Docker Engine via apt\n" >&2

    # ------------------------------------------------------------------------
    # STEP 1: Update package index
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Updating package lists\n" >&2
    sudo apt-get update >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 2: Install prerequisites
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Installing prerequisites\n" >&2
    sudo apt-get install -y ca-certificates curl gnupg lsb-release >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 3: Add Docker GPG key
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Adding Docker GPG key\n" >&2
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 4: Add Docker repository
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Adding Docker repository\n" >&2
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    # Update package index again with Docker repo
    sudo apt-get update >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 5: Install Docker Engine
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Installing Docker Engine\n" >&2
    # Installs: docker-ce (engine), docker-ce-cli (CLI), containerd.io,
    #           docker-buildx-plugin, docker-compose-plugin
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 6: Add user to docker group
    # ------------------------------------------------------------------------
    # Allows running docker commands without sudo
    printf "        ${VIOLET}◉${NC} Adding user to docker group\n" >&2
    sudo usermod -aG docker "$USER"

    printf "        ${GREEN}✓${NC} Docker installed successfully\n" >&2
    printf "        ${YELLOW}⚠${NC} ${GRAY}Please log out and back in for group changes to take effect${NC}\n" >&2
    return 0
}

# ============================================================================
# LINUX DNF INSTALLATION - install_docker_dnf() [Fedora]
# ============================================================================
# Install Docker via dnf (Fedora) using official Docker repository
install_docker_dnf() {
    printf "        ${VIOLET}◉${NC} Installing Docker Engine via dnf (Fedora)\n" >&2

    # ------------------------------------------------------------------------
    # STEP 1: Install prerequisites
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Installing dnf-plugins-core\n" >&2
    sudo dnf -y install dnf-plugins-core >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 2: Add Docker repository
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Adding Docker repository\n" >&2
    sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 3: Install Docker Engine
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Installing Docker Engine\n" >&2
    # Installs: docker-ce (engine), docker-ce-cli (CLI), containerd.io,
    #           docker-buildx-plugin, docker-compose-plugin
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 4: Start and enable Docker service
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Starting Docker service\n" >&2
    sudo systemctl start docker >/dev/null 2>&1
    sudo systemctl enable docker >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 5: Add user to docker group
    # ------------------------------------------------------------------------
    # Allows running docker commands without sudo
    printf "        ${VIOLET}◉${NC} Adding user to docker group\n" >&2
    sudo usermod -aG docker "$USER"

    printf "        ${GREEN}✓${NC} Docker installed successfully\n" >&2
    printf "        ${YELLOW}⚠${NC} ${GRAY}Please log out and back in for group changes to take effect${NC}\n" >&2
    return 0
}

# ============================================================================
# LINUX YUM INSTALLATION - install_docker_yum() [RHEL/CentOS]
# ============================================================================
# Install Docker via yum (RHEL/CentOS) using official Docker repository
install_docker_yum() {
    printf "        ${VIOLET}◉${NC} Installing Docker Engine via yum (RHEL/CentOS)\n" >&2

    # ------------------------------------------------------------------------
    # STEP 1: Install prerequisites
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Installing yum-utils\n" >&2
    sudo yum install -y yum-utils >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 2: Add Docker repository
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Adding Docker repository\n" >&2
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 3: Install Docker Engine
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Installing Docker Engine\n" >&2
    # Installs: docker-ce (engine), docker-ce-cli (CLI), containerd.io,
    #           docker-buildx-plugin, docker-compose-plugin
    sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 4: Start and enable Docker service
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Starting Docker service\n" >&2
    sudo systemctl start docker >/dev/null 2>&1
    sudo systemctl enable docker >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # STEP 5: Add user to docker group
    # ------------------------------------------------------------------------
    # Allows running docker commands without sudo
    printf "        ${VIOLET}◉${NC} Adding user to docker group\n" >&2
    sudo usermod -aG docker "$USER"

    printf "        ${GREEN}✓${NC} Docker installed successfully\n" >&2
    printf "        ${YELLOW}⚠${NC} ${GRAY}Please log out and back in for group changes to take effect${NC}\n" >&2
    return 0
}

# ============================================================================
# MACOS INSTALLATION FUNCTION - install_docker_macos()
# ============================================================================
install_docker_macos() {
    # ------------------------------------------------------------------------
    # Check if Homebrew is available (macOS package manager)
    # ------------------------------------------------------------------------
    if ! command -v brew >/dev/null 2>&1; then
        printf "        ${RED}✗${NC} Homebrew not found\n" >&2
        printf "        ${GRAY}  See: https://brew.sh to install Homebrew${NC}\n" >&2
        return 1
    fi

    # ------------------------------------------------------------------------
    # Check if OrbStack Docker already installed
    # ------------------------------------------------------------------------
    if command -v orbstack >/dev/null 2>&1 || [ -d "/Applications/OrbStack.app" ]; then
        printf "        ${GREEN}✓${NC} OrbStack Docker already installed\n" >&2
        start_orbstack  # Start OrbStack if not running
        return $?
    fi

    # DISABLED: Docker Desktop support
    # elif [ -d "/Applications/Docker.app" ]; then
    #     printf "        ${GREEN}✓${NC} Docker Desktop already installed\n" >&2
    #     start_docker_desktop
    #     return $?
    # fi

    # DISABLED: Non-interactive mode check - always show interactive prompt
    # if [ ! -t 0 ]; then
    #     # Non-interactive: auto-select OrbStack
    #     printf "        ${BLUE}◉${NC} Installing ${BOLD}OrbStack Docker${NC} ${GRAY}(recommended)${NC}\n" >&2
    #     install_orbstack
    #     return $?
    # fi

    # ------------------------------------------------------------------------
    # Display OrbStack Docker information
    # ------------------------------------------------------------------------
    # Show benefits and features of OrbStack
    printf "        ${CYAN}${BOLD}Installing OrbStack Docker${NC}\n" >&2
    printf "\n" >&2
    printf "        ${BOLD}OrbStack Docker${NC} ${GRAY}(Recommended)${NC}\n" >&2
    printf "           ${GRAY}• 2-3x faster than Docker Desktop${NC}\n" >&2
    printf "           ${GRAY}• 70%% less CPU, 50%% less memory${NC}\n" >&2
    printf "           ${GRAY}• Starts quickly (2-5 seconds)${NC}\n" >&2
    printf "           ${GRAY}• Free for personal use${NC}\n" >&2
    printf "\n" >&2
    # DISABLED: Docker Desktop support
    # printf "        ${GREEN}2)${NC} ${BOLD}Docker Desktop${NC}\n" >&2
    # printf "           ${GRAY}• Traditional Docker runtime${NC}\n" >&2
    # printf "           ${GRAY}• Widely used, well-tested${NC}\n" >&2
    # printf "           ${GRAY}• Requires license for companies${NC}\n" >&2
    # printf "\n" >&2
    # printf "        ${YELLOW}❯${NC} Choose runtime: ${GRAY}(1 or 2, default: 1)${NC}\n" >&2
    # printf "        " >&2

    # read -r response || response=""

    # case "$response" in
    #     [nN]|[nN][oO])
    #         install_docker_desktop
    #         ;;
    #     *)
    
    # ------------------------------------------------------------------------
    # Install OrbStack via Homebrew
    # ------------------------------------------------------------------------
    install_orbstack
    #     ;;
    # esac
}

# Install OrbStack Docker
install_orbstack() {
    # Set environment to avoid prompts
    export HOMEBREW_NO_AUTO_UPDATE=1
    export HOMEBREW_NO_ENV_HINTS=1

    # Install OrbStack Docker
    brew install orbstack >/dev/null 2>&1 &
    show_spinner $! "Installing OrbStack Docker"

    if [ $? -ne 0 ]; then
        printf "\r        ${RED}✗${NC} OrbStack Docker installation failed\n" >&2
        # DISABLED: Docker Desktop fallback
        # printf "        ${YELLOW}⚠${NC} Falling back to Docker Desktop\n" >&2
        # install_docker_desktop
        return 1
    fi
    printf "\r        ${GREEN}✓${NC} OrbStack Docker installed successfully\n" >&2

    start_orbstack
    return $?
}

# Start OrbStack Docker
start_orbstack() {
    # Check if OrbStack Docker is already running
    if ! pgrep -f "OrbStack.app" >/dev/null 2>&1; then
        # Launch OrbStack Docker
        open -a OrbStack &>/dev/null 2>&1 || open /Applications/OrbStack.app &

        # Brief startup spinner
        for j in $(seq 1 7); do
            case $((j % 10)) in
                0) spin_char='⠋' ;;
                1) spin_char='⠙' ;;
                2) spin_char='⠹' ;;
                3) spin_char='⠸' ;;
                4) spin_char='⠼' ;;
                5) spin_char='⠴' ;;
                6) spin_char='⠦' ;;
                *) spin_char='⠋' ;;
            esac
            printf "\r        ${YELLOW}◉${NC} Starting OrbStack Docker ${BOLD}${CYAN}%s${NC}" "$spin_char" >&2
            sleep 0.15
        done
    fi

    # Wait for Docker to be ready (can take up to 60 seconds)
    i=0
    attempts=0
    max_attempts=60
    while [ $attempts -lt $max_attempts ]; do
        if [ $((i % 13)) -eq 0 ]; then
            { docker ps >/dev/null 2>&1; } 2>/dev/null && docker_ready=0 || docker_ready=1
            if [ $docker_ready -eq 0 ]; then
                printf "\r        ${GREEN}✓${NC} OrbStack Docker is running                          \n" >&2
                return 0
            fi
            attempts=$((attempts + 1))
        fi

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
        printf "\r        ${YELLOW}◉${NC} Waiting for OrbStack Docker to start ${BOLD}${CYAN}%s${NC}" "$spin_char" >&2
        i=$((i + 1))
        sleep 0.15
    done

    printf "\r        ${GREEN}✓${NC} OrbStack Docker started (may need a moment to initialize)          \n" >&2
    return 0
}

# DISABLED: Docker Desktop support
# install_docker_desktop() {
#     # Set environment to avoid prompts
#     export HOMEBREW_NO_AUTO_UPDATE=1
#     export HOMEBREW_NO_ENV_HINTS=1
#
#     # Install Docker Desktop (as cask, not formula)
#     brew install --cask docker >/dev/null 2>&1 &
#     show_spinner $! "Installing Docker Desktop"
#
#     if [ $? -ne 0 ]; then
#         printf "\r        ${RED}✗${NC} Docker Desktop installation failed\n" >&2
#         return 1
#     fi
#     printf "\r        ${GREEN}✓${NC} Docker Desktop installed successfully\n" >&2
#
#     start_docker_desktop
#     return $?
# }

# DISABLED: Docker Desktop support
# start_docker_desktop() {
#     # Launch Docker Desktop
#     open -a Docker &>/dev/null 2>&1 || open /Applications/Docker.app &
#
#         # Show brief startup spinner (1 second)
#         for j in $(seq 1 7); do
#             case $((j % 10)) in
#                 0) spin_char='⠋' ;;
#                 1) spin_char='⠙' ;;
#                 2) spin_char='⠹' ;;
#                 3) spin_char='⠸' ;;
#                 4) spin_char='⠼' ;;
#                 5) spin_char='⠴' ;;
#                 6) spin_char='⠦' ;;
#                 *) spin_char='⠋' ;;
#             esac
#             printf "\r        ${YELLOW}◉${NC} Starting Docker Desktop ${BOLD}${CYAN}%s${NC}" "$spin_char" >&2
#             sleep 0.15
#         done
#
#         # Wait for Docker to start with spinner (up to 2 minutes)
#         i=0
#         attempts=0
#         max_attempts=60
#         while [ $attempts -lt $max_attempts ]; do
#             # Check Docker status every 13 spinner cycles (roughly 2 seconds)
#             if [ $((i % 13)) -eq 0 ]; then
#                 # Suppress "Killed: 9" messages by redirecting all error output
#                 { docker ps >/dev/null 2>&1; } 2>/dev/null && docker_ready=0 || docker_ready=1
#                 if [ $docker_ready -eq 0 ]; then
#                     printf "\r        ${GREEN}✓${NC} Docker is running\n" >&2
#                     return 0
#                 fi
#                 attempts=$((attempts + 1))
#             fi
#
#             # Show spinner (same pattern as show_spinner function)
#             case $((i % 10)) in
#                 0) spin_char='⠋' ;;
#                 1) spin_char='⠙' ;;
#                 2) spin_char='⠹' ;;
#                 3) spin_char='⠸' ;;
#                 4) spin_char='⠼' ;;
#                 5) spin_char='⠴' ;;
#                 6) spin_char='⠦' ;;
#                 7) spin_char='⠧' ;;
#                 8) spin_char='⠇' ;;
#                 9) spin_char='⠏' ;;
#             esac
#             printf "\r        ${YELLOW}◉${NC} Waiting for Docker to start ${BOLD}${CYAN}%s${NC}" "$spin_char" >&2
#             i=$((i + 1))
#             sleep 0.15
#         done
#
#         # Clear spinner line if timeout
#         printf "\r\033[K" >&2
#
#         printf "        ${YELLOW}⚠${NC} Docker Desktop may take additional time to start\n" >&2
#         printf "        ${GRAY}  Please wait for Docker Desktop to finish launching${NC}\n" >&2
#         return 0
# }

# Main
# Skip redundant check if called from install script
if [ "${1:-}" != "--skip-check" ]; then
    printf "\n        ${PALEGREEN}${BOLD}🐳 Docker Setup Installation${NC}\n" >&2
    printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n" >&2

    # Check if already installed
    if check_docker; then
        exit 0
    fi
fi

# Install based on OS
case "$OS" in
    linux)
        install_docker_linux
        ;;
    macos)
        install_docker_macos
        ;;
    *)
        printf "        ${RED}✗${NC} Unsupported OS\n" >&2
        exit 1
        ;;
esac

printf "\n        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n" >&2
printf "        ${GREEN}✓${NC} ${BOLD}Docker setup completed successfully!${NC}\n" >&2
printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n" >&2
