#!/bin/sh
# ============================================================================
# Git Installation Script - Cross-platform automatic setup
# ============================================================================
#
# FEATURES:
#   ✓ Detects existing Git installations and versions
#   ✓ Installs latest Git via platform package managers
#   ✓ Automatic version verification (>= 2.45 preferred)
#   ✓ Animated spinner progress indicators
#
# USAGE:
#   ./scripts/setup_git.sh
#     → Checks version first, installs only if outdated/missing
#     → Exits early if Git >= 2.45 already installed
#
#   ./scripts/setup_git.sh --skip-check
#     → Skips version check, installs immediately
#     → Used when Git is known to be missing
#
# ============================================================================
# MACOS INSTALLATION
# ============================================================================
# Method 1: Homebrew (Preferred)
#   - Requires: Homebrew package manager (https://brew.sh)
#   - Command: brew install git OR brew upgrade git
#   - Version: Latest stable (e.g., 2.51.1)
#   - Benefits: Always up-to-date, easy to maintain
#   - Detection: Checks if 'brew' command exists
#   - Upgrade: Automatically upgrades if Git already installed via Homebrew
#
# Method 2: Xcode Command Line Tools (Fallback)
#   - Used when: Homebrew not installed
#   - Command: xcode-select --install (triggers GUI installer)
#   - Version: Apple Git (usually older, e.g., 2.39.3)
#   - Benefits: No external dependencies, built into macOS
#   - Detection: Checks if xcode-select -p returns path
#   - Note: Requires manual completion of GUI installer
#
# ============================================================================
# LINUX INSTALLATION
# ============================================================================
# Supported package managers (in order of detection):
#
# 1. apt (Ubuntu/Debian)
#    - Adds git-core PPA for latest version
#    - Command: sudo apt-get install git
#    - Version check: Skips if Git >= 2.30 already installed
#
# 2. yum (RHEL/CentOS)
#    - Command: sudo yum install git
#
# 3. dnf (Fedora)
#    - Command: sudo dnf install git
#
# 4. pacman (Arch Linux)
#    - Command: sudo pacman -S --noconfirm git
#
# 5. zypper (openSUSE)
#    - Command: sudo zypper install git
#
# 6. apk (Alpine Linux)
#    - Command: sudo apk add --no-cache git
#
# All Linux methods include animated spinner and version verification.
#
# ============================================================================

set -e

# Track output lines for install.sh to clear later

# Colors for output
if [ -t 2 ]; then
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        # 256-color mode
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        VIOLET='\033[38;5;213m'  # Violet (256-color palette)
        LIGHTCORAL='\033[38;5;210m'  # Light coral (256-color palette)
        PALEGREEN='\033[38;2;152;251;152m'  # Palegreen (#98fb98)
        CYAN='\033[0;36m'
        GRAY='\033[0;90m'
        BOLD='\033[1m'
        NC='\033[0m'
    else
        # Fallback to basic ANSI
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        VIOLET='\033[0;35m'  # Magenta (basic ANSI)
        LIGHTCORAL='\033[0;31m'  # Fallback to red
        PALEGREEN='\033[0;32m'  # Fallback to green
        CYAN='\033[0;36m'
        GRAY='\033[0;90m'
        BOLD='\033[1m'
        NC='\033[0m'
    fi
else
    RED='' GREEN='' YELLOW='' BLUE='' VIOLET='' LIGHTCORAL='' PALEGREEN='' CYAN='' GRAY='' BOLD='' NC=''
fi

# Helper functions - redirect to stderr
log_info() { printf "        ${CYAN}ℹ${NC} $1\n" >&2; }
log_success() { printf "        ${GREEN}✓${NC} $1\n" >&2; }
log_warning() { printf "        ${YELLOW}⚠${NC} $1\n" >&2; }
log_error() { printf "        ${RED}✗${NC} $1\n" >&2; }

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
            printf "        ${GREEN}✓${NC} ${BOLD}Git${NC} ${GREEN}v${GIT_VERSION}${NC} is already installed\n" >&2

            # Try to get latest version from Homebrew
            LATEST_VERSION=""
            if command -v brew >/dev/null 2>&1; then
                LATEST_VERSION=$(brew info git 2>/dev/null | head -n 1 | sed 's/.*stable \([0-9.]*\).*/\1/' || echo "")
            fi

            # Check if it's Apple Git - always update Apple Git
            if echo "$GIT_VERSION" | grep -q "Apple Git"; then
                if [ -n "$LATEST_VERSION" ]; then
                    printf "        ${YELLOW}⚠${NC} Detected Apple's bundled Git. Latest version available: ${BOLD}${LATEST_VERSION}${NC}\n" >&2
                else
                    log_warning "Detected Apple's bundled Git. Installing latest version via Homebrew"
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
                        printf "        ${YELLOW}⚠${NC} Git ${CURRENT_VERSION} is outdated. Latest version: ${BOLD}${LATEST_VERSION}${NC}\n" >&2
                    fi
                else
                    # Fallback to version check if can't get latest
                    MAJOR_VERSION=$(echo "$CURRENT_VERSION" | cut -d. -f1)
                    MINOR_VERSION=$(echo "$CURRENT_VERSION" | cut -d. -f2)

                    if [ "$MAJOR_VERSION" -ge 2 ] && [ "$MINOR_VERSION" -ge 45 ]; then
                        log_info "Git version appears current. No update needed."
                        exit 0
                    else
                        log_warning "Git version is outdated. Updating to latest"
                    fi
                fi
            fi
        else
            log_info "Git not found. Installing"
        fi
    fi
}

