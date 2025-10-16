#!/bin/sh
# GraphDone Docker Setup Script (POSIX-compatible)
# Linux: Docker Engine via official repository
# macOS: Docker Desktop via Homebrew (automatic)

set -eu

# Track output lines for install.sh to clear later
OUTPUT_LINES=0

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
        printf "\r        ${VIOLET}◉${NC} %s ${CYAN}%s${NC}" "$msg" "$spin_char" >&2
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
            OUTPUT_LINES=$((OUTPUT_LINES + 1))

            # Check if running (suppress "Killed" messages)
            { docker ps >/dev/null 2>&1; } 2>/dev/null && docker_running=0 || docker_running=1
            if [ $docker_running -eq 0 ]; then
                printf "        ${GREEN}✓${NC} Docker is running\n" >&2
                OUTPUT_LINES=$((OUTPUT_LINES + 1))
                return 0
            else
                printf "        ${YELLOW}⚠${NC} Docker is installed but not running\n" >&2
                OUTPUT_LINES=$((OUTPUT_LINES + 1))
                printf "        ${GRAY}  Please start Docker manually${NC}\n" >&2
                OUTPUT_LINES=$((OUTPUT_LINES + 1))
                return 1
            fi
        fi
    fi
    return 1
}

# Install Docker on Linux
install_docker_linux() {
    printf "        ${VIOLET}◉${NC} Installing Docker via snap\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))

    # Check if snap is available
    if ! command -v snap >/dev/null 2>&1; then
        printf "        ${YELLOW}⚠${NC} Snap not found, using apt method\n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        install_docker_apt
        return $?
    fi

    # Request sudo password upfront
    printf "        ${VIOLET}◉${NC} Requesting administrative privileges\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    if ! sudo -v; then
        printf "        ${RED}✗${NC} Failed to obtain sudo privileges\n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        return 1
    fi
    
    # Install Docker via snap with spinner
    sudo snap install docker >/dev/null 2>&1 &
    show_spinner $! "Installing Docker snap package"

    if [ $? -eq 0 ]; then
        printf "\r        ${GREEN}✓${NC} Docker installed successfully via snap                    \n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        return 0
    else
        printf "\r        ${YELLOW}⚠${NC} Snap installation failed, trying apt method\n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        install_docker_apt
        return $?
    fi
}

# Install Docker via apt (fallback)
install_docker_apt() {
    printf "        ${VIOLET}◉${NC} Installing Docker Engine via apt\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))

    # Update package index
    printf "        ${VIOLET}◉${NC} Updating package lists\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    sudo apt-get update >/dev/null 2>&1

    # Install prerequisites
    printf "        ${VIOLET}◉${NC} Installing prerequisites\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    sudo apt-get install -y ca-certificates curl gnupg lsb-release >/dev/null 2>&1

    # Add Docker GPG key
    printf "        ${VIOLET}◉${NC} Adding Docker GPG key\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg >/dev/null 2>&1

    # Add Docker repository
    printf "        ${VIOLET}◉${NC} Adding Docker repository\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    # Update package index again
    sudo apt-get update >/dev/null 2>&1

    # Install Docker
    printf "        ${VIOLET}◉${NC} Installing Docker Engine\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1

    # Add user to docker group
    printf "        ${VIOLET}◉${NC} Adding user to docker group\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    sudo usermod -aG docker "$USER"

    printf "        ${GREEN}✓${NC} Docker installed successfully\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    printf "        ${YELLOW}⚠${NC} ${GRAY}Please log out and back in for group changes to take effect${NC}\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))
    return 0
}

# Install Docker on macOS
install_docker_macos() {
    # Don't count this line - it gets overwritten by the spinner below
    # printf "        ${VIOLET}◉${NC} Installing Docker Desktop via Homebrew\n" >&2
    # OUTPUT_LINES=$((OUTPUT_LINES + 1))

    # Check if Homebrew is available
    if ! command -v brew >/dev/null 2>&1; then
        printf "        ${RED}✗${NC} Homebrew not found\n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        printf "        ${GRAY}  Install Homebrew first: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${NC}\n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        return 1
    fi
    
    # Set environment to avoid prompts
    export HOMEBREW_NO_AUTO_UPDATE=1
    export HOMEBREW_NO_ENV_HINTS=1
    
    # Install Docker Desktop with spinner
    brew install --cask docker >/dev/null 2>&1 &
    show_spinner $! "Installing Docker Desktop"

    if [ $? -eq 0 ]; then
        printf "\r        ${GREEN}✓${NC} Docker Desktop installed successfully                    \n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))

        # Launch Docker Desktop
        open -a Docker &

        # Show brief startup spinner (1 second)
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
            printf "\r        ${VIOLET}◉${NC} Starting Docker Desktop ${CYAN}%s${NC}" "$spin_char" >&2
            sleep 0.15
        done

        # Wait for Docker to start with spinner (up to 2 minutes)
        i=0
        attempts=0
        max_attempts=60
        while [ $attempts -lt $max_attempts ]; do
            # Check Docker status every 13 spinner cycles (roughly 2 seconds)
            if [ $((i % 13)) -eq 0 ]; then
                # Suppress "Killed: 9" messages by redirecting all error output
                { docker ps >/dev/null 2>&1; } 2>/dev/null && docker_ready=0 || docker_ready=1
                if [ $docker_ready -eq 0 ]; then
                    printf "\r        ${GREEN}✓${NC} Docker is running                    \n" >&2
                    OUTPUT_LINES=$((OUTPUT_LINES + 1))
                    return 0
                fi
                attempts=$((attempts + 1))
            fi

            # Show spinner (same pattern as show_spinner function)
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
            printf "\r        ${VIOLET}◉${NC} Waiting for Docker to start ${CYAN}%s${NC}" "$spin_char" >&2
            i=$((i + 1))
            sleep 0.15
        done

        # Clear spinner line if timeout
        printf "\r\033[K" >&2

        printf "        ${YELLOW}⚠${NC} Docker Desktop installed but may take time to start\n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        printf "        ${GRAY}  Please wait for Docker Desktop to finish launching${NC}\n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        return 0
    else
        printf "\r        ${RED}✗${NC} Docker Desktop installation failed                    \n" >&2
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        return 1
    fi
}

# Main
# Skip redundant check if called from install script
if [ "${1:-}" != "--skip-check" ]; then
    printf "\n        ${PALEGREEN}${BOLD}🐳 Docker Setup Installation${NC}\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 2))  # \n + line
    printf "        ${GRAY}──────────────────────────${NC}\n" >&2
    OUTPUT_LINES=$((OUTPUT_LINES + 1))

    # Check if already installed
    if check_docker; then
        echo "$OUTPUT_LINES"
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
        OUTPUT_LINES=$((OUTPUT_LINES + 1))
        echo "$OUTPUT_LINES"
        exit 1
        ;;
esac

# Output line count to stdout for install.sh
echo "$OUTPUT_LINES"
