#!/bin/sh
# Git Installation Script - Cross-platform automatic setup
#
# Features:
#   ✓ Detects existing Git installations
#   ✓ Installs latest Git via package managers
#   ✓ Cross-platform support (macOS, Linux)
#   ✓ Automatic version verification
#
# Usage:
#   ./scripts/setup_git.sh          # Normal installation
#   ./scripts/setup_git.sh --skip-check  # Skip initial check

set -e

# Colors for output
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    LIGHTCORAL='\033[38;5;210m'  # Light coral (256-color palette)
    CYAN='\033[0;36m'
    GRAY='\033[0;90m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' LIGHTCORAL='' CYAN='' GRAY='' BOLD='' NC=''
fi

# Helper functions
log_info() { printf "        ${CYAN}ℹ${NC} $1\n"; }
log_success() { printf "        ${GREEN}✓${NC} $1\n"; }
log_warning() { printf "        ${YELLOW}⚠${NC} $1\n"; }
log_error() { printf "        ${RED}✗${NC} $1\n" >&2; }

# Spinner helper
get_spinner_char() {
    case $1 in
        0) printf "⠋" ;;
        1) printf "⠙" ;;
        2) printf "⠹" ;;
        3) printf "⠸" ;;
        4) printf "⠼" ;;
        5) printf "⠴" ;;
        6) printf "⠦" ;;
        7) printf "⠧" ;;
        8) printf "⠇" ;;
        9) printf "⠏" ;;
        *) printf "⠋" ;;
    esac
}

# Platform detection
detect_platform() {
    case "$(uname)" in
        Darwin*)
            PLATFORM="macos"
            ;;
        Linux*)
            PLATFORM="linux"
            ;;
        *)
            PLATFORM="unknown"
            ;;
    esac
}

# Check if Git is already installed
check_git_installed() {
    if [ "$1" != "--skip-check" ]; then
        if command -v git >/dev/null 2>&1; then
            GIT_VERSION=$(git --version | sed 's/git version //')
            CURRENT_VERSION=$(echo "$GIT_VERSION" | sed 's/ (Apple Git.*)//' | sed 's/[^0-9.]//g')
            printf "        ${GREEN}✓${NC} ${BOLD}Git${NC} ${GREEN}v${GIT_VERSION}${NC} is already installed\n"
            
            # Try to get latest version from Homebrew
            LATEST_VERSION=""
            if command -v brew >/dev/null 2>&1; then
                LATEST_VERSION=$(brew info git 2>/dev/null | head -n 1 | sed 's/.*stable \([0-9.]*\).*/\1/' || echo "")
            fi
            
            # Check if it's Apple Git - always update Apple Git
            if echo "$GIT_VERSION" | grep -q "Apple Git"; then
                if [ -n "$LATEST_VERSION" ]; then
                    printf "        ${YELLOW}⚠${NC} Detected Apple's bundled Git. Latest version available: ${BOLD}${LATEST_VERSION}${NC}\n"
                else
                    log_warning "Detected Apple's bundled Git. Installing latest version via Homebrew..."
                fi
                # Don't exit, continue to installation
            else
                # For non-Apple Git, compare with latest version
                if [ -n "$LATEST_VERSION" ]; then
                    # Compare versions
                    if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
                        log_info "Git version is current (${LATEST_VERSION}). No update needed."
                        exit 0
                    else
                        printf "        ${YELLOW}⚠${NC} Git ${CURRENT_VERSION} is outdated. Latest version: ${BOLD}${LATEST_VERSION}${NC}\n"
                    fi
                else
                    # Fallback to version check if can't get latest
                    MAJOR_VERSION=$(echo "$CURRENT_VERSION" | cut -d. -f1)
                    MINOR_VERSION=$(echo "$CURRENT_VERSION" | cut -d. -f2)
                    
                    if [ "$MAJOR_VERSION" -ge 2 ] && [ "$MINOR_VERSION" -ge 45 ]; then
                        log_info "Git version appears current. No update needed."
                        exit 0
                    else
                        log_warning "Git version is outdated. Updating to latest..."
                    fi
                fi
            fi
        else
            log_info "Git not found. Installing..."
        fi
    fi
}