# ============================================================================
# MACOS GIT INSTALLATION FUNCTION
# ============================================================================
# Installs Git on macOS using Homebrew (preferred) or Xcode CLI Tools (fallback)
#
# Flow:
#   1. Check if Homebrew exists (command -v brew)
#   2. If Homebrew exists:
#      - Check if Git already installed via Homebrew (brew list git)
#      - If yes: Run brew upgrade git
#      - If no:  Run brew install git
#      - Show animated spinner during installation
#      - Verify installation and display version
#   3. If Homebrew doesn't exist:
#      - Check if Xcode CLI Tools already installed (xcode-select -p)
#      - If yes: Use existing Apple Git
#      - If no:  Trigger xcode-select --install (GUI installer)
#      - Requires user to complete GUI installation manually
#
# Exit codes:
#   0 - Success (Git installed/upgraded successfully)
#   1 - Failure (Installation failed or Git not found after install)
# ============================================================================
install_git_macos() {
    log_info "Installing latest Git via Homebrew"

    # ------------------------------------------------------------------------
    # METHOD 1: Homebrew Installation (Preferred)
    # ------------------------------------------------------------------------
    if command -v brew >/dev/null 2>&1; then
        # Show a spinner while installing
        printf "        ${VIOLET}◉${NC} Downloading and installing Git " >&2

        # Install or upgrade Git (suppress all output)
        if brew list git &>/dev/null; then
            # Git already installed via Homebrew → Upgrade to latest
            brew upgrade git >/dev/null 2>&1 &
        else
            # Git not installed via Homebrew → Fresh install
            brew install git >/dev/null 2>&1 &
        fi

        # --------------------------------------------------------------------
        # Animated Spinner - Shows progress while Homebrew works
        # --------------------------------------------------------------------
        # Homebrew runs in background, we show spinner in foreground
        brew_pid=$!
        i=0
        spin_char=""
        while kill -0 $brew_pid 2>/dev/null; do
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
            printf "\r        ${VIOLET}◉${NC} Downloading and installing Git ${BOLD}${CYAN}%s${NC}" "$spin_char" >&2
            i=$((i + 1))
            sleep 0.15  # 150ms per frame = ~6.6 FPS
        done

        # Wait for brew to complete and get exit code
        wait $brew_pid
        brew_result=$?

        # Clear the spinner line
        printf "\r\033[K" >&2

        # --------------------------------------------------------------------
        # Verify Installation Success
        # --------------------------------------------------------------------
        if [ $brew_result -eq 0 ]; then
            # Verify installation and get version
            if command -v git >/dev/null 2>&1; then
                GIT_VERSION=$(git --version | sed 's/git version //')
                printf "        ${GREEN}✓${NC} Git ${GREEN}v${GIT_VERSION}${NC} installed successfully\n" >&2
            else
                log_error "Git installation via Homebrew failed"
                exit 1
            fi
        else
            log_error "Git installation failed"
            exit 1
        fi

    # ------------------------------------------------------------------------
    # METHOD 2: Xcode Command Line Tools (Fallback)
    # ------------------------------------------------------------------------
    else
        # No Homebrew, try Xcode Command Line Tools
        log_info "Homebrew not found. Installing Xcode Command Line Tools"
        log_info "This includes Git and other development tools."

        # Check if Xcode tools are already installed
        if xcode-select -p &>/dev/null; then
            # Xcode CLI Tools already installed
            log_info "Xcode Command Line Tools already installed"

            # Git should be available now (Apple Git)
            if command -v git >/dev/null 2>&1; then
                GIT_VERSION=$(git --version | sed 's/git version //')
                printf "        ${GREEN}✓${NC} Git ${GREEN}v${GIT_VERSION}${NC} available via Xcode tools\n" >&2
            else
                log_error "Git not found despite Xcode tools being installed"
                exit 1
            fi
        else
            # Xcode CLI Tools not installed - trigger GUI installer
            log_info "Triggering Xcode Command Line Tools installation"
            xcode-select --install

            # GUI installer opened - user must complete it manually
            log_warning "Please complete the Xcode installer that just opened."
            log_warning "After installation completes, run this script again."
            exit 1
        fi
    fi
}

