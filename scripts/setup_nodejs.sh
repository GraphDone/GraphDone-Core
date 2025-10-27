#!/bin/sh
# ============================================================================
# GraphDone Node.js Auto-Installation Script
# ============================================================================
#
# Platform Support:
#   ✓ macOS    - Homebrew
#   ✓ Linux    - nvm (Node Version Manager)
#
# Installation methods:
#   macOS:   Homebrew (latest Node.js)
#   Linux:   nvm (Node.js 22 LTS, no sudo required)
# ============================================================================

# ============================================================================
# MACOS NODE.JS INSTALLATION
# ============================================================================
# Installs Node.js on macOS using Homebrew
#
# Method: Homebrew Installation
#   - Command: brew install node
#   - Installs: Latest stable Node.js + npm together
#   - Version: Latest (e.g., 22.11.0)
#   - Benefits: Always up-to-date, easy to maintain, includes npm
#
# Flow:
#   1. Check if Homebrew exists (command -v brew)
#   2. If Homebrew exists:
#      - Set environment variables to avoid prompts
#      - Run brew install node in background
#      - Show animated spinner during installation
#      - Verify installation and display versions
#   3. If Homebrew doesn't exist:
#      - Show manual installation URL (nodejs.org)
#      - Wait for user to complete installation
#
# Exit codes:
#   0 - Success (Node.js installed successfully)
#   1 - Failure (Installation failed or Homebrew not found)
# ============================================================================

# ============================================================================
# LINUX NODE.JS INSTALLATION
# ============================================================================
# Installs Node.js on Linux using nvm (Node Version Manager)
#
# Method: nvm Installation
#   - Step 1: Install nvm if not present
#     - Command: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
#     - Installs to: $HOME/.nvm/
#     - No sudo required (user-level installation)
#
#   - Step 2: Install Node.js 22 LTS via nvm
#     - Command: nvm install 22
#     - Command: nvm use 22
#     - Command: nvm alias default 22
#     - Version: Node.js 22 LTS + npm 10.x
#
# Flow:
#   1. Check if nvm already installed ($HOME/.nvm/nvm.sh)
#   2. If not installed:
#      - Download and install nvm via curl
#      - Show animated spinner during installation
#      - Verify nvm installation
#   3. Load nvm into current shell
#   4. Install Node.js 22 LTS:
#      - Run nvm install/use/alias in background
#      - Show animated spinner during installation
#   5. Reload nvm to update PATH
#   6. Verify Node.js and npm are available
#   7. Display setup instructions for new terminals
#
# Benefits:
#   - No sudo required (user-level installation)
#   - Multiple Node.js versions support
#   - Easy version switching
#   - Automatic npm inclusion
#
# Exit codes:
#   0 - Success (Node.js installed successfully)
#   1 - Failure (nvm or Node.js installation failed)
# ============================================================================

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
        *)
            OS="unknown"
            printf "  ${YELLOW}✗${NC} ${BOLD}Unsupported OS${NC} ${GRAY}${os_type}${NC}\n" >&2
            printf "  ${BLUE}ⓘ${NC} ${GRAY}Supported: macOS, Linux${NC}\n" >&2
            exit 1
            ;;
    esac
}

detect_os

# ============================================================================
# COLORS
# ============================================================================

if [ -t 2 ]; then
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        CYAN='\033[38;5;51m'
        GREEN='\033[38;5;154m'
        YELLOW='\033[38;5;220m'
        PURPLE='\033[38;5;135m'
        BLUE='\033[38;5;33m'
        VIOLET='\033[38;5;213m'  # Violet (256-color palette)
        PALEGREEN='\033[38;2;152;251;152m'  # Palegreen (#98fb98)
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
        VIOLET='\033[0;35m'  # Magenta (basic ANSI)
        PALEGREEN='\033[0;32m'  # Fallback to green
        GRAY='\033[0;90m'
        BOLD='\033[1m'
        DIM='\033[2m'
        NC='\033[0m'
    fi
else
    CYAN='' GREEN='' YELLOW='' PURPLE='' BLUE='' VIOLET='' PALEGREEN='' GRAY='' BOLD='' DIM='' NC=''
fi

# Helper functions - redirect to stderr
log_info() { printf "        ${CYAN}ℹ${NC} $1\n" >&2; }
log_success() { printf "        ${GREEN}✓${NC} $1\n" >&2; }
log_warning() { printf "        ${YELLOW}⚠${NC} $1\n" >&2; }
log_error() { printf "        ${RED}✗${NC} $1\n" >&2; }