# Install Git on macOS
install_git_macos() {
    log_info "Installing latest Git via Homebrew..."
    
    # Check if Homebrew is available
    if command -v brew >/dev/null 2>&1; then
        # Show a spinner while installing
        printf "        ${CYAN}ℹ ${NC}Downloading and installing Git "
        
        # Install or upgrade Git (suppress all output)
        if brew list git &>/dev/null; then
            # Upgrade existing Git
            brew upgrade git >/dev/null 2>&1 &
        else
            # Install Git fresh
            brew install git >/dev/null 2>&1 &
        fi
        
        # Show spinner while brew is running
        brew_pid=$!
        spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        i=0
        while kill -0 $brew_pid 2>/dev/null; do
            printf "\r        ${CYAN}ℹ ${NC}Downloading and installing Git ${CYAN}${spin:i:1}${NC}"
            i=$(( (i+1) % ${#spin} ))
            sleep 0.1
        done
        
        # Wait for brew to complete
        wait $brew_pid
        brew_result=$?
        
        # Clear the line
        printf "\r\033[K"
        
        if [ $brew_result -eq 0 ]; then
            # Verify installation and get version
            if command -v git >/dev/null 2>&1; then
                GIT_VERSION=$(git --version | sed 's/git version //')
                printf "        ${GREEN}✓${NC} Git ${GREEN}v${GIT_VERSION}${NC} installed successfully\n"
            else
                log_error "Git installation via Homebrew failed"
                exit 1
            fi
        else
            log_error "Git installation failed"
            exit 1
        fi
    else
        # No Homebrew, try Xcode Command Line Tools
        log_info "Homebrew not found. Installing Xcode Command Line Tools..."
        log_info "This includes Git and other development tools."
        
        # Check if Xcode tools are already installed
        if xcode-select -p &>/dev/null; then
            log_info "Xcode Command Line Tools already installed"
            
            # Git should be available now
            if command -v git >/dev/null 2>&1; then
                GIT_VERSION=$(git --version | sed 's/git version //')
                printf "        ${GREEN}✓${NC} Git ${GREEN}v${GIT_VERSION}${NC} available via Xcode tools\n"
            else
                log_error "Git not found despite Xcode tools being installed"
                exit 1
            fi
        else
            log_info "Triggering Xcode Command Line Tools installation..."
            xcode-select --install
            
            log_warning "Please complete the Xcode installer that just opened."
            log_warning "After installation completes, run this script again."
            exit 1
        fi
    fi
}

# Install Git on Linux
install_git_linux() {
    # Check if Git is already installed and current
    if command -v git >/dev/null 2>&1; then
        GIT_VERSION=$(git --version | sed 's/git version //')
        MAJOR=$(echo "$GIT_VERSION" | sed 's/[^0-9.].*//g' | cut -d. -f1)
        MINOR=$(echo "$GIT_VERSION" | sed 's/[^0-9.].*//g' | cut -d. -f2)
        
        if [ "$MAJOR" -ge 2 ] && [ "$MINOR" -ge 30 ]; then
            # Git is already current, skip installation
            return 0
        fi
    fi
    
    # Detect package manager and install
    if command -v apt-get >/dev/null 2>&1; then
        # Everything in background to show spinner immediately
        (
            # Check if PPA already added
            if ! grep -q "^deb.*git-core/ppa" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
                # Add PPA non-interactively
                sudo add-apt-repository -y ppa:git-core/ppa < /dev/null >/dev/null 2>&1
            fi
            
            # Update and install silently
            sudo apt-get update -qq >/dev/null 2>&1
            sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git >/dev/null 2>&1
        ) &
        install_pid=$!
        
        # Show spinner while installing
        spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
        i=0
        while kill -0 $install_pid 2>/dev/null; do
            printf "\r        ${BLUE}◉${NC} Installing latest Git ${CYAN}$(get_spinner_char "$i")${NC}\033[K"
            i=$(( (i+1) % 10 ))
            sleep 0.1
        done
        
        wait $install_pid
        install_result=$?
        printf "\r\033[K"
        
        if [ $install_result -ne 0 ]; then
            log_error "Git installation failed"
            exit 1
        fi
        
    elif command -v yum >/dev/null 2>&1; then
        log_info "Using yum to install Git..."
        sudo yum install -y git
        
    elif command -v dnf >/dev/null 2>&1; then
        log_info "Using dnf to install Git..."
        sudo dnf install -y git
        
    elif command -v pacman >/dev/null 2>&1; then
        log_info "Using pacman to install Git..."
        sudo pacman -S --noconfirm git
        
    elif command -v zypper >/dev/null 2>&1; then
        log_info "Using zypper to install Git..."
        sudo zypper install -y git
        
    elif command -v apk >/dev/null 2>&1; then
        log_info "Using apk to install Git..."
        sudo apk add --no-cache git
        
    else
        log_error "No supported package manager found"
        log_error "Please install Git manually: https://git-scm.com/downloads"
        exit 1
    fi
    
    # Verify installation
    if command -v git >/dev/null 2>&1; then
        GIT_VERSION=$(git --version | sed 's/git version //')
        log_success "Git ${GREEN}v${GIT_VERSION}${NC} installed successfully"
    else
        log_error "Git installation failed"
        exit 1
    fi
}


# Configure Git with sensible defaults
configure_git() {
    
    # Only set if not already configured
    if [ -z "$(git config --global user.name)" ]; then
        log_info "Setting up Git identity (can be changed later)..."
        git config --global user.name "GraphDone User"
        git config --global user.email "user@graphdone.local"
    fi
    
    # Set useful defaults
    git config --global init.defaultBranch main 2>/dev/null || true
    git config --global pull.rebase false 2>/dev/null || true
    git config --global core.autocrlf input 2>/dev/null || true
    
    log_success "Git configuration complete"
}

# Main installation flow
main() {
    printf "\n        ${BOLD}${LIGHTCORAL}🔧 Git Installation Script${NC}\n"
    printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n"
    
    # Detect platform
    detect_platform
    log_info "Detected platform: ${BOLD}$PLATFORM${NC}"
    
    # Check if Git is already installed
    check_git_installed "$1"
    
    # Install based on platform
    case $PLATFORM in
        macos)
            install_git_macos
            ;;
        linux)
            install_git_linux
            ;;
        *)
            log_error "Unsupported platform: $PLATFORM"
            log_info "Please install Git manually from: https://git-scm.com"
            exit 1
            ;;
    esac
    
    # Configure Git
    configure_git
    
    printf "\n        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    printf "        ${GREEN}✓${NC} ${BOLD}Git setup completed successfully!${NC}\n"
    printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n"
}

# Run main function
main "$@"