# ============================================================================
# LINUX GIT INSTALLATION FUNCTION
# ============================================================================
# Installs Git on Linux using various package managers
#
# Supported package managers (checked in this order):
#   1. apt-get (Ubuntu/Debian) - Uses git-core PPA for latest version
#   2. yum (RHEL/CentOS)
#   3. dnf (Fedora)
#   4. pacman (Arch Linux)
#   5. zypper (openSUSE)
#   6. apk (Alpine Linux)
#
# Flow:
#   1. Check if Git already installed and version >= 2.30
#      - If yes: Skip installation (return 0)
#   2. Detect package manager (first available wins)
#   3. Install Git using detected package manager
#   4. Show animated spinner during installation
#   5. Verify installation and display version
#
# Exit codes:
#   0 - Success (Git installed successfully or already current)
#   1 - Failure (No supported package manager or installation failed)
# ============================================================================
install_git_linux() {
    # ------------------------------------------------------------------------
    # Early Exit: Check if Git already installed and current
    # ------------------------------------------------------------------------
    if command -v git >/dev/null 2>&1; then
        GIT_VERSION=$(git --version | sed 's/git version //')
        MAJOR=$(echo "$GIT_VERSION" | sed 's/[^0-9.].*//g' | cut -d. -f1)
        MINOR=$(echo "$GIT_VERSION" | sed 's/[^0-9.].*//g' | cut -d. -f2)

        if [ "$MAJOR" -ge 2 ] && [ "$MINOR" -ge 30 ]; then
            # Git is already current (>= 2.30), skip installation
            return 0
        fi
    fi

    # ------------------------------------------------------------------------
    # Note: Sudo access already requested by parent install.sh
    # ------------------------------------------------------------------------

    # ------------------------------------------------------------------------
    # PACKAGE MANAGER 1: apt-get (Ubuntu/Debian)
    # ------------------------------------------------------------------------
    if command -v apt-get >/dev/null 2>&1; then
        # Everything in background to show spinner immediately
        (
            # Add git-core PPA if not already added (for latest Git version)
            if ! grep -q "^deb.*git-core/ppa" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
                # Add PPA non-interactively (no user prompts)
                sudo add-apt-repository -y ppa:git-core/ppa < /dev/null >/dev/null 2>&1
            fi

            # Update package lists and install Git
            sudo apt-get update -qq >/dev/null 2>&1
            sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git >/dev/null 2>&1
        ) &
        install_pid=$!

        # --------------------------------------------------------------------
        # Animated Spinner - Shows progress while apt-get works
        # --------------------------------------------------------------------
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
            printf "\r        ${VIOLET}◉${NC} Installing latest Git ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char" >&2
            i=$((i + 1))
            sleep 0.15  # 150ms per frame = ~6.6 FPS
        done

        # Wait for installation to complete
        wait $install_pid
        install_result=$?
        printf "\r\033[K" >&2  # Clear spinner line

        if [ $install_result -ne 0 ]; then
            log_error "Git installation failed"
            exit 1
        fi

    # ------------------------------------------------------------------------
    # PACKAGE MANAGER 2: yum (RHEL/CentOS)
    # ------------------------------------------------------------------------
    elif command -v yum >/dev/null 2>&1; then
        log_info "Using yum to install Git"

        # Install Git with yum
        sudo yum install -y git >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # PACKAGE MANAGER 3: dnf (Fedora)
    # ------------------------------------------------------------------------
    elif command -v dnf >/dev/null 2>&1; then
        log_info "Using dnf to install Git"

        # Install Git with dnf
        sudo dnf install -y git >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # PACKAGE MANAGER 4: pacman (Arch Linux)
    # ------------------------------------------------------------------------
    elif command -v pacman >/dev/null 2>&1; then
        log_info "Using pacman to install Git"

        # Install Git with pacman (--noconfirm = no user prompts)
        sudo pacman -S --noconfirm git >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # PACKAGE MANAGER 5: zypper (openSUSE)
    # ------------------------------------------------------------------------
    elif command -v zypper >/dev/null 2>&1; then
        log_info "Using zypper to install Git"

        # Install Git with zypper
        sudo zypper install -y git >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # PACKAGE MANAGER 6: apk (Alpine Linux)
    # ------------------------------------------------------------------------
    elif command -v apk >/dev/null 2>&1; then
        log_info "Using apk to install Git"

        # Install Git with apk (--no-cache = don't cache package index)
        sudo apk add --no-cache git >/dev/null 2>&1

    # ------------------------------------------------------------------------
    # No Supported Package Manager Found
    # ------------------------------------------------------------------------
    else
        log_error "No supported package manager found"
        log_error "Please install Git manually: https://git-scm.com/downloads"
        exit 1
    fi

    # ------------------------------------------------------------------------
    # Verify Installation Success
    # ------------------------------------------------------------------------
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
        log_info "Setting up Git identity (can be changed later)"
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
    printf "\n        ${BOLD}${PALEGREEN}🔧 Git Installation Setup${NC}\n" >&2
    printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n" >&2

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

    printf "\n        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n" >&2
    printf "        ${GREEN}✓${NC} ${BOLD}Git setup completed successfully!${NC}\n" >&2
    printf "        ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n\n" >&2

    # Output line count to stdout for install.sh
}

# Run main function
main "$@"