echo "" >&2
printf "        ${PALEGREEN}${BOLD}📦 Node.js Installation Setup${NC}\n" >&2
printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n" >&2

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
        printf "\r        ${VIOLET}◉${NC} %s ${BOLD}${CYAN}%s${NC}" "$msg" "$spin_char" >&2
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
            printf "        ${GREEN}✓${NC} Node.js ${node_full} and npm ${npm_full} already installed\n" >&2
            return 0
        else
            printf "        ${YELLOW}⚠${NC} Node.js ${node_full:-unknown} found but version requirements not met\n" >&2
            printf "        ${GRAY}  Required: Node.js >= 18.0.0, npm >= 9.0.0${NC}\n" >&2
            return 1
        fi
    else
        printf "        ${VIOLET}◉${NC} Node.js not found - installing latest version\n" >&2
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

# ============================================================================
# MACOS INSTALLATION FUNCTION - install_nodejs_macos()
# ============================================================================
install_nodejs_macos() {
    # ------------------------------------------------------------------------
    # Check if Homebrew is available (macOS package manager)
    # ------------------------------------------------------------------------
    if command -v brew > /dev/null 2>&1; then
        # Set environment to avoid prompts during installation
        export HOMEBREW_NO_AUTO_UPDATE=1  # Don't auto-update Homebrew itself
        export HOMEBREW_NO_ENV_HINTS=1    # Don't show environment hints

        # Show initial status
        printf "        ${VIOLET}◉${NC} Installing Node.js (latest)" >&2

        # ------------------------------------------------------------------------
        # HOMEBREW INSTALLATION: brew install node
        # ------------------------------------------------------------------------
        # Start installation in background to show spinner
        brew install node >/dev/null 2>&1 &
        install_pid=$!

        # ------------------------------------------------------------------------
        # Animated Spinner - Shows progress while Homebrew works
        # ------------------------------------------------------------------------
        i=0
        spin_char=""

        while kill -0 $install_pid 2>/dev/null; do
            # Cycle through 10 spinner characters (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
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
            printf "\r        ${VIOLET}◉${NC} Installing Node.js (latest) ${BOLD}${CYAN}%s${NC}" "$spin_char" >&2
            i=$((i + 1))
            sleep 0.15  # 150ms per frame = ~6.6 FPS
        done
        
        # Wait for Homebrew to complete
        wait $install_pid

        # ------------------------------------------------------------------------
        # Installation Success - Node.js and npm installed together
        # ------------------------------------------------------------------------
        printf "\r        ${GREEN}✓${NC} Node.js installed                    \n" >&2
        return 0
    else
        # ------------------------------------------------------------------------
        # FALLBACK: Homebrew not available - Show manual installation URL
        # ------------------------------------------------------------------------
        printf "${YELLOW}!${NC} Please install from: https://nodejs.org/en/download/prebuilt-installer\n" >&2
        printf "${CYAN}❯${NC} ${BOLD}Have you installed Node.js?${NC} ${GRAY}[Press Enter when done]${NC}\n" >&2
        read -r response
        return 0
    fi
}

