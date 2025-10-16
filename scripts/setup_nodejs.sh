#!/bin/sh
# ============================================================================
# GraphDone Node.js Auto-Installation Script
# ============================================================================
#
# Platform Support:
#   ✓ macOS    - Homebrew
#   ✓ Linux    - nvm (Node Version Manager)
#   ✓ Windows  - Chocolatey, Scoop, Winget, or manual installer
#
# Installation methods:
#   macOS:   Homebrew (latest Node.js)
#   Linux:   nvm (Node.js 22 LTS, no sudo required)
#   Windows: Chocolatey/Winget/Scoop

set -eu
if [ -n "${BASH_VERSION:-}" ]; then
    set -o pipefail
fi

# ============================================================================
# CLEANUP AND ERROR HANDLING
# ============================================================================

cleanup() {
    rm -f "/tmp/nodesource_setup.sh" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Only set ERR trap if running in bash (not available in POSIX sh)
if [ -n "${BASH_VERSION:-}" ]; then
    handle_error() {
        local exit_code=$?
        local line_number=$1
        echo "✗ Error occurred at line ${line_number}, exit code: ${exit_code}" >&2
        cleanup
        exit "${exit_code}"
    }
    trap 'handle_error ${LINENO}' ERR
fi

USER=$(whoami)

command_exists() {
    command -v "$1" > /dev/null 2>&1
}

# ============================================================================
# PLATFORM DETECTION
# ============================================================================

detect_os() {
    # Get OS type - use OSTYPE if available (Bash), otherwise use uname
    local os_type="${OSTYPE:-$(uname -s 2>/dev/null || echo 'unknown')}"
    
    case "$os_type" in
        darwin*|Darwin)
            OS="macos"
            ;;
        linux-gnu*|Linux)
            OS="linux"
            ;;
        msys|cygwin|MINGW*|MSYS*|CYGWIN*)
            OS="windows"
            ;;
        *)
            OS="unknown"
            printf "  ${YELLOW}✗${NC} ${BOLD}Unsupported OS${NC} ${GRAY}${os_type}${NC}\n" >&2
            printf "  ${BLUE}ⓘ${NC} ${GRAY}Supported: macOS, Linux, Windows${NC}\n" >&2
            exit 1
            ;;
    esac
}

detect_os

# ============================================================================
# COLORS
# ============================================================================

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

# ============================================================================
# SPINNER FUNCTION (POSIX-compatible)
# ============================================================================

show_spinner() {
    local pid=$1
    local msg="$2"
    local i=0
    local spin_char
    
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

# ============================================================================
# VERSION CHECK (Cross-platform)
# ============================================================================

# Function to check if Node.js is installed with correct version
check_nodejs_installed() {
    if command -v node > /dev/null 2>&1; then
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
        "windows")
            install_nodejs_windows
            ;;
        *)
            echo "✗ Unsupported operating system: ${OSTYPE}" >&2
            return 1
            ;;
    esac
}

# ============================================================================
# macOS INSTALLATION
# ============================================================================