# ============================================================================
# LINUX INSTALLATION FUNCTION - install_nodejs_linux()
# ============================================================================
install_nodejs_linux() {
    printf "        ${VIOLET}◉${NC} Installing Node.js via nvm (Node Version Manager)\n" >&2

    # ------------------------------------------------------------------------
    # STEP 1: Check if nvm is already installed
    # ------------------------------------------------------------------------
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        printf "        ${GREEN}✓${NC} nvm already installed\n" >&2
    else
        # --------------------------------------------------------------------
        # STEP 1a: Install nvm (Node Version Manager)
        # --------------------------------------------------------------------
        # Download and run nvm installation script
        # URL: https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh
        # Installs to: $HOME/.nvm/
        # No sudo required - user-level installation
        printf "        ${VIOLET}◉${NC} Installing nvm" >&2
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh 2>/dev/null | bash &
        show_spinner $! "Installing nvm"

        # --------------------------------------------------------------------
        # Verify nvm Installation
        # --------------------------------------------------------------------
        if [ -s "$HOME/.nvm/nvm.sh" ]; then
            printf "\r        ${GREEN}✓${NC} nvm installed successfully                    \n" >&2
        else
            printf "\r        ${RED}✗${NC} nvm installation failed                    \n" >&2
            return 1
        fi
    fi

    # ------------------------------------------------------------------------
    # STEP 2: Load nvm into current shell
    # ------------------------------------------------------------------------
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    # Verify nvm is loaded
    if ! command -v nvm > /dev/null 2>&1; then
        printf "        ${RED}✗${NC} Could not load nvm\n" >&2
        return 1
    fi

    # ------------------------------------------------------------------------
    # STEP 3: Install Node.js 22 LTS via nvm
    # ------------------------------------------------------------------------
    printf "        ${VIOLET}◉${NC} Installing Node.js 22 (LTS)" >&2

    # Install Node.js 22 LTS and set as default
    # Commands run in background:
    #   nvm install 22        - Install Node.js 22 LTS
    #   nvm use 22            - Use Node.js 22 in current shell
    #   nvm alias default 22  - Set Node.js 22 as default for new shells
    (nvm install 22 && nvm use 22 && nvm alias default 22) > /dev/null 2>&1 &
    show_spinner $! "Installing Node.js 22 (LTS)"

    # ------------------------------------------------------------------------
    # STEP 4: Reload nvm to update PATH
    # ------------------------------------------------------------------------
    # Reload to get node and npm commands in PATH
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    # ------------------------------------------------------------------------
    # STEP 5: Verify Installation Success
    # ------------------------------------------------------------------------
    if command -v node > /dev/null 2>&1; then
        # Node.js and npm successfully installed
        printf "\r        ${GREEN}✓${NC} Node.js $(node --version) and npm $(npm --version) installed                    \n" >&2
        
        # Display setup instructions for new terminal sessions
        printf "        ${GRAY}  💡 To use Node.js in new terminals, add to your ~/.bashrc or ~/.zshrc:${NC}\n" >&2
        printf "        ${GRAY}     export NVM_DIR=\"\$HOME/.nvm\"${NC}\n" >&2
        printf "        ${GRAY}     [ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"${NC}\n" >&2
        return 0
    else
        # Installation failed - node command not found
        printf "\r        ${RED}✗${NC} Node.js installation failed                    \n" >&2
        return 1
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
            printf "        ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${node_version}${NC} and ${BOLD}npm${NC} ${GREEN}${npm_version}${NC} ready\n" >&2
            return 0
        else
            printf "${YELLOW}!${NC} Node.js installed but version requirements not met\n" >&2
            printf "${GRAY}  Found: Node.js ${node_version}, npm ${npm_version}${NC}\n" >&2
            printf "${GRAY}  Required: Node.js >= 18.0.0, npm >= 9.0.0${NC}\n" >&2
            return 1
        fi
    else
        printf "${RED}✗${NC} Node.js installation verification failed\n" >&2
        return 1
    fi
}

# Function to update npm if needed
update_npm() {
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version 2>/dev/null | cut -d. -f1 || echo "0")
        if [ "$npm_version" -lt 9 ]; then
            printf "${VIOLET}◉${NC} Updating npm to latest version\n" >&2
            if npm install -g npm@latest >/dev/null 2>&1; then
                local npm_new=$(npm --version 2>/dev/null || echo "unknown")
                printf "${GREEN}✓${NC} npm updated to ${GREEN}${npm_new}${NC}\n" >&2
                return 0
            else
                printf "${RED}✗${NC} npm update failed\n" >&2
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
            # Output line count to stdout for install.sh
            return 0  # Node.js installed and meets requirements - we're done
        fi
    fi

    # Proceed with installation
    if ! install_nodejs; then
        printf "${RED}✗${NC} Node.js installation failed\n" >&2
        # Output line count even on failure
        exit 1
    fi

    # Update npm if needed
    if ! update_npm; then
        printf "${YELLOW}!${NC} npm update failed but Node.js is installed\n" >&2
    fi

    # Verify final installation
    if verify_nodejs; then
        printf "\n        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n" >&2
        printf "        ${GREEN}✓${NC} ${BOLD}Node.js setup completed successfully!${NC}\n" >&2
        printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n" >&2
    else
        printf "\n${YELLOW}!${NC} Node.js installed but may need manual verification\n" >&2
        exit 1
    fi

    # Output line count to stdout for install.sh
}

# Execute main function with error handling
if ! main "$@"; then
    printf "\n${YELLOW}✗${NC} ${BOLD}Node.js setup${NC} ${YELLOW}failed${NC}\n" >&2
    exit 1
fi