# macOS Node.js installation
install_nodejs_macos() {
    # Check if Homebrew is available
    if command -v brew > /dev/null 2>&1; then
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
            printf "\r        ${BLUE}◉${NC} Installing Node.js (latest) ${CYAN}.${NC}"
            i=$(( (i+1) % 10 ))
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

# ============================================================================
# LINUX INSTALLATION
# ============================================================================

# Linux Node.js installation via nvm
install_nodejs_linux() {
    printf "        ${BLUE}◉${NC} Installing Node.js via nvm (Node Version Manager)\n"
    
    # Check if nvm is already installed
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        printf "        ${GREEN}✓${NC} nvm already installed\n"
    else
        printf "        ${GRAY}Installing nvm${NC}"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh 2>/dev/null | bash &
        show_spinner $! "Installing nvm"
        
        if [ -s "$HOME/.nvm/nvm.sh" ]; then
            printf "\r        ${GREEN}✓${NC} nvm installed successfully                    \n"
        else
            printf "\r        ${RED}✗${NC} nvm installation failed                    \n"
            return 1
        fi
    fi
    
    # Load nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    if ! command -v nvm > /dev/null 2>&1; then
        printf "        ${RED}✗${NC} Could not load nvm\n"
        return 1
    fi
    
    printf "        ${GRAY}Installing Node.js 22 (LTS)${NC}"
    
    # Install Node.js 22 LTS (run in background for spinner)
    (nvm install 22 && nvm use 22 && nvm alias default 22) > /dev/null 2>&1 &
    show_spinner $! "Installing Node.js 22 (LTS)"
    
    # Reload to get node in PATH
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    if command -v node > /dev/null 2>&1; then
        printf "\r        ${GREEN}✓${NC} Node.js $(node --version) and npm $(npm --version) installed                    \n"
        printf "        ${GRAY}  💡 To use Node.js in new terminals, add to your ~/.bashrc or ~/.zshrc:${NC}\n"
        printf "        ${GRAY}     export NVM_DIR=\"\$HOME/.nvm\"${NC}\n"
        printf "        ${GRAY}     [ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"${NC}\n"
        return 0
    else
        printf "\r        ${RED}✗${NC} Node.js installation failed                    \n"
        return 1
    fi
}

# ============================================================================
# WINDOWS INSTALLATION
# ============================================================================

# Windows Node.js installation
install_nodejs_windows() {
    printf "        ${BLUE}◉${NC} Installing Node.js for Windows\n"
    
    # Check if Chocolatey is available
    if command -v choco > /dev/null 2>&1; then
        printf "        ${BLUE}◉${NC} Using Chocolatey to install Node.js"
        
        # Install Node.js via Chocolatey
        choco install nodejs -y >/dev/null 2>&1 &
        install_pid=$!
        
        # Show spinner while installing
        spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        i=0
        
        while kill -0 $install_pid 2>/dev/null; do
            printf "\r        ${BLUE}◉${NC} Using Chocolatey to install Node.js ${CYAN}.${NC}"
            i=$(( (i+1) % 10 ))
            sleep 0.15
        done
        wait $install_pid
        
        printf "\r        ${GREEN}✓${NC} Node.js installed via Chocolatey                    \n"
        
        # Refresh environment variables
        printf "        ${BLUE}◉${NC} Refreshing environment variables\n"
        export PATH="/c/Program Files/nodejs:$PATH"
        
        return 0
        
    # Check if Winget is available (Windows 10/11)
    elif command -v winget > /dev/null 2>&1; then
        printf "        ${BLUE}◉${NC} Using winget to install Node.js"
        
        # Install Node.js via winget
        winget install -e --id OpenJS.NodeJS >/dev/null 2>&1 &
        install_pid=$!
        
        # Show spinner while installing
        spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        i=0
        
        while kill -0 $install_pid 2>/dev/null; do
            printf "\r        ${BLUE}◉${NC} Using winget to install Node.js ${CYAN}.${NC}"
            i=$(( (i+1) % 10 ))
            sleep 0.15
        done
        wait $install_pid
        
        printf "\r        ${GREEN}✓${NC} Node.js installed via winget                    \n"
        
        # Refresh environment variables
        printf "        ${BLUE}◉${NC} Refreshing environment variables\n"
        export PATH="/c/Program Files/nodejs:$PATH"
        
        return 0
        
    # Check if Scoop is available
    elif command -v scoop > /dev/null 2>&1; then
        printf "        ${BLUE}◉${NC} Using Scoop to install Node.js"
        
        # Install Node.js via Scoop
        scoop install nodejs >/dev/null 2>&1 &
        install_pid=$!
        
        # Show spinner while installing
        spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        i=0
        
        while kill -0 $install_pid 2>/dev/null; do
            printf "\r        ${BLUE}◉${NC} Using Scoop to install Node.js ${CYAN}.${NC}"
            i=$(( (i+1) % 10 ))
            sleep 0.15
        done
        wait $install_pid
        
        printf "\r        ${GREEN}✓${NC} Node.js installed via Scoop                    \n"
        return 0
        
    else
        # No package manager available - prompt for manual installation
        printf "        ${YELLOW}!${NC} No package manager found (Chocolatey, Winget, or Scoop)\n"
        printf "        ${BLUE}ℹ${NC} ${GRAY}Please install Node.js manually:${NC}\n"
        printf "        ${GRAY}  1. Download from: https://nodejs.org/en/download${NC}\n"
        printf "        ${GRAY}  2. Run the installer (MSI)${NC}\n"
        printf "        ${GRAY}  3. Restart your terminal${NC}\n"
        printf "        ${GRAY}  4. Run this script again${NC}\n\n"
        
        printf "        ${CYAN}❯${NC} ${BOLD}Have you installed Node.js?${NC} ${GRAY}[Press Enter when done]${NC}\n"
        printf "        "
        read -r response
        
        # Check if Node.js is now available
        if command -v node > /dev/null 2>&1; then
            printf "        ${GREEN}✓${NC} Node.js detected\n"
            return 0
        else
            printf "        ${RED}✗${NC} Node.js still not found. Please restart terminal.\n"
            return 1
        fi
    fi
}

# ============================================================================
# VERIFICATION (Cross-platform)
# ============================================================================

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

# ============================================================================
# MAIN EXECUTION
# ============================================================================

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