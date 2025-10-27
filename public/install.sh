#!/bin/sh
# ============================================================================
# ============================================================================
#
#                    GraphDone Installation Script
#             Professional One-Command Setup for All Platforms
#
# ============================================================================
# ============================================================================
#
# 📖 DESCRIPTION
# ============================================================================
#   Automated installer for GraphDone - a graph-native project management
#   system that reimagines work coordination through dependencies and
#   democratic prioritization. Handles complete setup from dependency
#   installation to running services with beautiful CLI progress feedback.
#
#   Features:
#   • Zero-config installation (just one command!)
#   • Automatic dependency management (Git, Node.js, Docker)
#   • Cross-platform support (macOS + Linux)
#   • Beautiful animated CLI interface
#   • Smart retry logic for network issues
#   • HTTPS/TLS security out of the box
#   • Health checks for all services
#
# 🚀 QUICK START
# ============================================================================
#   # Option 1: Direct install with curl
#   curl -fsSL https://graphdone.com/install.sh | sh
#
#   # Option 2: Direct install with wget
#   wget -qO- https://graphdone.com/install.sh | sh
#
#   # Option 3: Download first, then run
#   wget https://graphdone.com/install.sh && sh install.sh
#
# 💻 SUPPORTED PLATFORMS
# ============================================================================
#   macOS:
#   ✓ macOS 10.15+ Catalina
#   ✓ macOS 11.x Big Sur
#   ✓ macOS 12.x Monterey
#   ✓ macOS 13.x Ventura
#   ✓ macOS 14.x Sonoma
#
#   Linux Distributions (15+):
#   ✓ Ubuntu 20.04+, 22.04+, 24.04+
#   ✓ Debian 10+, 11+, 12+
#   ✓ Fedora 38+, 39+, 40+
#   ✓ RHEL 8+, 9+
#   ✓ CentOS 8+, Stream 9
#   ✓ Rocky Linux 8+, 9+
#   ✓ AlmaLinux 8+, 9+
#   ✓ Linux Mint 20+, 21+
#   ✓ Pop!_OS 22.04+
#   ✓ Elementary OS 6+, 7+
#   ✓ Arch Linux (rolling)
#   ✓ Manjaro (rolling)
#   ✓ openSUSE Leap 15+, Tumbleweed
#
# 📋 INSTALLATION WORKFLOW (9 SECTIONS)
# ============================================================================
#   Section 1: Pre-flight Checks
#   └─ Network connectivity test
#   └─ Disk space validation (5GB minimum)
#   └─ Download speed test (CloudFlare CDN)
#   └─ Upload speed test (CloudFlare)
#
#   Section 2: System Information
#   └─ Platform detection (macOS/Linux)
#   └─ OS version and compatibility check
#   └─ Architecture detection (x86_64/arm64)
#   └─ Shell environment display
#
#   Section 3: Dependency Checks
#   └─ Git: Checks version, installs/upgrades if needed
#   └─ Node.js: Ensures 18+, installs via Homebrew (macOS) or nvm (Linux)
#   └─ Docker: Installs OrbStack (macOS) or Docker Engine (Linux)
#
#   Section 4: Code Installation
#   └─ Clones GraphDone repository from GitHub
#   └─ Installs npm dependencies with smart retry logic
#   └─ Handles package conflicts automatically
#
#   Section 5: Environment Configuration
#   └─ Creates .env file from template
#   └─ Configures Neo4j credentials
#   └─ Sets up Redis connection
#   └─ Configures API and Web URLs
#
#   Section 6: Security Initialization
#   └─ Generates self-signed TLS certificates
#   └─ Sets proper file permissions (600 for keys, 644 for certs)
#   └─ Enables HTTPS for API and Web
#
#   Section 7: Services Status
#   └─ Checks if containers are already running
#   └─ Validates container health status
#   └─ Tests Neo4j and Redis connectivity
#
#   Section 8: Container Cleanup
#   └─ Stops old containers gracefully
#   └─ Removes orphaned containers
#   └─ Cleans up Docker volumes
#
#   Section 9: Service Deployment
#   └─ Starts Neo4j database (port 7474, 7687)
#   └─ Starts Redis cache (port 6379)
#   └─ Starts GraphQL API (port 4128 HTTPS)
#   └─ Starts React Web App (port 3128 HTTPS)
#   └─ Waits for all services to be healthy (60s timeout)
#
# 🏗️ FILE STRUCTURE (7 MAJOR COMPONENTS)
# ============================================================================
#   Component 1: Helper Functions & Utilities (Lines 62-470)
#   ├─ Logging functions (log, ok, warn, error)
#   ├─ System validation (disk space, network)
#   ├─ Network speed tests (download/upload)
#   ├─ Dependency management (hash-based caching)
#   ├─ UI elements (spinners, progress bars)
#   └─ Platform detection (macOS/Linux)
#
#   Component 2: Git Installation (Lines 471-1075)
#   ├─ macOS: Homebrew installation
#   ├─ Linux: apt-get, dnf, yum support
#   └─ Version checking and upgrades
#
#   Component 3: Node.js Installation (Lines 1076-1750)
#   ├─ macOS: Homebrew installation (latest stable)
#   ├─ Linux: nvm installation (Node.js 22 LTS)
#   └─ npm version validation
#
#   Component 4: Docker Installation (Lines 1751-2280)
#   ├─ macOS: OrbStack via Homebrew
#   ├─ Linux: Snap (preferred), apt-get, dnf, yum
#   └─ Daemon startup and health checks
#
#   Component 5: Service Management (Lines 2281-2610)
#   ├─ Container health checks
#   ├─ Service wait logic (60s timeout)
#   ├─ Stop services command
#   └─ Remove services command (complete reset)
#
#   Component 6: Main Installation Orchestrator (Lines 2611-3600)
#   ├─ Animated banner display
#   ├─ Platform compatibility checks
#   ├─ Dependency installation workflow
#   ├─ Repository cloning
#   ├─ Docker Compose deployment
#   └─ Health verification
#
#   Component 7: Success UI & Command Handler (Lines 3601-3700)
#   ├─ Beautiful success message with URLs
#   ├─ Management commands display
#   └─ CLI argument processing (install/stop/remove)
#
# ⌨️  COMMAND REFERENCE
# ============================================================================
#   Install GraphDone:
#     sh install.sh
#     sh install.sh install
#
#   Stop all services:
#     sh install.sh stop
#
#   Complete cleanup (removes containers, volumes, images):
#     sh install.sh remove
#
# 📊 EXIT CODES
# ============================================================================
#   0  - Success (GraphDone installed and running)
#   1  - Failure (Installation failed - see error message)
#   130 - Interrupted (User pressed Ctrl+C)
#
# 📦 SYSTEM REQUIREMENTS
# ============================================================================
#   Disk Space:  5GB minimum free space
#   Memory:      4GB RAM minimum (8GB recommended)
#   Network:     Internet connection required
#   OS:          macOS 10.15+ or modern Linux distribution
#   Shell:       POSIX-compatible shell (sh, bash, zsh, dash)
#
# 🌐 AFTER INSTALLATION
# ============================================================================
#   Your GraphDone instance will be available at:
#
#   Web Application:
#     https://localhost:3128
#     (Main interface for managing work items and graph visualization)
#
#   GraphQL API:
#     https://localhost:4128/graphql
#     (Apollo GraphQL Playground for API exploration)
#
#   Neo4j Database Browser:
#     http://localhost:7474
#     Username: neo4j
#     Password: graphdone_password
#     (Cypher query interface for direct database access)
#
# 🔧 TROUBLESHOOTING
# ============================================================================
#   Installation logs are saved to:
#     ~/graphdone-logs/installation-YYYY-MM-DD_HH-MM-SS.log
#
#   Common issues:
#   • Port conflicts: Stop services using ports 3128, 4128, 7474, 7687, 6379
#   • Docker not starting: Ensure Docker Desktop or OrbStack is running
#   • Permission errors: Script requires sudo for system package installation
#   • Network errors: Check firewall settings and internet connectivity
#
# 📄 LICENSE & LINKS
# ============================================================================
#   Repository: https://github.com/GraphDone/GraphDone-Core
#   License:    MIT
#   Docs:       https://graphdone.com/docs
#   Issues:     https://github.com/GraphDone/GraphDone-Core/issues
#
# ============================================================================
# ============================================================================

set -e

# ############################################################################
# ############################################################################
# ##                                                                        ##
# ##              HELPER FUNCTIONS & UTILITIES COMPONENT                    ##
# ##                                                                        ##
# ############################################################################
# ############################################################################
#
# This section contains all utility functions used throughout the installer.
#
# Categories:
#   - Logging & Output: log(), ok(), warn(), error()
#   - System Checks: check_disk_space(), check_network()
#   - Network Tests: test_download_speed(), test_upload_speed()
#   - Dependencies: check_deps_fresh(), update_deps_hash()
#   - UI Elements: show_spinner(), spinner(), run_with_spinner()
#   - Platform Detection: detect_platform(), get_macos_name(), get_macos_info()
#   - Cleanup: cleanup(), run_setup_script()
#
# These functions provide the foundation for the installation process.
#
# ############################################################################

# Create logs directory in home
LOG_DIR="$HOME/graphdone-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Professional log file naming with timestamp
INSTALL_TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
INSTALL_LOG="$LOG_DIR/installation-${INSTALL_TIMESTAMP}.log"

# Temporary files for cleanup
TEMP_FILES=""
CLEANUP_NEEDED=false

# Cleanup function for graceful exit
cleanup() {
    if [ "$CLEANUP_NEEDED" = true ]; then
        printf "\n${YELLOW}Cleaning up...${NC}\n"

        # Clean temp files
        for temp_file in $TEMP_FILES; do
            if [ -f "$temp_file" ]; then
                rm -f "$temp_file" 2>/dev/null || true
            fi
        done

        # Clean npm temp logs
        rm -f /tmp/npm-error.log /tmp/npm-debug.log 2>/dev/null || true

        printf "${GREEN}✓ Cleanup complete${NC}\n"
    fi
}

# Trap handlers for graceful exit
trap 'cleanup; exit 130' INT TERM
trap 'cleanup' EXIT

# GitHub repository details
GITHUB_REPO="GraphDone/GraphDone-Core"
GITHUB_BRANCH="fix/first-start"

# Helper function to run setup scripts (local or download from GitHub)
run_setup_script() {
    local script_name="$1"
    shift
    local script_args="$@"

    # Check if script exists locally
    if [ -f "scripts/$script_name" ]; then
        # Run local script
        sh "scripts/$script_name" $script_args
    else
        # Download from GitHub and run
        local github_url="https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/scripts/${script_name}"
        local temp_script="/tmp/${script_name}.$$"

        if command -v curl >/dev/null 2>&1; then
            curl -fsSL "$github_url" -o "$temp_script" 2>/dev/null || return 1
        elif command -v wget >/dev/null 2>&1; then
            wget -q "$github_url" -O "$temp_script" 2>/dev/null || return 1
        else
            return 1
        fi

        # Add to cleanup list
        TEMP_FILES="$TEMP_FILES $temp_script"
        CLEANUP_NEEDED=true

        # Run downloaded script
        sh "$temp_script" $script_args
        local result=$?

        # Clean up temp script
        rm -f "$temp_script" 2>/dev/null || true

        return $result
    fi
}

# Modern color palette using 256-color codes for better compatibility
# Check stderr (fd 2) instead of stdout since we output to >&2
if [ -t 2 ]; then
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        # 256-color mode
        CYAN='\033[38;5;51m'
        GREEN='\033[38;5;154m'
        YELLOW='\033[38;5;220m'
        PURPLE='\033[38;5;135m'
        BLUE='\033[38;5;33m'
        GRAY='\033[38;5;244m'
        RED='\033[38;5;196m'
        CADETBLUE='\033[38;5;73m'
        DARKSEAGREEN='\033[38;5;108m'
    else
        # Fallback to basic ANSI
        CYAN='\033[0;36m'
        GREEN='\033[38;5;154m'
        YELLOW='\033[0;33m'
        PURPLE='\033[0;35m'
        BLUE='\033[0;34m'
        GRAY='\033[0;90m'
        RED='\033[0;31m'
        CADETBLUE='\033[0;36m'
        DARKSEAGREEN='\033[0;32m'
    fi
    BOLD='\033[1m'
    DIM='\033[2m'
    NC='\033[0m'
else
    CYAN='' GREEN='' YELLOW='' PURPLE='' BLUE='' GRAY='' RED='' CADETBLUE='' DARKSEAGREEN='' BOLD='' DIM='' NC=''
fi

# Clean, minimal functions
log() { printf "${GRAY}▸${NC} %s\n" "$1"; }
ok() { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
error() {
    printf "${RED}✗${NC} %s\n" "$1" >&2
    CLEANUP_NEEDED=true
    cleanup
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────
# SYSTEM VALIDATION FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────

# Check disk space (requires at least 5GB free)
check_disk_space() {
    local required_gb=5
    local available_gb=0

    if command -v df >/dev/null 2>&1; then
        # Get available space in GB (cross-platform)
        if [ "$(uname)" = "Darwin" ]; then
            # macOS: df shows 512-byte blocks by default
            available_gb=$(df -g . 2>/dev/null | awk 'NR==2 {print int($4)}' || echo "0")
        else
            # Linux: use -BG for gigabytes
            available_gb=$(df -BG . 2>/dev/null | awk 'NR==2 {gsub(/G/,"",$4); print int($4)}' || echo "0")
        fi

        if [ "$available_gb" -lt "$required_gb" ]; then
            warn "Low disk space: ${available_gb}GB available (${required_gb}GB recommended)"
            printf "${CYAN}ℹ${NC} Continue anyway? ${GRAY}[y/N]${NC} "
            read -r response || response="n"
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                error "Installation cancelled due to low disk space"
            fi
        fi
    fi
}

# Check network connectivity
check_network() {
    local test_url="https://github.com"

    if command -v curl >/dev/null 2>&1; then
        if ! curl -sf --max-time 5 "$test_url" >/dev/null 2>&1; then
            warn "Network connectivity test failed"
            printf "${CYAN}ℹ${NC} This may cause download failures. Continue? ${GRAY}[y/N]${NC} "
            read -r response || response="n"
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                error "Installation cancelled - network required"
            fi
        fi
    elif command -v wget >/dev/null 2>&1; then
        if ! wget -q --timeout=5 --spider "$test_url" 2>/dev/null; then
            warn "Network connectivity test failed"
            printf "${CYAN}ℹ${NC} This may cause download failures. Continue? ${GRAY}[y/N]${NC} "
            read -r response || response="n"
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                error "Installation cancelled - network required"
            fi
        fi
    fi
}

# ─────────────────────────────────────────────────────────────────────────
# NETWORK SPEED TEST FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────

# Test download speed using CloudFlare's speed test
test_download_speed() {
    if ! command -v curl >/dev/null 2>&1; then
        echo "N/A"
        return
    fi

    # Download 10MB file from CloudFlare CDN and measure speed
    local speed_bytes=$(curl -o /dev/null -s -w '%{speed_download}' --max-time 8 \
        "https://speed.cloudflare.com/__down?bytes=10000000" 2>/dev/null)

    if [ -n "$speed_bytes" ] && [ "$speed_bytes" != "0" ] && [ "$speed_bytes" != "0.000" ]; then
        # Convert bytes/sec to Mbps
        local speed_mbps=$(awk "BEGIN {printf \"%.1f\", $speed_bytes * 8 / 1000000}")
        if [ "$speed_mbps" != "0.0" ]; then
            echo "${speed_mbps}"
        else
            echo "N/A"
        fi
    else
        echo "N/A"
    fi
}

# Test upload speed using CloudFlare's speed test
test_upload_speed() {
    if ! command -v curl >/dev/null 2>&1; then
        echo "N/A"
        return
    fi

    # Upload 5MB of data to CloudFlare and measure speed
    local speed_bytes=$(dd if=/dev/zero bs=1024 count=5120 2>/dev/null | \
        curl -o /dev/null -s -w '%{speed_upload}' --max-time 8 \
        -X POST --data-binary @- "https://speed.cloudflare.com/__up" 2>/dev/null)

    if [ -n "$speed_bytes" ] && [ "$speed_bytes" != "0" ] && [ "$speed_bytes" != "0.000" ]; then
        # Convert bytes/sec to Mbps
        local speed_mbps=$(awk "BEGIN {printf \"%.1f\", $speed_bytes * 8 / 1000000}")
        if [ "$speed_mbps" != "0.0" ]; then
            echo "${speed_mbps}"
        else
            echo "N/A"
        fi
    else
        echo "N/A"
    fi
}

# ─────────────────────────────────────────────────────────────────────────
# DEPENDENCY MANAGEMENT FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────

# Cache configuration
CACHE_DIR=".graphdone-cache"

# Check if dependencies are fresh by comparing package.json hashes
check_deps_fresh() {
    mkdir -p "$CACHE_DIR"
    local deps_hash_file="$CACHE_DIR/deps-hash"

    if [ ! -f "$deps_hash_file" ]; then
        return 1
    fi

    # Generate hash of all package.json files (cross-platform)
    local current_hash
    if command -v md5sum >/dev/null 2>&1; then
        # Linux
        current_hash=$(find . -name "package.json" -type f -exec md5sum {} \; 2>/dev/null | md5sum | cut -d' ' -f1)
    elif command -v md5 >/dev/null 2>&1; then
        # macOS - use -q for quiet mode (raw hash output only)
        current_hash=$(find . -name "package.json" -type f -exec md5 -q {} \; 2>/dev/null | sort | md5 -q)
    else
        # Fallback - use file modification times with OS-specific stat
        if [ "$(uname)" = "Darwin" ]; then
            # macOS stat format
            current_hash=$(find . -name "package.json" -type f -exec stat -f %m {} \; 2>/dev/null | sort | md5 -q 2>/dev/null || echo "fallback")
        else
            # Linux stat format
            current_hash=$(find . -name "package.json" -type f -exec stat -c %Y {} \; 2>/dev/null | sort | md5sum | cut -d' ' -f1 2>/dev/null || echo "fallback")
        fi
    fi
    local cached_hash=$(cat "$deps_hash_file" 2>/dev/null || echo "")

    if [ "$current_hash" = "$cached_hash" ]; then
        return 0
    fi
    return 1
}

# Update dependency hash after successful install
update_deps_hash() {
    mkdir -p "$CACHE_DIR"
    # Cross-platform hash generation
    if command -v md5sum >/dev/null 2>&1; then
        # Linux
        find . -name "package.json" -type f -exec md5sum {} \; 2>/dev/null | md5sum | cut -d' ' -f1 > "$CACHE_DIR/deps-hash"
    elif command -v md5 >/dev/null 2>&1; then
        # macOS - use -q for quiet mode (raw hash output only)
        find . -name "package.json" -type f -exec md5 -q {} \; 2>/dev/null | sort | md5 -q > "$CACHE_DIR/deps-hash"
    else
        # Fallback
        echo "fallback" > "$CACHE_DIR/deps-hash"
    fi
}


# ─────────────────────────────────────────────────────────────────────────
# UI & SPINNER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────

# Fancy dots spinner function for installation steps
show_spinner() {
    pid=$1
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    i=0

    while kill -0 $pid 2>/dev/null; do
        printf " ${YELLOW}.${NC}"
        i=$(( (i+1) % 10 ))
        sleep 0.1
        printf "\b\b\b"
    done

    wait $pid
    return $?
}

# Spinner function with progress
spinner() {
    pid=$1
    message=$2
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    i=0

    printf "${GRAY}▸${NC} %s " "$message"
    while kill -0 $pid 2>/dev/null; do
        printf "\r${GRAY}▸${NC} %s ${YELLOW}.${NC}" "$message"
        i=$(( (i+1) % 10 ))
        sleep 0.1
    done

    wait $pid
    exit_code=$?

    # Clear the line completely and rewrite without spinner
    printf "\r\033[K"  # Clear entire line
    if [ $exit_code -eq 0 ]; then
        printf "${GREEN}✓${NC} %s\n" "$message"
    else
        printf "${RED}✗${NC} %s\n" "$message"
    fi

    return $exit_code
}

# Run command with spinner
run_with_spinner() {
    message=$1
    shift

    # Run command in background
    "$@" >/dev/null 2>&1 &
    pid=$!

    # Show spinner
    spinner $pid "$message"
    return $?
}

# ─────────────────────────────────────────────────────────────────────────
# PLATFORM DETECTION FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────

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

# Get macOS version name from version number
get_macos_name() {
    local version="$1"
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)

    case "$major" in
        15) echo "Sequoia" ;;
        14) echo "Sonoma" ;;
        13) echo "Ventura" ;;
        12) echo "Monterey" ;;
        11) echo "Big Sur" ;;
        10)
            case "$minor" in
                15) echo "Catalina" ;;
                14) echo "Mojave" ;;
                13) echo "High Sierra" ;;
                12) echo "Sierra" ;;
                11) echo "El Capitan" ;;
                10) echo "Yosemite" ;;
                *) echo "" ;;
            esac
            ;;
        *) echo "" ;;
    esac
}

# Get macOS version and compatibility status
get_macos_info() {
    if [ "$PLATFORM" = "macos" ]; then
        MACOS_VERSION=$(sw_vers -productVersion 2>/dev/null)
        if [ -z "$MACOS_VERSION" ]; then
            MACOS_VERSION="unknown"
            MACOS_NAME=""
            MACOS_COMPATIBLE="unknown"
            return 0
        fi

        # Get the macOS codename
        MACOS_NAME=$(get_macos_name "$MACOS_VERSION")

        local major=$(echo "$MACOS_VERSION" | cut -d. -f1)
        local minor=$(echo "$MACOS_VERSION" | cut -d. -f2)

        # DISABLED: Docker Desktop system requirement check
        # # Docker Desktop requires macOS 10.15 (Catalina) or later
        # macOS 11+ uses single version number (Big Sur onwards)
        if [ "$major" -ge 11 ]; then
            # macOS 11 Big Sur or later - fully supported
            MACOS_COMPATIBLE="yes"
        elif [ "$major" -eq 10 ] && [ "$minor" -ge 15 ]; then
            # macOS 10.15 Catalina or later - supported
            MACOS_COMPATIBLE="yes"
        else
            # macOS older than 10.15
            MACOS_COMPATIBLE="no"
        fi
    fi
}

# ############################################################################
# ############################################################################
# ##                                                                        ##
# ##                     GIT INSTALLATION COMPONENT                         ##
# ##                                                                        ##
# ############################################################################
# ############################################################################
#
# This section handles Git installation and upgrades for both macOS and Linux.
#
# Components:
#   - macOS Git installation (check_and_prompt_git_macos)
#   - Linux Git installation (check_and_prompt_git_linux)
#   - Unified dispatcher (check_and_prompt_git)
#
# Supported platforms:
#   macOS:  Homebrew installation (latest Git)
#   Linux:  apt-get (Ubuntu/Debian), dnf (Fedora), yum (RHEL/CentOS)
#
# ############################################################################

# ============================================================================
# GIT INSTALLATION CHECK - All Cases (macOS)
# ============================================================================
# Detects Git status and automatically installs/upgrades as needed.
#
# CASE 1: Current Git (>= 2.45)
#   - Condition: Git installed AND version >= 2.45
#   - Action: Skip installation (already current)
#   - Example: "git version 2.51.1"
#
# CASE 2: Apple Git (macOS bundled)
#   - Condition: Git installed AND version contains "Apple Git"
#   - Action: Auto-upgrade to Homebrew Git (no prompt)
#   - Example: "git version 2.39.3 (Apple Git-146)"
#   - When: Fresh macOS with Xcode Command Line Tools
#
# CASE 3: Outdated Git (< 2.45)
#   - Condition: Git installed AND version < 2.45 AND NOT Apple Git
#   - Action: Auto-upgrade to latest (no prompt)
#   - Example: "git version 2.30.0" or "git version 1.9.5"
#   - When: Old Homebrew/apt installation not updated
#
# CASE 4: Missing Git
#   - Condition: Git not installed
#   - Action: Auto-install latest (no prompt)
#   - When: Fresh system or Git never installed
#
# Decision Flow:
#   Git installed?
#     NO  → CASE 4 (Missing)
#     YES → Contains "Apple Git"?
#             YES → CASE 2 (Apple Git)
#             NO  → Version >= 2.45?
#                     YES → CASE 1 (Current)
#                     NO  → CASE 3 (Outdated)
#
# All cases log to: $HOME/graphdone-logs/git-setup-YYYY-MM-DD_HH-MM-SS.log
# ============================================================================

# ============================================================================
# GIT INSTALLATION CHECK - All Cases (Linux)
# ============================================================================
# Detects Git status and automatically installs/upgrades as needed on Linux.
#
# CASE 1: Current Git (>= 2.30)
#   - Condition: Git installed AND version >= 2.30
#   - Action: Skip installation (already current)
#   - Example: "git version 2.34.1"
#   - Note: Linux uses 2.30 as minimum (vs 2.45 for macOS) for compatibility
#
# CASE 2: Outdated Git (< 2.30)
#   - Condition: Git installed AND version < 2.30
#   - Action: Auto-upgrade to latest (no prompt)
#   - Example: "git version 1.8.3.1" (CentOS 7 default)
#   - When: Old system package not updated
#
# CASE 3: Missing Git
#   - Condition: Git not installed
#   - Action: Auto-install latest (no prompt)
#   - When: Fresh system or minimal installation
#
# Decision Flow:
#   Git installed?
#     NO  → CASE 3 (Missing)
#     YES → Version >= 2.30?
#             YES → CASE 1 (Current)
#             NO  → CASE 2 (Outdated)
#
# Package Manager Detection (in order of checking):
#   1. apt-get (Ubuntu/Debian)
#      - Adds git-core PPA for latest version
#      - Command: sudo add-apt-repository -y ppa:git-core/ppa
#      - Then: sudo apt-get update && sudo apt-get install -y git
#      - Version: Latest stable (e.g., 2.43.0)
#
#   2. yum (RHEL/CentOS)
#      - Command: sudo yum install -y git
#      - Version: Distribution-provided (may be older)
#
#   3. dnf (Fedora)
#      - Command: sudo dnf install -y git
#      - Version: Latest in Fedora repos
#
#   4. pacman (Arch Linux)
#      - Command: sudo pacman -S --noconfirm git
#      - Version: Latest stable (Arch rolling release)
#
#   5. zypper (openSUSE)
#      - Command: sudo zypper install -y git
#      - Version: Distribution-provided
#
#   6. apk (Alpine Linux)
#      - Command: sudo apk add --no-cache git
#      - Version: Latest in Alpine repos
#
# Features:
#   - Fully automated, no user prompts
#   - Animated spinner shows progress
#   - Version verification after installation
#   - Logs to: $HOME/graphdone-logs/git-setup-YYYY-MM-DD_HH-MM-SS.log
#
# Exit codes from setup_git.sh:
#   0 - Success (Git installed/upgraded or already current)
#   1 - Failure (No supported package manager or installation failed)
# ============================================================================

# ============================================================================
# MACOS GIT CHECK FUNCTION - check_and_prompt_git_macos()
# ============================================================================
check_and_prompt_git_macos() {
    # Add pink color for the circle
    PINK='\033[38;5;213m'

    # Pink blinking circle during entire checking process
    blink_state=0

    # Continue blinking and adding dots until check is complete
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"
            # Perform the check on final cycle - check if Git is installed
            if command -v git >/dev/null 2>&1; then
                GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
                # Check if it's Apple Git (usually outdated)
                if echo "$GIT_VERSION" | grep -q "Apple Git"; then
                    check_result="apple_git"  # Apple's bundled Git - suggest upgrade
                else
                    # Check if version is recent (2.45+)
                    MAJOR=$(echo "$GIT_VERSION" | cut -d. -f1)
                    MINOR=$(echo "$GIT_VERSION" | cut -d. -f2)
                    if [ "$MAJOR" -ge 2 ] && [ "$MINOR" -ge 45 ]; then
                        check_result="current"  # Git is current
                    else
                        check_result="outdated"  # Git is outdated
                    fi
                fi
            else
                check_result="missing"  # Git not installed
            fi
        fi

        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking Git installation${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4
    done

    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3

    # ========================================================================
    # CASE 1: Current Git (>= 2.45) - Already installed, skip installation
    # ========================================================================
    if [ "$check_result" = "current" ]; then
        # Get full version info
        GIT_VERSION_FULL=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")

        # Format the line to match last box alignment
        printf "\r  ${GREEN}✓${NC} ${BOLD}Git${NC} ${GREEN}${GIT_VERSION_FULL}${NC} ${GRAY}already installed${NC}\033[K\n"
        return 0

    # ========================================================================
    # CASE 2: Apple Git - Auto-upgrade to Homebrew Git (no prompt)
    # ========================================================================
    elif [ "$check_result" = "apple_git" ]; then

        GIT_VERSION_OLD=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
        # Try to fetch latest version from Homebrew (macOS only)
        LATEST_GIT_VERSION=""
        if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
            LATEST_GIT_VERSION=$(brew info git 2>/dev/null | head -n 1 | sed 's/.*stable \([0-9.]*\).*/\1/' || echo "")
        fi

        # Run setup script silently, log to temp file
        local log_file="$LOG_DIR/git-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_git.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while installing
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            if [ -n "$LATEST_GIT_VERSION" ]; then
                printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${YELLOW}${GIT_VERSION_OLD}${NC} ${GRAY}outdated, upgrading to ${GREEN}${LATEST_GIT_VERSION}${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            else
                printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${YELLOW}${GIT_VERSION_OLD}${NC} ${GRAY}outdated, upgrading${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            fi
            i=$((i + 1))
            sleep 0.15
        done

        # Get result
        wait $setup_pid
        local result=$?

        # Clear line and show result
        printf "\r\033[K"

        if [ $result -eq 0 ]; then
            # Log saved to: $log_file
            NEW_GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
            printf "  ${GREEN}✓${NC} ${BOLD}Git${NC} upgraded to ${GREEN}${NEW_GIT_VERSION}${NC} successfully\n"
        else
            printf "${RED}✗${NC} Git setup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
                # Log saved to: $log_file
            fi
            printf "${CYAN}ℹ${NC} Continuing with Apple Git\n"
        fi
        return 0

    # ========================================================================
    # CASE 3: Outdated Git (< 2.45) - Auto-upgrade to latest (no prompt)
    # ========================================================================
    elif [ "$check_result" = "outdated" ]; then

        GIT_VERSION_OLD=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
        # Try to fetch latest version from Homebrew (macOS only)
        LATEST_GIT_VERSION=""
        if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
            LATEST_GIT_VERSION=$(brew info git 2>/dev/null | head -n 1 | sed 's/.*stable \([0-9.]*\).*/\1/' || echo "")
        fi

        # Run setup script silently, log to temp file
        local log_file="$LOG_DIR/git-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_git.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while installing
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            if [ -n "$LATEST_GIT_VERSION" ]; then
                printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${YELLOW}${GIT_VERSION_OLD}${NC} ${GRAY}outdated, upgrading to ${GREEN}${LATEST_GIT_VERSION}${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            else
                printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${YELLOW}${GIT_VERSION_OLD}${NC} ${GRAY}outdated, upgrading${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            fi
            i=$((i + 1))
            sleep 0.15
        done

        # Get result
        wait $setup_pid
        local result=$?

        # Clear line and show result
        printf "\r\033[K"

        if [ $result -eq 0 ]; then
            # Log saved to: $log_file
            NEW_GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
            printf "  ${GREEN}✓${NC} ${BOLD}Git${NC} upgraded to ${GREEN}${NEW_GIT_VERSION}${NC} successfully\n"
        else
            printf "${RED}✗${NC} Git setup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
                # Log saved to: $log_file
            fi
            exit 1
        fi
        return 0
    fi

    # ========================================================================
    # CASE 4: Missing Git - Auto-install latest version (no prompt)
    # ========================================================================
    # Fetch latest version from Homebrew (macOS only)
    LATEST_GIT_VERSION=""
    if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
        LATEST_GIT_VERSION=$(brew info git 2>/dev/null | head -n 1 | sed 's/.*stable \([0-9.]*\).*/\1/' || echo "")
    fi

    # Run setup script silently, log to temp file
    local log_file="$LOG_DIR/git-setup-${INSTALL_TIMESTAMP}.log"
    run_setup_script "setup_git.sh" --skip-check >"$log_file" 2>&1 &
    local setup_pid=$!

    # Spinner while installing
    local i=0
    local spin_char=""
    while kill -0 $setup_pid 2>/dev/null; do
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
        if [ -n "$LATEST_GIT_VERSION" ]; then
            printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${GRAY}not installed, installing ${GREEN}${LATEST_GIT_VERSION}${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
        else
            printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${GRAY}not installed, installing latest version${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
        fi
        i=$((i + 1))
        sleep 0.15
    done

    # Get result
    wait $setup_pid
    local result=$?

    # Clear line and show result
    printf "\r\033[K"

    if [ $result -eq 0 ]; then
        # Log saved to: $log_file
        NEW_GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
        printf "  ${GREEN}✓${NC} ${BOLD}Git${NC} ${GREEN}${NEW_GIT_VERSION}${NC} installed successfully\n"
    else
        printf "${RED}✗${NC} Git setup failed\n"
        if [ -f "$log_file" ]; then
            printf "\n${BOLD}Last 15 lines from log:${NC}\n"
            tail -15 "$log_file"
            # Log saved to: $log_file
        fi
        exit 1
    fi

    return 0
}

# ============================================================================
# LINUX SUDO REQUEST - request_sudo_linux()
# ============================================================================
# Smart sudo management that works everywhere:
# - Checks if sudo already cached (no prompt needed)
# - Only prompts if necessary
# - Works with curl/wget pipes AND local execution
# ============================================================================
request_sudo_linux() {
    # Check if we're on Linux
    if [ "$(uname)" != "Linux" ]; then
        return 0
    fi

    # First, silently check if we already have sudo access
    if sudo -n true 2>/dev/null; then
        # Already have sudo - no prompt needed!
        # Keep sudo alive in background
        (while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null) &
        SUDO_KEEPER_PID=$!
        trap 'sudo -k; kill $SUDO_KEEPER_PID 2>/dev/null' EXIT
        return 0
    fi

    # Need to authenticate - check if we can prompt
    if [ -t 0 ]; then
        # Interactive terminal - can prompt normally
        printf "  ${VIOLET}◉${NC} Requesting administrative privileges for installations\r"
        if ! sudo -p "  Password: " -v </dev/tty 2>&1; then
            printf "\n  ${RED}✗${NC} Failed to obtain sudo privileges\n"
            return 1
        fi
        # Clear line and replace with success message
        printf "\r\033[K  ${GREEN}✓${NC} Administrative access granted\n\n"
    else
        # Piped from curl/wget - try to reconnect to terminal
        if [ -c /dev/tty ]; then
            exec < /dev/tty
            printf "  ${VIOLET}◉${NC} Requesting administrative privileges for installations\r"
            if ! sudo -p "  Password: " -v 2>&1; then
                printf "\n  ${RED}✗${NC} Failed to obtain sudo privileges\n"
                return 1
            fi
            # Clear line and replace with success message
            printf "\r\033[K  ${GREEN}✓${NC} Administrative access granted\n\n"
        else
            # No terminal available - continue without upfront sudo
            # Each command will prompt individually
            return 0
        fi
    fi

    # Keep sudo alive in background
    (while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null) &
    SUDO_KEEPER_PID=$!
    trap 'sudo -k; kill $SUDO_KEEPER_PID 2>/dev/null' EXIT
    
    return 0
}

# ============================================================================
# LINUX GIT CHECK FUNCTION - check_and_prompt_git_linux()
# ============================================================================
check_and_prompt_git_linux() {
    # Add pink color for the circle
    PINK='\033[38;5;213m'

    # Pink blinking circle during entire checking process
    blink_state=0

    # Continue blinking and adding dots until check is complete
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"

            # ============================================================
            # LINUX VERSION CHECK: Git version detection
            # ============================================================
            # Check if Git is installed
            if command -v git >/dev/null 2>&1; then
                GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")

                # Linux: Check if version >= 2.45 (same threshold as macOS for consistency)
                # Note: setup_git.sh uses 2.30 internally, but unified check uses 2.45
                MAJOR=$(echo "$GIT_VERSION" | sed 's/[^0-9.].*//g' | cut -d. -f1)
                MINOR=$(echo "$GIT_VERSION" | sed 's/[^0-9.].*//g' | cut -d. -f2)

                if [ "$MAJOR" -ge 2 ] && [ "$MINOR" -ge 45 ]; then
                    check_result="current"  # LINUX CASE 1: Git >= 2.45 (current)
                else
                    check_result="outdated"  # LINUX CASE 2: Git < 2.45 (outdated)
                fi
            else
                check_result="missing"  # LINUX CASE 3: Git not installed
            fi
        fi

        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking Git installation${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4
    done

    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3

    # ========================================================================
    # LINUX CASE 1: Current Git (>= 2.45) - Already installed, skip
    # ========================================================================
    if [ "$check_result" = "current" ]; then
        # Get full version info
        GIT_VERSION_FULL=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")

        # Format the line to match box alignment
        printf "\r  ${GREEN}✓${NC} ${BOLD}Git${NC} ${GREEN}${GIT_VERSION_FULL}${NC} ${GRAY}already installed${NC}\033[K\n"
        return 0

    # ========================================================================
    # LINUX CASE 2: Outdated Git (< 2.45) - Auto-upgrade (no prompt)
    # ========================================================================
    elif [ "$check_result" = "outdated" ]; then
        GIT_VERSION_OLD=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")

        # Run setup script silently, log to temp file
        # setup_git.sh will detect package manager automatically:
        #   - apt-get (Ubuntu/Debian) - adds git-core PPA for latest
        #   - yum (RHEL/CentOS)
        #   - dnf (Fedora)
        #   - pacman (Arch Linux)
        #   - zypper (openSUSE)
        #   - apk (Alpine Linux)
        local log_file="$LOG_DIR/git-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_git.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while installing via package manager
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${YELLOW}${GIT_VERSION_OLD}${NC} ${GRAY}outdated, upgrading${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        # Get result from setup_git.sh
        wait $setup_pid
        local result=$?

        # Clear line and show result
        printf "\r\033[K"

        if [ $result -eq 0 ]; then
            # Log saved to: $log_file
            NEW_GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
            printf "  ${GREEN}✓${NC} ${BOLD}Git${NC} upgraded to ${GREEN}${NEW_GIT_VERSION}${NC} successfully\n"
        else
            printf "${RED}✗${NC} Git setup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
            fi
            exit 1
        fi
        return 0
    fi

    # ========================================================================
    # LINUX CASE 3: Missing Git - Auto-install latest version (no prompt)
    # ========================================================================
    # Run setup script silently, log to temp file
    # setup_git.sh will detect and use appropriate package manager:
    #   1. apt-get (Ubuntu/Debian) - adds git-core PPA for latest
    #   2. yum (RHEL/CentOS)
    #   3. dnf (Fedora)
    #   4. pacman (Arch Linux)
    #   5. zypper (openSUSE)
    #   6. apk (Alpine Linux)
    local log_file="$LOG_DIR/git-setup-${INSTALL_TIMESTAMP}.log"
    run_setup_script "setup_git.sh" --skip-check >"$log_file" 2>&1 &
    local setup_pid=$!

    # Spinner while installing via package manager
    local i=0
    local spin_char=""
    while kill -0 $setup_pid 2>/dev/null; do
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
        printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${GRAY}not installed, installing latest version${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
        i=$((i + 1))
        sleep 0.15
    done

    # Get result from setup_git.sh
    wait $setup_pid
    local result=$?

    # Clear line and show result
    printf "\r\033[K"

    if [ $result -eq 0 ]; then
        # Log saved to: $log_file
        NEW_GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
        printf "  ${GREEN}✓${NC} ${BOLD}Git${NC} ${GREEN}${NEW_GIT_VERSION}${NC} installed successfully\n"
    else
        printf "${RED}✗${NC} Git setup failed\n"
        if [ -f "$log_file" ]; then
            printf "\n${BOLD}Last 15 lines from log:${NC}\n"
            tail -15 "$log_file"
        fi
        exit 1
    fi

    return 0
}

# ============================================================================
# UNIFIED GIT CHECK - Delegates to platform-specific function
# ============================================================================
check_and_prompt_git() {
    if [ "$(uname)" = "Darwin" ]; then
        check_and_prompt_git_macos
    else
        check_and_prompt_git_linux
    fi
}


# ############################################################################
# ############################################################################
# ##                                                                        ##
# ##                   NODE.JS INSTALLATION COMPONENT                       ##
# ##                                                                        ##
# ############################################################################
# ############################################################################
#
# This section handles Node.js and npm installation/upgrades for both macOS
# and Linux.
#
# Components:
#   - macOS Node.js installation (check_and_prompt_nodejs_macos)
#   - Linux Node.js installation (check_and_prompt_nodejs_linux)
#   - Unified dispatcher (check_and_prompt_nodejs)
#
# Supported platforms:
#   macOS:  Homebrew installation (latest Node.js + npm)
#   Linux:  nvm (Node Version Manager) - Node.js 22 LTS
#
# ############################################################################

# ============================================================================
# NODE.JS INSTALLATION CHECK - All Cases (macOS)
# ============================================================================
# Detects Node.js status and automatically installs/upgrades as needed.
#
# CASE 1: Current Node.js (>= 18) + npm (>= 9)
#   - Condition: Node.js >= 18 AND npm >= 9
#   - Action: Skip installation (already current)
#   - Example: "Node.js v22.11.0 and npm 10.9.0"
#
# CASE 2: Current Node.js (>= 18) but outdated/missing npm
#   - Condition: Node.js >= 18 AND (npm < 9 OR npm missing)
#   - Action: Update npm via setup_nodejs.sh (no prompt)
#   - Example: "Node.js v20.0.0 OK, but npm needs update"
#   - When: npm was corrupted or manually removed
#
# CASE 3: Outdated Node.js (< 18)
#   - Condition: Node.js installed AND version < 18
#   - Action: Upgrade to latest LTS (no prompt)
#   - Example: "Node.js v16.20.0 outdated (need >= 18.0.0)"
#   - When: Old Homebrew installation not updated
#
# CASE 4: Missing Node.js
#   - Condition: Node.js not installed
#   - Action: Auto-install latest LTS (no prompt)
#   - When: Fresh system or Node.js never installed
#
# Decision Flow:
#   Node.js installed?
#     NO  → CASE 4 (Missing)
#     YES → Version >= 18?
#             NO  → CASE 3 (Outdated)
#             YES → npm >= 9?
#                     YES → CASE 1 (Current)
#                     NO  → CASE 2 (npm outdated/missing)
#
# macOS Installation Method:
#   - Uses Homebrew: brew install node
#   - Installs both Node.js and npm together
#   - Version: Latest stable (e.g., 22.11.0)
#   - Benefits: Always up-to-date, easy to maintain
#
# All cases log to: $HOME/graphdone-logs/nodejs-setup-YYYY-MM-DD_HH-MM-SS.log
# ============================================================================

# ============================================================================
# NODE.JS INSTALLATION CHECK - All Cases (Linux)
# ============================================================================
# Detects Node.js status and automatically installs/upgrades as needed on Linux.
#
# CASE 1: Current Node.js (>= 18) + npm (>= 9)
#   - Condition: Node.js >= 18 AND npm >= 9
#   - Action: Skip installation (already current)
#   - Example: "Node.js v22.11.0 and npm 10.9.0"
#
# CASE 2: Current Node.js (>= 18) but outdated/missing npm
#   - Condition: Node.js >= 18 AND (npm < 9 OR npm missing)
#   - Action: Update npm via setup_nodejs.sh (no prompt)
#   - Example: "Node.js v20.0.0 OK, but npm needs update"
#   - When: npm was corrupted or manually removed
#
# CASE 3: Outdated Node.js (< 18)
#   - Condition: Node.js installed AND version < 18
#   - Action: Upgrade to latest LTS (no prompt)
#   - Example: "Node.js v14.21.3 outdated (need >= 18.0.0)"
#   - When: Old system package not updated
#
# CASE 4: Missing Node.js
#   - Condition: Node.js not installed
#   - Action: Auto-install latest LTS (no prompt)
#   - When: Fresh system or minimal installation
#
# Decision Flow:
#   Node.js installed?
#     NO  → CASE 4 (Missing)
#     YES → Version >= 18?
#             NO  → CASE 3 (Outdated)
#             YES → npm >= 9?
#                     YES → CASE 1 (Current)
#                     NO  → CASE 2 (npm outdated/missing)
#
# Linux Installation Method:
#   - Uses nvm (Node Version Manager)
#   - Command: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
#   - Then: nvm install 22 (LTS version)
#   - Version: Node.js 22 LTS + npm 10.x
#   - Benefits: No sudo required, user-level installation, multiple versions support
#   - Location: $HOME/.nvm/
#
# Features:
#   - Fully automated installation
#   - NO user prompts for any case (auto-install/upgrade)
#   - Animated spinner shows progress
#   - Version verification after installation
#   - Logs to: $HOME/graphdone-logs/nodejs-setup-YYYY-MM-DD_HH-MM-SS.log
#
# Exit codes from setup_nodejs.sh:
#   0 - Success (Node.js installed/upgraded or already current)
#   1 - Failure (Installation failed or unsupported platform)
# ============================================================================

# ============================================================================
# MACOS NODE.JS CHECK FUNCTION - check_and_prompt_nodejs_macos()
# ============================================================================
check_and_prompt_nodejs_macos() {
    # Add pink color for the circle
    PINK='\033[38;5;213m'

    # Pink blinking circle during entire checking process
    blink_state=0

    # Continue blinking and adding dots until check is complete
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"

            # ============================================================
            # MACOS VERSION CHECK: Node.js and npm version detection
            # ============================================================
            # Try to load nvm if available (to detect nvm-installed Node.js)
            # macOS can have Node.js installed via Homebrew or nvm
            if [ -s "$HOME/.nvm/nvm.sh" ]; then
                export NVM_DIR="$HOME/.nvm"
                . "$NVM_DIR/nvm.sh" >/dev/null
            fi

            # Check if Node.js is installed with correct version
            if command -v node >/dev/null 2>&1; then
                NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
                if [ "$NODE_VERSION" -ge 18 ]; then
                    # Node.js is current (>= 18), check npm version
                    if command -v npm >/dev/null 2>&1; then
                        NPM_VERSION=$(npm --version 2>/dev/null | cut -d. -f1 || echo "0")
                        if [ "$NPM_VERSION" -ge 9 ]; then
                            check_result="current"  # macOS CASE 1: Node.js >= 18 + npm >= 9
                        else
                            check_result="npm_old"  # macOS CASE 2: Node.js OK but npm < 9
                        fi
                    else
                        check_result="npm_missing"  # macOS CASE 2: Node.js OK but npm missing
                    fi
                else
                    check_result="outdated"  # macOS CASE 3: Node.js < 18
                fi
            else
                check_result="missing"  # macOS CASE 4: Node.js not installed
            fi
        fi

        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking Node.js installation${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4
    done

    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3

    # ========================================================================
    # MACOS CASE 1: Current Node.js (>= 18) + npm (>= 9) - Skip installation
    # ========================================================================
    if [ "$check_result" = "current" ]; then
        # Get full version info
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")
        NPM_VERSION_FULL=$(npm --version 2>/dev/null || echo "unknown")

        # Format the line to match last box alignment
        printf "\r  ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}and${NC} ${BOLD}npm${NC} ${GREEN}${NPM_VERSION_FULL}${NC} ${GRAY}already installed${NC}\033[K\n"
        return 0

    # ========================================================================
    # MACOS CASE 2: Node.js OK but npm outdated/missing - Update npm (no prompt)
    # ========================================================================
    elif [ "$check_result" = "npm_old" ] || [ "$check_result" = "npm_missing" ]; then
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")

        # Run setup script silently, log to temp file
        local log_file="$LOG_DIR/nodejs-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_nodejs.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while updating npm
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            printf "\r  ${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}OK, updating npm${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        # Get result
        wait $setup_pid
        local result=$?

        # Clear line and show result
        printf "\r\033[K"

        if [ $result -eq 0 ]; then
            # Load nvm to get Node.js version (if installed via nvm)
            if [ -s "$HOME/.nvm/nvm.sh" ]; then
                export NVM_DIR="$HOME/.nvm"
                . "$NVM_DIR/nvm.sh" 2>/dev/null
            fi

            NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
            NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
            printf "  ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} updated successfully\n"
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
            fi
            exit 1
        fi
        return 0

    # ========================================================================
    # MACOS CASE 3: Outdated Node.js (< 18) - Upgrade to LTS (no prompt)
    # ========================================================================
    elif [ "$check_result" = "outdated" ]; then
        NODE_VERSION_OLD=$(node --version 2>/dev/null || echo "unknown")

        # Run setup script silently, log to temp file
        local log_file="$LOG_DIR/nodejs-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_nodejs.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while upgrading
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            printf "\r  ${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${YELLOW}${NODE_VERSION_OLD}${NC} ${GRAY}outdated, upgrading${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        # Get result
        wait $setup_pid
        local result=$?

        # Clear line and show result
        printf "\r\033[K"

        if [ $result -eq 0 ]; then
            # Load nvm to get Node.js version (if installed via nvm)
            if [ -s "$HOME/.nvm/nvm.sh" ]; then
                export NVM_DIR="$HOME/.nvm"
                . "$NVM_DIR/nvm.sh" 2>/dev/null
            fi

            NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
            NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
            printf "  ${GREEN}✓${NC} ${BOLD}Node.js${NC} upgraded to ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} successfully\n"
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
            fi
            exit 1
        fi
        return 0
    fi

    # ========================================================================
    # MACOS CASE 4: Missing Node.js - Auto-install via Homebrew (no prompt)
    # ========================================================================
    # Run setup script silently with spinner
    # setup_nodejs.sh will use Homebrew to install Node.js and npm together
    local log_file="$LOG_DIR/nodejs-setup-${INSTALL_TIMESTAMP}.log"
    run_setup_script "setup_nodejs.sh" >"$log_file" 2>&1 &
    local setup_pid=$!

    # Spinner while installing via Homebrew
    local i=0
    local spin_char=""
    while kill -0 $setup_pid 2>/dev/null; do
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
        printf "\r  ${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${GRAY}not installed, installing via Homebrew${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
        i=$((i + 1))
        sleep 0.15
    done

    wait $setup_pid
    local result=$?
    printf "\r\033[K"

    if [ $result -eq 0 ]; then
        # Log saved to: $log_file

        # Load nvm to get Node.js version (if installed via nvm - though Homebrew is default on macOS)
        if [ -s "$HOME/.nvm/nvm.sh" ]; then
            export NVM_DIR="$HOME/.nvm"
            . "$NVM_DIR/nvm.sh" 2>/dev/null
        fi

        NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
        NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
        printf "  ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} installed successfully\n"
    else
        printf "${RED}✗${NC} Node.js setup failed\n"
        if [ -f "$log_file" ]; then
            printf "\n${BOLD}Last 15 lines from log:${NC}\n"
            tail -15 "$log_file"
            # Log saved to: $log_file
        fi
        exit 1
    fi

    return 0
}

# ============================================================================
# LINUX NODE.JS CHECK FUNCTION - check_and_prompt_nodejs_linux()
# ============================================================================
check_and_prompt_nodejs_linux() {
    # Add pink color for the circle
    PINK='\033[38;5;213m'

    # Pink blinking circle during entire checking process
    blink_state=0

    # Continue blinking and adding dots until check is complete
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"

            # ============================================================
            # LINUX VERSION CHECK: Node.js and npm version detection
            # ============================================================
            # Try to load nvm if available (Linux uses nvm for Node.js)
            if [ -s "$HOME/.nvm/nvm.sh" ]; then
                export NVM_DIR="$HOME/.nvm"
                . "$NVM_DIR/nvm.sh" >/dev/null
            fi

            # Check if Node.js is installed with correct version
            if command -v node >/dev/null 2>&1; then
                NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
                if [ "$NODE_VERSION" -ge 18 ]; then
                    # Node.js is current (>= 18), check npm version
                    if command -v npm >/dev/null 2>&1; then
                        NPM_VERSION=$(npm --version 2>/dev/null | cut -d. -f1 || echo "0")
                        if [ "$NPM_VERSION" -ge 9 ]; then
                            check_result="current"  # LINUX CASE 1: Node.js >= 18 + npm >= 9
                        else
                            check_result="npm_old"  # LINUX CASE 2: Node.js OK but npm < 9
                        fi
                    else
                        check_result="npm_missing"  # LINUX CASE 2: Node.js OK but npm missing
                    fi
                else
                    check_result="outdated"  # LINUX CASE 3: Node.js < 18
                fi
            else
                check_result="missing"  # LINUX CASE 4: Node.js not installed
            fi
        fi

        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking Node.js installation${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4
    done

    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3

    # ========================================================================
    # LINUX CASE 1: Current Node.js (>= 18) + npm (>= 9) - Skip installation
    # ========================================================================
    if [ "$check_result" = "current" ]; then
        # Get full version info
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")
        NPM_VERSION_FULL=$(npm --version 2>/dev/null || echo "unknown")

        # Format the line to match last box alignment
        printf "\r  ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}and${NC} ${BOLD}npm${NC} ${GREEN}${NPM_VERSION_FULL}${NC} ${GRAY}already installed${NC}\033[K\n"
        return 0

    # ========================================================================
    # LINUX CASE 2: Node.js OK but npm outdated/missing - Update npm (no prompt)
    # ========================================================================
    elif [ "$check_result" = "npm_old" ] || [ "$check_result" = "npm_missing" ]; then
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")

        # Run setup script silently, log to temp file
        # setup_nodejs.sh will use nvm to update npm
        local log_file="$LOG_DIR/nodejs-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_nodejs.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while updating npm via nvm
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            printf "\r  ${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}OK, updating npm${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        # Get result from setup_nodejs.sh
        wait $setup_pid
        local result=$?

        # Clear line and show result
        printf "\r\033[K"

        if [ $result -eq 0 ]; then
            # Load nvm to get Node.js version (if installed via nvm)
            if [ -s "$HOME/.nvm/nvm.sh" ]; then
                export NVM_DIR="$HOME/.nvm"
                . "$NVM_DIR/nvm.sh" 2>/dev/null
            fi

            NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
            NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
            printf "  ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} updated successfully\n"
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
            fi
            exit 1
        fi
        return 0

    # ========================================================================
    # LINUX CASE 3: Outdated Node.js (< 18) - Upgrade to LTS (no prompt)
    # ========================================================================
    elif [ "$check_result" = "outdated" ]; then
        NODE_VERSION_OLD=$(node --version 2>/dev/null || echo "unknown")

        # Run setup script silently, log to temp file
        # setup_nodejs.sh will install via nvm
        local log_file="$LOG_DIR/nodejs-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_nodejs.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while upgrading via nvm
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            printf "\r  ${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${YELLOW}${NODE_VERSION_OLD}${NC} ${GRAY}outdated, upgrading${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        # Get result from setup_nodejs.sh
        wait $setup_pid
        local result=$?

        # Clear line and show result
        printf "\r\033[K"

        if [ $result -eq 0 ]; then
            # Load nvm to get Node.js version (if installed via nvm)
            if [ -s "$HOME/.nvm/nvm.sh" ]; then
                export NVM_DIR="$HOME/.nvm"
                . "$NVM_DIR/nvm.sh" 2>/dev/null
            fi

            NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
            NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
            printf "  ${GREEN}✓${NC} ${BOLD}Node.js${NC} upgraded to ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} successfully\n"
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
            fi
            exit 1
        fi
        return 0
    fi

    # ========================================================================
    # LINUX CASE 4: Missing Node.js - Auto-install via nvm (no prompt)
    # ========================================================================
    # Run setup script silently with spinner
    # setup_nodejs.sh will:
    #   1. Install nvm (Node Version Manager) if not present
    #   2. Install Node.js 22 LTS via nvm
    #   3. npm comes bundled with Node.js
    local log_file="$LOG_DIR/nodejs-setup-${INSTALL_TIMESTAMP}.log"
    run_setup_script "setup_nodejs.sh" >"$log_file" 2>&1 &
    local setup_pid=$!

    # Spinner while installing via nvm
    local i=0
    local spin_char=""
    while kill -0 $setup_pid 2>/dev/null; do
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
        printf "\r  ${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${GRAY}not installed, installing via nvm${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
        i=$((i + 1))
        sleep 0.15
    done

    wait $setup_pid
    local result=$?
    printf "\r\033[K"

    if [ $result -eq 0 ]; then
        # Log saved to: $log_file

        # Load nvm to get Node.js version (nvm installation on Linux)
        if [ -s "$HOME/.nvm/nvm.sh" ]; then
            export NVM_DIR="$HOME/.nvm"
            . "$NVM_DIR/nvm.sh" 2>/dev/null
        fi

        NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
        NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
        printf "  ${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} installed successfully\n"
    else
        printf "${RED}✗${NC} Node.js setup failed\n"
        if [ -f "$log_file" ]; then
            printf "\n${BOLD}Last 15 lines from log:${NC}\n"
            tail -15 "$log_file"
        fi
        exit 1
    fi

    return 0
}

# ============================================================================
# UNIFIED NODE.JS CHECK - Delegates to platform-specific function
# ============================================================================
check_and_prompt_nodejs() {
    if [ "$(uname)" = "Darwin" ]; then
        check_and_prompt_nodejs_macos
    else
        check_and_prompt_nodejs_linux
    fi
}


# ############################################################################
# ############################################################################
# ##                                                                        ##
# ##                   DOCKER INSTALLATION COMPONENT                        ##
# ##                                                                        ##
# ############################################################################
# ############################################################################
#
# This section handles Docker installation and daemon management for both
# macOS and Linux.
#
# Components:
#   - macOS Docker installation (check_and_prompt_docker_macos)
#   - Linux Docker installation (check_and_prompt_docker_linux)
#   - Unified dispatcher (check_and_prompt_docker)
#
# Supported platforms:
#   macOS:  OrbStack via Homebrew (Docker Desktop alternative)
#   Linux:  Snap (preferred), apt-get, dnf, yum (auto-detected)
#
# Supported Linux distributions: 15+ (Ubuntu, Debian, Fedora, RHEL, CentOS,
#   Rocky, AlmaLinux, Mint, Pop!_OS, Elementary, Arch, Manjaro, OpenSUSE)
#
# ############################################################################

# ============================================================================
# DOCKER INSTALLATION CHECK - All Cases (macOS)
# ============================================================================
# Detects Docker status and automatically installs/starts as needed.
#
# CASE 1: Docker running (daemon responsive)
#   - Condition: docker info succeeds
#   - Action: Skip installation (already running)
#   - Example: "OrbStack Docker 1.7.3 already installed and running"
#
# CASE 2: Docker installed but not running
#   - Condition: docker command exists but docker info fails
#   - Action: Start Docker daemon (no prompt)
#   - Example: "OrbStack Docker 27.1.1 installed but not running, starting"
#   - When: Docker/OrbStack installed but not started
#
# CASE 3: Docker not installed
#   - Condition: docker command not found
#   - Action: Install OrbStack Docker (no prompt)
#   - When: Fresh system or Docker never installed
#
# Decision Flow:
#   docker info succeeds?
#     YES → CASE 1 (Running)
#     NO  → docker command exists?
#             YES → CASE 2 (Installed but not running)
#             NO  → CASE 3 (Not installed)
#
# macOS Installation Method:
#   - Uses OrbStack (recommended alternative to Docker Desktop)
#   - Command: brew install --cask orbstack
#   - Version: Latest stable (e.g., 1.7.3)
#   - Benefits: Faster, lighter, free for personal use
#   - Note: Docker Desktop support disabled in code
#
# All cases log to: $HOME/graphdone-logs/docker-setup-YYYY-MM-DD_HH-MM-SS.log
# ============================================================================

# ============================================================================
# DOCKER INSTALLATION CHECK - All Cases (Linux)
# ============================================================================
# Detects Docker status and automatically installs/starts as needed on Linux.
#
# CASE 1: Docker running (daemon responsive)
#   - Condition: docker info succeeds
#   - Action: Skip installation (already running)
#   - Example: "Docker 24.0.7 already installed and running"
#
# CASE 2: Docker installed but not running
#   - Condition: docker command exists but docker info fails
#   - Action: Start Docker daemon (no prompt)
#   - Example: "Docker 24.0.7 installed but not running, starting"
#   - When: Docker installed but systemd service not started
#
# CASE 3: Docker not installed
#   - Condition: docker command not found
#   - Action: Install Docker Engine (no prompt)
#   - When: Fresh system or Docker never installed
#
# Decision Flow:
#   docker info succeeds?
#     YES → CASE 1 (Running)
#     NO  → docker command exists?
#             YES → CASE 2 (Installed but not running)
#             NO  → CASE 3 (Not installed)
#
# Linux Installation Methods (Auto-detected):
#   METHOD 1: Snap (Preferred - if available)
#     - Command: snap install docker
#     - Works on: Ubuntu 16.04+, Debian 9+, Fedora, Arch, Manjaro, OpenSUSE
#     - Benefits: Single command, automatic updates, cross-distribution
#
#   METHOD 2: APT (Ubuntu/Debian - if snap unavailable)
#     - Uses Docker's official repository
#     - Supported: Ubuntu 20.04+, Debian 10+, Linux Mint, Pop!_OS
#     - Installs: docker-ce, docker-ce-cli, containerd.io
#
#   METHOD 3: DNF (Fedora - if snap unavailable)
#     - Uses Docker's official repository
#     - Supported: Fedora 36+, Fedora Workstation/Server
#     - Installs: docker-ce, docker-ce-cli, containerd.io
#
#   METHOD 4: YUM (RHEL/CentOS - if snap unavailable)
#     - Uses Docker's official repository
#     - Supported: RHEL 8+, CentOS 8+, Rocky Linux, AlmaLinux
#     - Installs: docker-ce, docker-ce-cli, containerd.io
#
#   Auto-detection order: snap → apt-get → dnf → yum
#
# All methods:
#   - Require sudo for installation
#   - Add user to docker group (no sudo for docker commands)
#   - Start and enable Docker daemon
#   - Require logout/login for group changes
#
# Features:
#   - Fully automated installation
#   - NO user prompts for any case
#   - Animated spinner shows progress
#   - Version verification after installation
#   - Automatic daemon startup
#   - Logs to: $HOME/graphdone-logs/docker-setup-YYYY-MM-DD_HH-MM-SS.log
#
# Exit codes from setup_docker.sh:
#   0 - Success (Docker installed/started or already running)
#   1 - Failure (Installation failed or unsupported distribution)
# ============================================================================

# ============================================================================
# MACOS DOCKER CHECK FUNCTION - check_and_prompt_docker_macos()
# ============================================================================
check_and_prompt_docker_macos() {
    # Add pink color for the circle
    PINK='\033[38;5;213m'

    # Pink blinking circle during entire checking process
    blink_state=0

    # Continue blinking and adding dots until check is complete
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"

            # ============================================================
            # MACOS VERSION CHECK: Docker installation and status
            # ============================================================
            # Check if Docker is installed AND running
            # Verify Docker daemon is actually running by testing connectivity
            if docker info >/dev/null 2>&1; then
                check_result="running"  # macOS CASE 1: Docker daemon is responsive
            elif command -v docker >/dev/null 2>&1; then
                check_result="installed"  # macOS CASE 2: Docker installed but not running
            elif command -v orbstack >/dev/null 2>&1 || [ -d "/Applications/OrbStack.app" ]; then
                check_result="installed"  # macOS CASE 2: OrbStack installed but daemon not responding
            else
                check_result="missing"  # macOS CASE 3: Docker not installed
            fi
        fi

        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking Docker installation${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4
    done

    # Move to fresh line before printing status
    printf "\r\033[K"

    # ========================================================================
    # MACOS CASE 1: Docker running - Skip installation
    # ========================================================================
    if [ "$check_result" = "running" ]; then
        # Add OrbStack bin to PATH if available (for version detection)
        if [ -d "$HOME/.orbstack/bin" ]; then
            export PATH="$HOME/.orbstack/bin:$PATH"
        fi

        # Detect which Docker runtime is installed
        if [ -d "/Applications/OrbStack.app" ] || command -v orb >/dev/null 2>&1; then
            DOCKER_RUNTIME="OrbStack Docker"
            DOCKER_VERSION=$(orb version 2>/dev/null | grep "Version:" | cut -d' ' -f2 || docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "installed")
        # DISABLED: Docker Desktop support
        # elif [ -d "/Applications/Docker.app" ]; then
        #     DOCKER_RUNTIME="Docker Desktop"
        #     DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "installed")
        else
            DOCKER_RUNTIME="OrbStack Docker"
            DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "installed")
        fi

        printf "\r  ${GREEN}✓${NC} ${BOLD}${DOCKER_RUNTIME}${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}already installed and running${NC}\033[K\n"
        return 0

    # ========================================================================
    # MACOS CASE 2: Docker installed but not running - Start daemon (no prompt)
    # ========================================================================
    elif [ "$check_result" = "installed" ]; then
        # Docker installed but not running - start it

        # Detect which Docker runtime is installed
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
        if [ -d "/Applications/OrbStack.app" ] || command -v orbstack >/dev/null 2>&1; then
            DOCKER_RUNTIME="OrbStack Docker"
        # DISABLED: Docker Desktop support
        # elif [ -d "/Applications/Docker.app" ]; then
        #     DOCKER_RUNTIME="Docker Desktop"
        else
            DOCKER_RUNTIME="Docker"
        fi

        printf "\r  ${YELLOW}⚠${NC} ${BOLD}${DOCKER_RUNTIME}${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}installed but not running, starting${NC}\033[K\n"

        # Move to previous line for spinner to replace the warning
        printf "\033[1A"

        # Run the Docker setup script to start Docker with spinner
        local log_file="$LOG_DIR/docker-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_docker.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while starting
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            printf "\r  ${YELLOW}◉${NC} Starting ${DOCKER_RUNTIME} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        wait $setup_pid
        local result=$?

        if [ $result -eq 0 ]; then
            # Get Docker version and runtime name, show clean success message
            DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
            printf "\r  ${GREEN}✓${NC} ${BOLD}${DOCKER_RUNTIME}${NC} ${GREEN}${DOCKER_VERSION}${NC} started successfully\033[K\n"
        else
            printf "  ${RED}✗${NC} Docker startup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
            fi
            exit 1
        fi
        return 0
    fi

    # ========================================================================
    # MACOS CASE 3: Docker not installed - Install OrbStack (no prompt)
    # ========================================================================
    # Run Docker setup script with spinner
    # setup_docker.sh will install OrbStack via Homebrew
    local log_file="$LOG_DIR/docker-setup-${INSTALL_TIMESTAMP}.log"
    run_setup_script "setup_docker.sh" >"$log_file" 2>&1 &
    local setup_pid=$!

    # Spinner while installing
    local i=0
    local spin_char=""
    while kill -0 $setup_pid 2>/dev/null; do
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
        printf "\r  ${YELLOW}⚠${NC} ${BOLD}Docker${NC} ${GRAY}not installed, installing OrbStack Docker${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
        i=$((i + 1))
        sleep 0.15
    done

    wait $setup_pid
    local result=$?
    printf "\r\033[K"

    if [ $result -eq 0 ]; then
        # Log saved to: $log_file

        # Add OrbStack bin to PATH immediately after installation
        if [ -d "$HOME/.orbstack/bin" ]; then
            export PATH="$HOME/.orbstack/bin:$PATH"
        fi

        # Detect runtime and get version
        if [ -d "/Applications/OrbStack.app" ] || command -v orb >/dev/null 2>&1; then
            DOCKER_RUNTIME="OrbStack Docker"
            DOCKER_VERSION=$(orb version 2>/dev/null | grep "Version:" | cut -d' ' -f2 || docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "installed")
        else
            DOCKER_RUNTIME="Docker"
            DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "installed")
        fi

        printf "  ${GREEN}✓${NC} ${BOLD}${DOCKER_RUNTIME}${NC} ${GREEN}${DOCKER_VERSION}${NC} installed and running successfully\n"
    else
        printf "${RED}✗${NC} Docker setup failed\n"
        if [ -f "$log_file" ]; then
            printf "\n${BOLD}Last 15 lines from log:${NC}\n"
            tail -15 "$log_file"
            # Log saved to: $log_file
        fi
        exit 1
    fi

    return 0
}

# ============================================================================
# LINUX DOCKER CHECK FUNCTION - check_and_prompt_docker_linux()
# ============================================================================
check_and_prompt_docker_linux() {
    # Add pink color for the circle
    PINK='\033[38;5;213m'

    # Pink blinking circle during entire checking process
    blink_state=0

    # Continue blinking and adding dots until check is complete
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"

            # ============================================================
            # LINUX VERSION CHECK: Docker installation and status
            # ============================================================
            # Check if Docker is installed AND running
            # Verify Docker daemon is actually running by testing connectivity
            if docker info >/dev/null 2>&1; then
                check_result="running"  # LINUX CASE 1: Docker daemon is responsive
            elif command -v docker >/dev/null 2>&1; then
                check_result="installed"  # LINUX CASE 2: Docker installed but not running
            else
                check_result="missing"  # LINUX CASE 3: Docker not installed
            fi
        fi

        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking Docker installation${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4
    done

    # Move to fresh line before printing status
    printf "\r\033[K"

    # ========================================================================
    # LINUX CASE 1: Docker running - Skip installation
    # ========================================================================
    if [ "$check_result" = "running" ]; then
        # Get Docker version
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "installed")

        printf "\r  ${GREEN}✓${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}already installed and running${NC}\033[K\n"
        return 0

    # ========================================================================
    # LINUX CASE 2: Docker installed but not running - Start daemon (no prompt)
    # ========================================================================
    elif [ "$check_result" = "installed" ]; then
        # Docker installed but not running - start it
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")

        printf "\r  ${YELLOW}⚠${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}installed but not running, starting${NC}\033[K\n"

        # Move to previous line for spinner to replace the warning
        printf "\033[1A"

        # Run the Docker setup script to start Docker with spinner
        local log_file="$LOG_DIR/docker-setup-${INSTALL_TIMESTAMP}.log"
        run_setup_script "setup_docker.sh" >"$log_file" 2>&1 &
        local setup_pid=$!

        # Spinner while starting
        local i=0
        local spin_char=""
        while kill -0 $setup_pid 2>/dev/null; do
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
            printf "\r  ${YELLOW}◉${NC} Starting Docker ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        wait $setup_pid
        local result=$?

        if [ $result -eq 0 ]; then
            # Get Docker version, show clean success message
            DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
            printf "\r  ${GREEN}✓${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} started successfully\033[K\n"
        else
            printf "  ${RED}✗${NC} Docker startup failed\n"
            if [ -f "$log_file" ]; then
                printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                tail -15 "$log_file"
            fi
            exit 1
        fi
        return 0
    fi

    # ========================================================================
    # LINUX CASE 3: Docker not installed - Install Docker Engine (no prompt)
    # ========================================================================
    # Run Docker setup script with spinner
    # setup_docker.sh will install Docker Engine via official repository
    local log_file="$LOG_DIR/docker-setup-${INSTALL_TIMESTAMP}.log"
    run_setup_script "setup_docker.sh" >"$log_file" 2>&1 &
    local setup_pid=$!

    # Spinner while installing via package manager
    local i=0
    local spin_char=""
    while kill -0 $setup_pid 2>/dev/null; do
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
        printf "\r  ${YELLOW}⚠${NC} ${BOLD}Docker${NC} ${GRAY}not installed, installing Docker Engine${NC} ${BOLD}${CYAN}%s${NC}\033[K" "$spin_char"
        i=$((i + 1))
        sleep 0.15
    done

    wait $setup_pid
    local result=$?
    printf "\r\033[K"

    if [ $result -eq 0 ]; then
        # Get Docker version
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "installed")
        printf "  ${GREEN}✓${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} installed and running successfully\n"
    else
        printf "${RED}✗${NC} Docker setup failed\n"
        if [ -f "$log_file" ]; then
            printf "\n${BOLD}Last 15 lines from log:${NC}\n"
            tail -15 "$log_file"
        fi
        exit 1
    fi

    return 0
}

# ============================================================================
# UNIFIED DOCKER CHECK - Delegates to platform-specific function
# ============================================================================
check_and_prompt_docker() {
    if [ "$(uname)" = "Darwin" ]; then
        check_and_prompt_docker_macos
    else
        check_and_prompt_docker_linux
    fi
}

# Install Docker with progress feedback (Linux)
install_docker_with_progress() {
    if command -v docker >/dev/null 2>&1; then
        return 0
    fi

    case $PLATFORM in
        "linux")
            printf "  ${GRAY}• Downloading Docker installation script${NC}\n"
            curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || return 1
            printf "  ${GRAY}• Adding user to docker group${NC}\n"
            sudo usermod -aG docker "$USER" 2>/dev/null || true
            printf "  ${GRAY}• Starting Docker service${NC}\n"
            sudo systemctl start docker 2>/dev/null || true
            sudo systemctl enable docker 2>/dev/null || true
            ;;
        *)
            return 1
            ;;
    esac
    return 0
}

# ============================================================================
# NPM INSTALL - PLATFORM SPECIFIC ROLLUP PACKAGES
# ============================================================================

smart_npm_install() {
    local attempt=1
    local max_attempts=3
    local npm_error_log="/tmp/npm-error-$$.log"
    local npm_debug_log="/tmp/npm-debug-$$.log"

    # Track temp files for cleanup
    TEMP_FILES="$TEMP_FILES $npm_error_log $npm_debug_log"
    CLEANUP_NEEDED=true

    while [ $attempt -le $max_attempts ]; do
        if [ $attempt -eq 1 ]; then
            # First attempt: standard npm install
            if npm install >/dev/null 2>"$npm_error_log"; then
                return 0
            fi
            echo "First attempt failed, trying with --legacy-peer-deps" >> "$npm_debug_log"
        elif [ $attempt -eq 2 ]; then
            # Second attempt: handle peer dependency conflicts
            echo "Resolving dependency conflicts" >> "$npm_debug_log"
            if npm install --legacy-peer-deps >/dev/null 2>>"$npm_error_log"; then
                return 0
            fi
            echo "Second attempt failed, trying platform-specific approach" >> "$npm_debug_log"
        else
            # Third attempt: platform-specific rollup binaries
            echo "Installing platform-specific rollup" >> "$npm_debug_log"

            local rollup_package=""
            case "$(uname)" in
                Darwin*)
                    # macOS: detect architecture
                    if [ "$(uname -m)" = "arm64" ]; then
                        rollup_package="@rollup/rollup-darwin-arm64"
                    else
                        rollup_package="@rollup/rollup-darwin-x64"
                    fi
                    ;;
                Linux*)
                    # Linux: x64 GNU
                    rollup_package="@rollup/rollup-linux-x64-gnu"
                    ;;
                *)
                    echo "Skipping platform-specific rollup for $(uname)" >> "$npm_debug_log"
                    ;;
            esac

            if [ -n "$rollup_package" ]; then
                if npm install "$rollup_package" --save-dev >/dev/null 2>>"$npm_error_log" && npm install --legacy-peer-deps >/dev/null 2>>"$npm_error_log"; then
                    return 0
                fi
            else
                if npm install --legacy-peer-deps >/dev/null 2>>"$npm_error_log"; then
                    return 0
                fi
            fi
        fi

        attempt=$((attempt + 1))
    done

    # Show error details if all attempts failed
    echo "All npm install attempts failed. Error details:" >> "$npm_debug_log"
    if [ -f "$npm_error_log" ]; then
        cat "$npm_error_log" >> "$npm_debug_log"
    fi

    return 1
}

# Auto-install Docker if missing (delegates to dedicated script)
install_docker() {
    if command -v docker >/dev/null 2>&1; then
        return 0
    fi

    log "Installing Docker"

    # Run the Docker setup script (same pattern as Git/Node.js)
    if run_setup_script "setup_docker.sh"; then
        return 0
    else
        warn "Docker installation failed"
        return 1
    fi
}

# ############################################################################
# ############################################################################
# ##                                                                        ##
# ##                  SERVICE MANAGEMENT COMPONENT                          ##
# ##                                                                        ##
# ############################################################################
# ############################################################################
#
# This section handles GraphDone service lifecycle management.
#
# Components:
#   - check_containers_healthy() - Verify all Docker containers are healthy
#   - wait_for_services() - Wait for services to be ready (60s timeout)
#   - stop_services() - Stop all GraphDone services
#   - remove_services() - Complete cleanup and reset
#
# Service health checks:
#   Neo4j:  Container health + cypher-shell connectivity
#   Redis:  Container health + redis-cli ping
#   API:    Container running + HTTPS endpoint (port 4128)
#   Web:    Container running + HTTPS endpoint (port 3128)
#
# Used by: install_graphdone(), command-line arguments (stop/remove)
#
# ############################################################################

# Check if containers are healthy (using smart-start approach)
check_containers_healthy() {
    # Check each service individually like smart-start does
    neo4j_healthy=false
    redis_healthy=false
    api_healthy=false
    web_healthy=false

    # Check Neo4j container health and connectivity
    if docker ps --format "{{.Names}} {{.Status}}" | grep "graphdone-neo4j" | grep -q "Up.*healthy" 2>/dev/null; then
        # Verify Neo4j is actually responding with cypher-shell
        if docker exec graphdone-neo4j cypher-shell -u neo4j -p graphdone_password "RETURN 1" >/dev/null 2>&1; then
            neo4j_healthy=true
        fi
    fi

    # Check Redis container health and connectivity
    if docker ps --format "{{.Names}} {{.Status}}" | grep "graphdone-redis" | grep -q "Up.*healthy" 2>/dev/null; then
        # Verify Redis is actually responding
        if docker exec graphdone-redis redis-cli ping >/dev/null 2>&1; then
            redis_healthy=true
        fi
    fi

    # Check API container and endpoint (focus on functionality, not Docker health status)
    if docker ps --format "{{.Names}} {{.Status}}" | grep "graphdone-api" | grep -q "Up" 2>/dev/null; then
        # Test HTTPS API health endpoint (port 4128) - endpoint response is what matters
        if curl -k -sf --max-time 15 https://localhost:4128/health >/dev/null 2>&1; then
            api_healthy=true
        fi
    fi

    # Check Web container health and endpoint
    if docker ps --format "{{.Names}}" | grep -q "graphdone-web" 2>/dev/null; then
        # Test the correct web endpoint (HTTP first, then HTTPS)
        if curl -sf --max-time 15 http://localhost:3127 >/dev/null 2>&1 || curl -k -sf --max-time 15 https://localhost:3128 >/dev/null 2>&1; then
            web_healthy=true
        fi
    fi

    # All services must be healthy
    if [ "$neo4j_healthy" = true ] && [ "$redis_healthy" = true ] && [ "$api_healthy" = true ] && [ "$web_healthy" = true ]; then
        return 0
    fi
    return 1
}

# Wait for services to be ready
wait_for_services() {
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    i=0
    attempts=0

    while [ $attempts -lt 180 ]; do  # 180 attempts = ~3 minutes
        if check_containers_healthy; then
            printf "\r\033[K"  # Clear entire line
            return 0
        fi

        # Get spinner character
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

        printf "\r  ${GRAY}▸${NC} Waiting for services to initialize ${BOLD}${CYAN}%s${NC} (%ds)%-35s" "$spin_char" $attempts " "
        i=$(( (i+1) % 10 ))
        attempts=$((attempts + 1))
        sleep 1
    done

    printf "\r\033[K"  # Clear entire line
    printf "${YELLOW}!${NC} Services started but initialization is taking longer than 3 minutes\n"
    printf "${GRAY}  Try: docker ps | grep graphdone${NC}\n"
    return 1
}

# Stop all GraphDone services
stop_services() {
    log "Stopping GraphDone services"

    # Beautiful container cleanup like smart-start
    printf "\n${BOLD}${PURPLE}♻️  CONTAINER CLEANUP${NC}\n"
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    printf " ${YELLOW}🛑${NC} Stopping running containers\n"

    # Stop containers with status feedback
    for container in graphdone-neo4j graphdone-redis graphdone-api graphdone-web; do
        if docker ps -q -f name="$container" | grep -q .; then
            if docker stop "$container" &>/dev/null; then
                printf "   ${GREEN}✓${NC} Stopped $container\n"
            else
                printf "   ${RED}✗${NC} Failed to stop $container\n"
            fi
        else
            printf "   ${DIM}✗${NC} ${DIM}Not running $container${NC}\n"
        fi
    done

    # Kill development processes
    if command -v lsof >/dev/null 2>&1; then
        for port in 3127 3128 4127 4128; do
            pids=$(lsof -ti:$port 2>/dev/null)
            if [ -n "$pids" ]; then
                echo "$pids" | xargs kill -9 2>/dev/null || true
            fi
        done
    fi

    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    printf "${GREEN}✅ Container stop complete!${NC}\n"
}

# Remove all containers and volumes
remove_services() {
    log "Removing GraphDone containers and data"

    # Stop first (but hide the output since we'll show removal section)
    printf "\n${BOLD}${PURPLE}♻️  CONTAINER CLEANUP${NC}\n"
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    # Stop containers quietly first
    for container in graphdone-neo4j graphdone-redis graphdone-api graphdone-web; do
        docker stop "$container" >/dev/null 2>&1 || true
    done

    printf " ${YELLOW}🗑️${NC}  Removing old containers\n"

    # Remove containers with status feedback
    for container in graphdone-neo4j graphdone-redis graphdone-api graphdone-web; do
        if docker ps -aq -f name="$container" | grep -q .; then
            if docker rm "$container" &>/dev/null; then
                printf "   ${GREEN}✓${NC} Removed $container\n"
            else
                printf "   ${RED}✗${NC} Failed to remove $container\n"
            fi
        else
            printf "   ${DIM}✓${NC} ${DIM}Already removed $container${NC}\n"
        fi
    done

    # Remove volumes
    docker volume rm graphdone_neo4j_data graphdone_neo4j_logs graphdone_redis_data >/dev/null 2>&1 || true

    # Clean dependency cache
    if [ -d "$CACHE_DIR" ]; then
        rm -rf "$CACHE_DIR"
        printf "   ${GREEN}✓${NC} Dependency cache cleared\n"
    fi

    # Clean build cache
    docker system prune -f >/dev/null 2>&1 || true

    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    printf "${GREEN}✓ Cleanup complete!${NC}\n"
}

# ############################################################################
# ############################################################################
# ##                                                                        ##
# ##              MAIN INSTALLATION ORCHESTRATOR COMPONENT                  ##
# ##                                                                        ##
# ############################################################################
# ############################################################################
#
# This section contains the main installation workflow that orchestrates
# the entire GraphDone setup process.
#
# Components:
#   - install_graphdone() - Main installation function
#
# Installation Flow:
#   1. Display animated banner with version
#   2. Detect platform (macOS/Linux)
#   3. Check macOS compatibility (if macOS)
#   4. Check system requirements (disk space, network)
#   5. Install Git (if missing or outdated)
#   6. Install Node.js (if missing or outdated)
#   7. Install Docker (if missing or not running)
#   8. Clone GraphDone repository
#   9. Install npm dependencies (with smart retry)
#   10. Start Docker Compose services (Neo4j, Redis, API, Web)
#   11. Wait for services to be healthy (60s timeout)
#   12. Show success message with URLs
#
# Exit codes:
#   0 - Success (GraphDone installed and running)
#   1 - Failure (Installation failed at any step)
#
# ############################################################################

# Main installation function
install_graphdone() {
    # Beautiful GraphDone header with Copilot-style animation
    clear
    printf "\n\n"

    # Fetch latest version from GitHub releases
    GRAPHDONE_VERSION="v0.3.1-alpha"  # Fallback version
    if command -v curl >/dev/null 2>&1; then
        LATEST_VERSION=$(curl -sf --max-time 3 https://api.github.com/repos/GraphDone/GraphDone-Core/releases/latest 2>/dev/null | grep -o '"tag_name": *"[^"]*"' | sed 's/"tag_name": *"\(.*\)"/\1/' 2>/dev/null)
        if [ -n "$LATEST_VERSION" ]; then
            GRAPHDONE_VERSION="$LATEST_VERSION"
        fi
    fi

    # Use 256-color mode for better compatibility (38;5;XXX format)
    # or fallback to basic ANSI if terminal doesn't support it
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        # 256-color mode
        TEAL="\033[38;5;37m"     # Cyan/teal color
        OLIVE="\033[38;5;143m"    # Light olive green
        LIGHTCYAN="\033[38;5;87m" # Light cyan
        YELLOW="\033[38;5;220m"  # Yellow
        ORANGE="\033[38;5;208m"  # Orange
    else
        # Fallback to basic ANSI colors
        TEAL="\033[0;36m"        # Basic cyan
        OLIVE="\033[0;93m"       # Bright yellow (light olive fallback)
        LIGHTCYAN="\033[0;96m"   # Bright cyan
        YELLOW="\033[0;93m"      # Bright yellow
        ORANGE="\033[0;91m"      # Bright red (closest to orange)
    fi
    NC="\033[0m"      # No Color (reset)
    GREEN="\033[38;5;154m"   # Yellowgreen for checkmarks (256-color, #9acd32)
    GRAY="\033[38;5;244m"   # Gray for progress indicators (256-color)
    CYAN="\033[38;5;51m"    # Cyan for labels (256-color)
    BOLD="\033[1m"          # Bold text

    # ─────────────────────────────────────────────────────────────────────
    # Animated Banner - Professional Reveal Effect
    # ─────────────────────────────────────────────────────────────────────
    # Creates a beautiful progressive reveal effect (30ms delay per line)
    # Smooth, professional line-by-line animation for modern CLI experience
    printf "${TEAL}╔══════════════════════════════════════════════════════════════════════════════════════════════════╗${NC}\n"; sleep 0.03
    printf "${TEAL}║                                                                                                  ║${NC}\n"; sleep 0.03
    printf "${TEAL}║                  ${TEAL}${BOLD}██╗    ██╗███████╗██╗      ██████╗ ██████╗ ███╗   ███╗███████╗${NC}                  ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║                  ${TEAL}${BOLD}██║    ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║██╔════╝${NC}                  ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║                  ${TEAL}${BOLD}██║ █╗ ██║█████╗  ██║     ██║     ██║   ██║██╔████╔██║█████╗${NC}                    ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║                  ${TEAL}${BOLD}██║███╗██║██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║██╔══╝${NC}                    ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║                  ${TEAL}${BOLD}╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗${NC}                  ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║                   ${TEAL}${BOLD}╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝${NC}                  ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                                                                                  ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                      ${TEAL}${BOLD}████████╗ ██████╗${NC}                                           ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                      ${TEAL}${BOLD}╚══██╔══╝██╔═══██╗${NC}                                          ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}██║   ██║   ██║${NC}                                          ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}██║   ██║   ██║${NC}                                          ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}██║   ╚██████╔╝${NC}                                          ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}╚═╝    ╚═════╝${NC}                                           ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}║                                                                                                  ║${NC}\n"; sleep 0.03
    printf "${TEAL}║           ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗██████╗  ██████╗ ███╗   ██╗███████╗            ║${NC}\n"; sleep 0.03
    printf "${TEAL}║          ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██║  ██║██╔══██╗██╔═══██╗████╗  ██║██╔════╝            ║${NC}\n"; sleep 0.03
    printf "${TEAL}║          ██║  ███╗██████╔╝███████║██████╔╝███████║██║  ██║██║   ██║██╔██╗ ██║█████╗              ║${NC}\n"; sleep 0.03
    printf "${TEAL}║          ██║   ██║██╔══██╗██╔══██║██╔═══╝ ██╔══██║██║  ██║██║   ██║██║╚██╗██║██╔══╝              ║${NC}\n"; sleep 0.03
    printf "${TEAL}║          ╚██████╔╝██║  ██║██║  ██║██║     ██║  ██║██████╔╝╚██████╔╝██║ ╚████║███████╗            ║${NC}\n"; sleep 0.03
    printf "${TEAL}║           ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚══════╝            ║${NC}\n"; sleep 0.03
    printf "${TEAL}║                                                                                                  ║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}${OLIVE}                             Instant Setup. Zero Config. Pure Graph.                              ${NC}${TEAL}║${NC}\n"; sleep 0.05
    printf "${TEAL}║                                                                                                  ║${NC}\n"; sleep 0.03
    printf "${TEAL}║${LIGHTCYAN}                          Built with ♥ ${YELLOW}for${LIGHTCYAN} teams ${ORANGE}who${LIGHTCYAN} think differently.                           ${TEAL}║${NC}\n"; sleep 0.05
    printf "${TEAL}║                                                                                                  ║${NC}\n"; sleep 0.03
    printf "${TEAL}║${NC}                                                                            ${DARKSEAGREEN}Version: ${CADETBLUE}${GRAPHDONE_VERSION}${NC} ${TEAL}║${NC}\n"; sleep 0.03
    printf "${TEAL}╚══════════════════════════════════════════════════════════════════════════════════════════════════╝${NC}\n\n"

    # Platform detection
    detect_platform

    # Get macOS version info (silent - displayed later in System Information)
    get_macos_info

    # ─────────────────────────────────────────────────────────────────────
    # SECTION 1: Pre-flight Checks
    # ─────────────────────────────────────────────────────────────────────
    # Validates system readiness: network, disk space, download/upload speed
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}✈️  Pre-flight Checks${NC}  ${TEAL}────────────────────────────────────────${NC}\n"

    # Check network connectivity with 4-dot animation
    check_network &
    network_pid=$!

    for cycle in 1 2 3 4 5 6; do
        # Check if network check is still running
        if ! kill -0 $network_pid 2>/dev/null; then
            break
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 2 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 3 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -ge 4 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${GREEN}●${NC}"
        fi

        printf "\r  ${BLUE}◉${NC} ${GRAY}Checking network${NC}$dots_display"
        printf "\033[K"
        sleep 0.5
    done

    wait $network_pid

    # Show all 4 dots completed
    printf "\r  ${BLUE}◉${NC} ${GRAY}Checking network${NC} ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC} ${GREEN}●${NC}"
    sleep 0.3

    printf "\r\033[K  ${GREEN}✓${NC} ${GRAY}Network:${NC} ${BOLD}Connected${NC}\n"

    # Test download speed with 4-dot animation
    local download_tmp="/tmp/graphdone_download_$$"
    (test_download_speed > "$download_tmp") &
    download_pid=$!

    for cycle in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do
        # Check if speed test is still running
        if ! kill -0 $download_pid 2>/dev/null; then
            break
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -ge 7 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"
        fi
        if [ $cycle -ge 9 ]; then
            dots_display="$dots_display ${GREEN}●${NC}"
        fi

        printf "\r  ${BLUE}◉${NC} ${GRAY}Testing download speed${NC}$dots_display"
        printf "\033[K"
        sleep 0.5
    done

    wait $download_pid

    # Show all 4 dots completed
    printf "\r  ${BLUE}◉${NC} ${GRAY}Testing download speed${NC} ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC} ${GREEN}●${NC}"
    sleep 0.3

    download_speed=$(cat "$download_tmp" 2>/dev/null || echo "N/A")
    rm -f "$download_tmp"

    if [ "$download_speed" != "N/A" ]; then
        printf "\r\033[K  ${GREEN}✓${NC} ${GRAY}Download:${NC} ${BOLD}${download_speed} Mbps${NC}\n"
    else
        printf "\r\033[K  ${YELLOW}◉${NC} ${GRAY}Download:${NC} ${BOLD}Unable to test${NC}\n"
    fi

    # Test upload speed with 4-dot animation
    local upload_tmp="/tmp/graphdone_upload_$$"
    (test_upload_speed > "$upload_tmp") &
    upload_pid=$!

    for cycle in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do
        # Check if speed test is still running
        if ! kill -0 $upload_pid 2>/dev/null; then
            break
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -ge 7 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"
        fi
        if [ $cycle -ge 9 ]; then
            dots_display="$dots_display ${GREEN}●${NC}"
        fi

        printf "\r  ${BLUE}◉${NC} ${GRAY}Testing upload speed${NC}$dots_display"
        printf "\033[K"
        sleep 0.5
    done

    wait $upload_pid

    # Show all 4 dots completed
    printf "\r  ${BLUE}◉${NC} ${GRAY}Testing upload speed${NC} ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC} ${GREEN}●${NC}"
    sleep 0.3

    upload_speed=$(cat "$upload_tmp" 2>/dev/null || echo "N/A")
    rm -f "$upload_tmp"

    if [ "$upload_speed" != "N/A" ]; then
        printf "\r\033[K  ${GREEN}✓${NC} ${GRAY}Upload:${NC} ${BOLD}${upload_speed} Mbps${NC}\n"
    else
        printf "\r\033[K  ${YELLOW}◉${NC} ${GRAY}Upload:${NC} ${BOLD}Unable to test${NC}\n"
    fi

    # ─────────────────────────────────────────────────────────────────────
    # SECTION 2: System Information
    # ─────────────────────────────────────────────────────────────────────
    # Displays platform, OS version, architecture, shell
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🖥️  System Information${NC}  ${TEAL}───────────────────────────────────────${NC}\n"
    # Platform display with system name in brackets
    local platform_name
    case "$(uname)" in
        "Darwin")
            platform_name="(macOS)"
            ;;
        "Linux")
            platform_name="(Linux)"
            ;;
        *)
            platform_name=""
            ;;
    esac

    printf "  ${BLUE}◉${NC} ${GRAY}Platform:${NC} ${BOLD}$(uname) $(uname -m)${NC} ${GRAY}${platform_name}${NC}\n"

    # Show macOS version with compatibility indicator
    if [ "$PLATFORM" = "macos" ] && [ -n "$MACOS_VERSION" ]; then
        # Build version string with name if available
        if [ -n "$MACOS_NAME" ]; then
            local version_display="${MACOS_VERSION} ${GRAY}(${MACOS_NAME})${NC}"
        else
            local version_display="${MACOS_VERSION}"
        fi

        if [ "$MACOS_COMPATIBLE" = "yes" ]; then
            printf "  ${BLUE}◉${NC} ${GRAY}macOS:${NC} ${BOLD}${version_display}${NC} ${GREEN}✓${NC}\n"
        elif [ "$MACOS_COMPATIBLE" = "no" ]; then
            printf "  ${BLUE}◉${NC} ${GRAY}macOS:${NC} ${BOLD}${version_display}${NC} ${YELLOW}⚠ Requires 10.15+${NC}\n"
        else
            printf "  ${BLUE}◉${NC} ${GRAY}macOS:${NC} ${BOLD}${version_display}${NC}\n"
        fi

        # Show chip information (Apple Silicon or Intel)
        local chip_info=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)
        if echo "$chip_info" | grep -q "Apple"; then
            # Extract Apple chip name (M1, M2, M3, etc.)
            local chip_name=$(echo "$chip_info" | grep -o "Apple M[0-9].*" | cut -d' ' -f1-2)
            printf "  ${BLUE}◉${NC} ${GRAY}Chip:${NC} ${BOLD}${chip_name}${NC}\n"
        else
            # Intel processor - show model
            local intel_model=$(echo "$chip_info" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | cut -d'@' -f1)
            printf "  ${BLUE}◉${NC} ${GRAY}Chip:${NC} ${BOLD}${intel_model}${NC}\n"
        fi

        # Show RAM
        local ram_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024 / 1024 / 1024 ))
        if [ "$ram_gb" -gt 0 ]; then
            printf "  ${BLUE}◉${NC} ${GRAY}RAM:${NC} ${BOLD}${ram_gb} GB${NC}\n"
        fi

        # Show disk space using diskutil
        if command -v diskutil >/dev/null 2>&1; then
            diskutil info / 2>/dev/null | awk -F': *' '/Container Free Space/ {
                split($2, arr, " ")
                printf "  \033[34m◉\033[0m \033[90mDisk Available:\033[0m \033[1m%s %s\033[0m\n", arr[1], arr[2]
            }'
        fi
    elif [ "$PLATFORM" = "linux" ]; then
        # Show Linux distribution
        if [ -f /etc/os-release ]; then
            local distro_name=$(grep "^PRETTY_NAME=" /etc/os-release | cut -d'"' -f2)
            if [ -n "$distro_name" ]; then
                printf "  ${BLUE}◉${NC} ${GRAY}Distribution:${NC} ${BOLD}${distro_name}${NC}\n"
            fi
        fi

        # Show chip information (like macOS)
        local cpu_model=$(grep "^model name" /proc/cpuinfo 2>/dev/null | head -1 | cut -d':' -f2 | sed 's/^[[:space:]]*//')
        if [ -n "$cpu_model" ]; then
            printf "  ${BLUE}◉${NC} ${GRAY}Chip:${NC} ${BOLD}${cpu_model}${NC}\n"
        fi

        # Show RAM
        local ram_total=$(grep "^MemTotal:" /proc/meminfo 2>/dev/null | awk '{print int($2/1024/1024)}')
        if [ -n "$ram_total" ] && [ "$ram_total" -gt 0 ]; then
            printf "  ${BLUE}◉${NC} ${GRAY}RAM:${NC} ${BOLD}${ram_total} GB${NC}\n"
        fi

        # Show disk space
        local disk_avail=$(df -h / 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G$/ GB/; s/M$/ MB/; s/T$/ TB/; s/K$/ KB/')
        if [ -n "$disk_avail" ]; then
            printf "  ${BLUE}◉${NC} ${GRAY}Disk Available:${NC} ${BOLD}${disk_avail}${NC}\n"
        fi
    fi

    printf "  ${BLUE}◉${NC} ${GRAY}Shell:${NC} ${BOLD}${SHELL}${NC}\n"

    # Check macOS compatibility and prompt if needed
    if [ "$MACOS_COMPATIBLE" = "no" ]; then
        printf "\n"
        printf "${YELLOW}⚠${NC}  ${BOLD}Compatibility Warning${NC}\n"
        # DISABLED: Docker Desktop support
        # printf "  ${GRAY}Docker Desktop requires macOS 10.15 (Catalina) or later${NC}\n"
        printf "  ${GRAY}Your version (${BOLD}${MACOS_VERSION}${NC}${GRAY}) may not be fully supported${NC}\n"
        printf "\n"
        printf "  ${CYAN}ℹ${NC} Continue installation anyway? ${GRAY}[y/N]${NC} "
        read -r response || response="n"
        if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
            printf "\n"
            error "Installation cancelled - please upgrade to macOS 10.15 or later"
        fi
        printf "  ${YELLOW}⚠${NC} Proceeding with potentially incompatible macOS version\n"
    fi

    # Smart path detection: check if we're already in a GraphDone directory
    if [ -f "package.json" ] && grep -q "\"name\": \"graphdone\"" package.json 2>/dev/null; then
        # We're running from within GraphDone directory (local run)
        GRAPHDONE_CHECK_DIR="$(pwd)"
        FRESH_INSTALL=false
    else
        # Fresh installation or running from outside - use standard location
        GRAPHDONE_CHECK_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"
        FRESH_INSTALL=true
    fi

    # Modern installation section with progress
    INSTALL_DIR="$GRAPHDONE_CHECK_DIR"

    # ─────────────────────────────────────────────────────────────────────
    # SECTION 3: Dependency Checks
    # ─────────────────────────────────────────────────────────────────────
    # Checks and installs Git, Node.js, Docker if needed
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🔰 Dependency Checks${NC}  ${TEAL}────────────────────────────────────────${NC}\n"
    printf "\n"

    # Request sudo once for all Linux installations (Homebrew pattern)
    request_sudo_linux

    # Save cursor position right after the header - this is our "safe point"
    # Everything below this can be cleared and rewritten without touching the header

    # Run dependency checks BEFORE trying to download/update code
    check_and_prompt_git
    check_and_prompt_nodejs
    check_and_prompt_docker

    # Brief pause for smooth transition
    sleep 0.5

    printf "  ${GREEN}✓ All dependencies verified${NC}\n"

    # ─────────────────────────────────────────────────────────────────────
    # SECTION 4: Code Installation
    # ─────────────────────────────────────────────────────────────────────
    # Clones/updates GraphDone repository and installs npm dependencies
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}📡 Code Installation${NC}  ${TEAL}────────────────────────────────────────${NC}\n"
    # Target line with exact 88-character content area
    target_content="${BLUE}◉${NC} ${GRAY}Target:${NC} ${BOLD}$INSTALL_DIR${NC}"
    target_plain="◉ Target: $INSTALL_DIR"
    target_spaces=$((88 - ${#target_plain}))
    if [ $target_spaces -lt 0 ]; then target_spaces=0; fi
    target_padding=$(printf "%*s" $target_spaces "")
    echo "  ${target_content}"

    # Download or update with animated progress
    if [ -d "$INSTALL_DIR/.git" ]; then
        # Mode line with exact 88-character content area
        mode_content="${BLUE}◉${NC} ${GRAY}Mode:${NC} ${YELLOW}Update existing${NC}"
        mode_plain="◉ Mode: Update existing"
        mode_spaces=$((88 - ${#mode_plain}))
        if [ $mode_spaces -lt 0 ]; then mode_spaces=0; fi
        mode_padding=$(printf "%*s" $mode_spaces "")
        echo "  ${mode_content}"

        cd "$INSTALL_DIR"

        # Run git pull in background to show progress
        git pull --quiet >/dev/null 2>&1 &
        pull_pid=$!

        # Add pink color for the circle
        PINK='\033[38;5;213m'

        # Pink blinking circle during entire fetching process
        blink_state=0

        # Continue blinking and adding dots until fetch is complete
        for cycle in 1 2 3 4 5 6; do
            # Toggle blink state
            if [ $blink_state -eq 0 ]; then
                circle="${PINK}•${NC}"
                blink_state=1
            else
                circle="${DIM}•${NC}"
                blink_state=0
            fi

            # Build the dots display based on cycle
            dots_display=""
            if [ $cycle -ge 3 ]; then
                dots_display=" ${GRAY}●${NC}"
            fi
            if [ $cycle -ge 5 ]; then
                dots_display="$dots_display ${BLUE}●${NC}"
            fi
            if [ $cycle -eq 6 ]; then
                dots_display="$dots_display ${CYAN}●${NC}"
            fi

            # Show current state - animation only, no box borders
            printf "\r  $circle ${GRAY}Fetching latest changes${NC}$dots_display"
            # Clear to end of line to avoid artifacts
            printf "\033[K"
            sleep 0.4

            # Break if fetch is complete
            kill -0 $pull_pid 2>/dev/null || break
        done

        # Continue waiting if still running
        while kill -0 $pull_pid 2>/dev/null; do
            # Toggle blink state
            if [ $blink_state -eq 0 ]; then
                circle="${PINK}•${NC}"
                blink_state=1
            else
                circle="${DIM}•${NC}"
                blink_state=0
            fi

            # Keep the full dots display
            dots_display=" ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC}"

            # Show current state
            printf "\r  $circle ${GRAY}Fetching latest changes${NC}$dots_display"
            printf "\033[K"
            sleep 0.4
        done

        # Smooth transition: show completion state briefly
        printf " ${GREEN}●${NC}"
        sleep 0.3
        wait $pull_pid

        # Success line with exact 88-character content area
        success_content="${GREEN}✓${NC} ${BOLD}Updated${NC} ${GREEN}to latest version${NC}"
        success_plain="✓ Updated to latest version"
        success_spaces=$((88 - ${#success_plain}))
        if [ $success_spaces -lt 0 ]; then success_spaces=0; fi
        success_padding=$(printf "%*s" $success_spaces "")
        printf "\r  ${success_content}"
        printf "\033[K\n"
    else
        # Mode line with exact 88-character content area
        mode_content="${BLUE}◉${NC} ${GRAY}Mode:${NC} ${GREEN}Fresh installation${NC}"
        mode_plain="◉ Mode: Fresh installation"
        mode_spaces=$((88 - ${#mode_plain}))
        if [ $mode_spaces -lt 0 ]; then mode_spaces=0; fi
        mode_padding=$(printf "%*s" $mode_spaces "")
        echo "  ${mode_content}"

        # Clean up broken/incomplete directory if it exists
        if [ -d "$INSTALL_DIR" ]; then
            printf "  ${YELLOW}⚠${NC} Cleaning up incomplete installation\n"
            rm -rf "$INSTALL_DIR"
        fi

        # Show download progress
        printf "  ${BLUE}📦${NC} Downloading GraphDone"

        # Clone with progress - redirect to log file to capture any errors
        local clone_log="$LOG_DIR/git-clone-${INSTALL_TIMESTAMP}.log"
        git clone --progress --branch fix/first-start https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR" >"$clone_log" 2>&1 &
        clone_pid=$!

        # Single loop with timeout (no nested loops to avoid race conditions)
        local elapsed=0
        local max_wait=300  # 5 minutes max
        local spinner_chars="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

        while kill -0 $clone_pid 2>/dev/null; do
            # Check timeout
            if [ $elapsed -ge $max_wait ]; then
                kill -9 $clone_pid 2>/dev/null || true
                wait $clone_pid 2>/dev/null || true
                printf "\r\033[K"
                printf "  ${RED}✗${NC} ${BOLD}Download timed out after 5 minutes${NC}\n"
                if [ -f "$clone_log" ]; then
                    printf "\n${BOLD}Last 15 lines from log:${NC}\n"
                    tail -15 "$clone_log"
                fi
                rm -rf "$INSTALL_DIR" 2>/dev/null || true
                error "Git clone timed out - check network connection"
            fi

            # Show spinner (rotate through characters)
            local char_index=$((elapsed % 10))
            local spinner_char=$(printf "%s" "$spinner_chars" | cut -c$((char_index + 1)))
            printf "\r  ${BLUE}📦${NC} Downloading GraphDone ${CYAN}${spinner_char}${NC}"

            sleep 0.1
            elapsed=$((elapsed + 1))
        done

        wait $clone_pid
        clone_result=$?

        # Clear the line completely to prevent spinner artifacts
        printf "\r\033[K"

        # Check if clone succeeded
        if [ $clone_result -ne 0 ] || [ ! -d "$INSTALL_DIR/.git" ]; then
            printf "  ${RED}✗${NC} ${BOLD}Failed to download GraphDone${NC}\n"
            if [ -f "$clone_log" ]; then
                printf "\n${BOLD}Last 20 lines from clone log:${NC}\n"
                tail -20 "$clone_log"
            fi
            # Clean up partial clone
            rm -rf "$INSTALL_DIR" 2>/dev/null || true
            error "Git clone failed - check network connection and try again"
        fi

        # Success line with exact 88-character content area
        success_content="${GREEN}✓${NC} ${BOLD}Downloaded${NC} ${GREEN}GraphDone${NC}"
        success_plain="✓ Downloaded GraphDone"
        success_spaces=$((88 - ${#success_plain}))
        if [ $success_spaces -lt 0 ]; then success_spaces=0; fi
        success_padding=$(printf "%*s" $success_spaces "")
        printf "  ${success_content}\n"
    fi

    cd "$INSTALL_DIR"

    # Project dependencies check and install (after code is downloaded)
    # First show checking animation
    PINK='\033[38;5;213m'
    blink_state=0

    # Initial check animation (like Git/Node.js)
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"
        fi

        # Show checking animation
        printf "\r  $circle ${GRAY}Checking project dependencies${NC}$dots_display"
        printf "\033[K"
        sleep 0.4
    done

    # Smooth transition
    printf " ${GREEN}●${NC}"
    sleep 0.3

    # Now check if we need to install
    if [ ! -d "node_modules" ] || ! check_deps_fresh; then
        # Clear the checking line and show installing
        printf "\r\033[K"

        blink_state=0

        # Run npm install silently in background
        smart_npm_install &
        npm_pid=$!

        # Show installing animation
        for cycle in 1 2 3 4 5 6 7 8 9 10 11 12; do
            # Check if npm install is still running
            if ! kill -0 $npm_pid 2>/dev/null; then
                break
            fi

            # Toggle blink state for bullet
            if [ $blink_state -eq 0 ]; then
                circle="${PINK}•${NC}"
                blink_state=1
            else
                circle="${DIM}•${NC}"
                blink_state=0
            fi

            # Build the dots display based on cycle
            dots_display=""
            if [ $cycle -ge 3 ]; then
                dots_display=" ${GRAY}●${NC}"
            fi
            if [ $cycle -ge 5 ]; then
                dots_display="$dots_display ${BLUE}●${NC}"
            fi
            if [ $cycle -ge 6 ]; then
                dots_display="$dots_display ${CYAN}●${NC}"
            fi

            # Show current state
            printf "\r  $circle ${GRAY}Installing project dependencies${NC}$dots_display"
            sleep 0.4
        done

        # Continue waiting if still running
        while kill -0 $npm_pid 2>/dev/null; do
            # Toggle blink state for bullet
            if [ $blink_state -eq 0 ]; then
                circle="${PINK}•${NC}"
                blink_state=1
            else
                circle="${DIM}•${NC}"
                blink_state=0
            fi

            # Keep the same 3 dots
            dots_display=" ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC}"

            # Show current state
            printf "\r  $circle ${GRAY}Installing project dependencies${NC}$dots_display"
            sleep 0.4
        done

        # Smooth transition: show completion state briefly
        printf " ${GREEN}●${NC}"
        sleep 0.3

        wait $npm_pid
        npm_exit_code=$?

        printf "\r\033[K"  # Clear entire line

        if [ $npm_exit_code -eq 0 ]; then
            update_deps_hash
            printf "  ${GREEN}✓${NC} Project dependencies installed%-60s\n" " "
        else
            printf "  ${RED}✗${NC} Failed to install project dependencies%-50s\n" " "
            error "Dependency installation failed"
        fi
    else
        # Dependencies are cached and up-to-date
        printf "\r\033[K"
        printf "  ${GREEN}✓${NC} Project dependencies up to date (cached)%-35s\n" " "
    fi

    # Environment setup
    if [ ! -f ".env" ]; then
        # ─────────────────────────────────────────────────────────────────────
        # SECTION 5: Environment Configuration
        # ─────────────────────────────────────────────────────────────────────
        # Copies .env.example to .env if not exists
        printf "\n"
        printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}✳️  Environment Configuration${NC}  ${TEAL}────────────────────────────────${NC}\n"
        printf "  ${GRAY}▸${NC} Configuring environment\n"
        cat > .env << 'EOF'
NODE_ENV=production
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=graphdone_password
GRAPHQL_PORT=4128
HTTPS_PORT=4128
WEB_PORT=3128
SSL_ENABLED=true
SSL_KEY_PATH=./deployment/certs/server-key.pem
SSL_CERT_PATH=./deployment/certs/server-cert.pem
EOF
        printf "  ${GREEN}✓${NC} Environment configured\n"
    fi

    # ─────────────────────────────────────────────────────────────────────
    # SECTION 6: Security Initialization
    # ─────────────────────────────────────────────────────────────────────
    # Generates HTTPS certificates for secure connections
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🔐 Security Initialization${NC}  ${TEAL}──────────────────────────────────${NC}\n"
    if [ ! -f "deployment/certs/server-cert.pem" ]; then
        printf "  ${GRAY}▸${NC} Generating TLS certificates\n"
        mkdir -p deployment/certs || error "Failed to create certificate directory"
        openssl req -x509 -newkey rsa:4096 -nodes -keyout deployment/certs/server-key.pem -out deployment/certs/server-cert.pem -days 365 -subj '/CN=localhost' >/dev/null 2>&1 || error "Failed to generate certificates"

        # Set proper permissions: 600 for private key, 644 for certificate
        chmod 600 deployment/certs/server-key.pem 2>/dev/null || true
        chmod 644 deployment/certs/server-cert.pem 2>/dev/null || true

        printf "  ${GREEN}✓${NC} TLS certificates generated with secure permissions\n"
    else
        # Verify and fix permissions on existing certificates
        if [ -f "deployment/certs/server-key.pem" ]; then
            chmod 600 deployment/certs/server-key.pem 2>/dev/null || true
        fi
        if [ -f "deployment/certs/server-cert.pem" ]; then
            chmod 644 deployment/certs/server-cert.pem 2>/dev/null || true
        fi
        printf "  ${GREEN}✓${NC} TLS certificates already exist\n"
    fi
    printf "\n"
    # ─────────────────────────────────────────────────────────────────────
    # SECTION 7: Services Status
    # ─────────────────────────────────────────────────────────────────────
    # Checks if Docker containers are already running
    # Smart dependency management with MD5 hash-based caching
    # Only installs if node_modules is missing or package.json has changed
    # For updates, this was already done during Node.js check
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}💹 Services Status${NC}  ${TEAL}──────────────────────────────────────────${NC}\n"

    # Check if services are already running
    if check_containers_healthy; then
        printf "  ${GREEN}✓${NC} Services already running\n"
        printf "\n"
        show_success_in_box
        return 0
    fi
    printf "  ${BLUE}◉${NC} Starting fresh services\n"

    # ─────────────────────────────────────────────────────────────────────
    # SECTION 8: Container Cleanup
    # ─────────────────────────────────────────────────────────────────────
    # Stops and removes old containers before fresh deployment
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🗑️  Container Cleanup${NC}  ${TEAL}────────────────────────────────────────${NC}\n"

    # Try both docker-compose and docker compose for compatibility
    if command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE="docker compose"
    fi

    # Clean up existing containers with progress
    printf "  ${BLUE}♻${NC} Cleaning up existing containers\n"
    $DOCKER_COMPOSE -f deployment/docker-compose.yml down --remove-orphans >/dev/null 2>&1 || true
    $DOCKER_COMPOSE -f deployment/docker-compose.registry.yml down --remove-orphans >/dev/null 2>&1 || true

    # Check for port conflicts and resolve them
    printf "  ${BLUE}◉${NC} Checking for port conflicts\n"
    GRAPHDONE_PORTS="3127 3128 4127 4128 6379 7474 7687"
    CONFLICTS_FOUND=false

    for port in $GRAPHDONE_PORTS; do
        if lsof -ti:$port >/dev/null 2>&1; then
            # Check if process is a Docker container (don't kill those)
            process_info=$(lsof -i:$port 2>/dev/null | grep -v COMMAND | head -1)
            if echo "$process_info" | grep -q "docker\|com.docke"; then
                # This is a Docker process, skip it (docker-compose will handle cleanup)
                continue
            fi

            if [ "$CONFLICTS_FOUND" = false ]; then
                printf "  ${YELLOW}⚠${NC} Port conflicts detected, resolving\n"
                CONFLICTS_FOUND=true
            fi
            printf "    ${YELLOW}⚠${NC} Port $port is in use by non-Docker process\n"
            pids=$(lsof -ti:$port 2>/dev/null)
            if [ -n "$pids" ]; then
                # Try graceful shutdown first (SIGTERM)
                echo "$pids" | xargs kill -15 >/dev/null 2>&1 || true
                sleep 1
                # Check if still running
                if lsof -ti:$port >/dev/null 2>&1; then
                    # Force kill if graceful didn't work
                    printf "    ${RED}✗${NC} Forcing process termination on port $port\n"
                    echo "$pids" | xargs kill -9 >/dev/null 2>&1 || true
                    sleep 0.5
                fi
            fi
            # Verify port is now free
            if lsof -ti:$port >/dev/null 2>&1; then
                printf "    ${RED}⚠${NC} Port $port still in use (may be system process)\n"
            else
                printf "    ${GREEN}✓${NC} Port $port freed\n"
            fi
        fi
    done

    if [ "$CONFLICTS_FOUND" = false ]; then
        printf "  ${GREEN}✓${NC} No port conflicts detected\n"
    else
        # If ports were freed, give Docker daemon time to stabilize
        printf "  ${BLUE}⏳${NC} Waiting for Docker daemon to stabilize\n"
        sleep 5

        # Ensure Docker daemon is ready before pulling images
        i=0
        attempts=0
        max_attempts=60
        while [ $attempts -lt $max_attempts ]; do
            # Check Docker status every 13 spinner cycles (roughly 2 seconds)
            if [ $((i % 13)) -eq 0 ]; then
                { docker info >/dev/null 2>&1; } 2>/dev/null && docker_ready=0 || docker_ready=1
                if [ $docker_ready -eq 0 ]; then
                    printf "\r  ${GREEN}✓${NC} Docker is ready \n"
                    break
                fi
                attempts=$((attempts + 1))
            fi

            # Show spinner
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
            printf "\r  ${YELLOW}◉${NC} Waiting for Docker to be ready ${BOLD}${CYAN}%s${NC}" "$spin_char"
            i=$((i + 1))
            sleep 0.15
        done

        if [ $attempts -ge $max_attempts ]; then
            printf "\r\033[K"
            printf "  ${RED}⚠${NC} Docker daemon not responding after 2 minutes\n"
            # DISABLED: Docker Desktop support
            printf "  ${YELLOW}⚠${NC} Please ensure OrbStack Docker is running and try again\n"
            exit 1
        fi
    fi

    # Smart deployment detection with animated progress
    # Test for pre-built containers in background
    docker pull ghcr.io/graphdone/graphdone-web:fix-first-start >/dev/null 2>&1 &
    check_pid=$!

    # Add pink color for the circle
    PINK='\033[38;5;213m'

    # Pink blinking circle during entire checking process
    blink_state=0

    # Continue blinking and adding dots until check is complete
    for cycle in 1 2 3 4 5 6; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Build the dots display based on cycle
        dots_display=""
        if [ $cycle -ge 3 ]; then
            dots_display=" ${GRAY}●${NC}"
        fi
        if [ $cycle -ge 5 ]; then
            dots_display="$dots_display ${BLUE}●${NC}"
        fi
        if [ $cycle -eq 6 ]; then
            dots_display="$dots_display ${CYAN}●${NC}"
        fi

        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking deployment strategy${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4

        # Break if check is complete
        kill -0 $check_pid 2>/dev/null || break
    done

    # Continue waiting if still running
    while kill -0 $check_pid 2>/dev/null; do
        # Toggle blink state
        if [ $blink_state -eq 0 ]; then
            circle="${PINK}•${NC}"
            blink_state=1
        else
            circle="${DIM}•${NC}"
            blink_state=0
        fi

        # Keep the full dots display
        dots_display=" ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC}"

        # Show current state
        printf "\r  $circle ${GRAY}Checking deployment strategy${NC}$dots_display"
        printf "\033[K"
        sleep 0.4
    done

    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3

    wait $check_pid
    check_result=$?

    if [ $check_result -eq 0 ]; then
        printf "\r  ${GREEN}✓${NC} ${GRAY}Strategy:${NC} ${BOLD}Pre-built containers${NC} ${GREEN}(fast deployment)${NC}\n"
        COMPOSE_FILE="deployment/docker-compose.registry.yml"
        DEPLOYMENT_MODE="registry"
    else
        printf "\r  ${GREEN}✓${NC} ${GRAY}Strategy:${NC} ${BOLD}Build from source${NC} ${YELLOW}(longer setup)${NC}\n"
        COMPOSE_FILE="deployment/docker-compose.yml"
        DEPLOYMENT_MODE="local"
    fi


    # ─────────────────────────────────────────────────────────────────────
    # SECTION 9: Service Deployment
    # ─────────────────────────────────────────────────────────────────────
    # Starts Docker Compose services (Neo4j, Redis, API, Web)
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🔆 Service Deployment${NC}  ${TEAL}───────────────────────────────────────${NC}\n"

    if [ "$DEPLOYMENT_MODE" = "registry" ]; then
        printf "  ${BLUE}◉${NC} ${GRAY}Mode:${NC} ${BOLD}Registry deployment${NC}\n"
        printf "  ${BLUE}◉${NC} ${GRAY}Images:${NC} Pre-built containers from ghcr.io/graphdone\n"
    else
        printf "  ${BLUE}◉${NC} ${GRAY}Mode:${NC} ${BOLD}Source build${NC}\n"
        printf "  ${BLUE}◉${NC} ${GRAY}Build:${NC} Local container compilation\n"
    fi


    # Start services in background with progress animation
    if [ -f "$COMPOSE_FILE" ]; then
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d >/dev/null 2>&1 &
    else
        # Fallback to default compose file
        $DOCKER_COMPOSE -f deployment/docker-compose.yml up -d >/dev/null 2>&1 &
    fi

    startup_pid=$!

    # Service startup animation with service names (POSIX-compliant)
    services="neo4j redis api web"
    i=0
    service_index=0

    while kill -0 $startup_pid 2>/dev/null; do
        # Get current service from space-separated list
        set -- $services
        shift $((service_index % 4))
        current_service=$1
        spin_char=""
        # Get spinner character
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

        # Only update the service name and spinner, not the whole line
        printf "\r  ${VIOLET}◉${NC} Starting graphdone-${current_service} ${BOLD}${CYAN}%s${NC}" "$spin_char"

        i=$((i + 1))
        # Change service name every 8 iterations
        if [ $((i % 8)) -eq 0 ]; then
            service_index=$((service_index + 1))
        fi
        sleep 0.15
    done

    wait $startup_pid
    startup_result=$?

    if [ $startup_result -eq 0 ]; then
        printf "\r  ${GREEN}✓${NC} ${BOLD}All services started successfully${NC}\n"
    else
        printf "\r  ${RED}✗${NC} ${BOLD}Service startup failed${NC}\n"
        error "Failed to start services"
    fi

    # Wait for services to be ready (more reliable than smart-start's 8 second sleep)
    if wait_for_services; then
        printf "  ${GREEN}✓${NC} Services are ready and healthy\n"
        printf "  ${GREEN}✓${NC} Installation complete\n"
    else
        printf "  ${YELLOW}!${NC} Services started but initialization taking longer\n"
    fi

    # Installation successful - disable cleanup trap for normal files
    CLEANUP_NEEDED=false

    # Continue with success info
    show_success_in_box
}


# ############################################################################
# ############################################################################
# ##                                                                        ##
# ##              SUCCESS UI & COMMAND HANDLER COMPONENT                    ##
# ##                                                                        ##
# ############################################################################
# ############################################################################
#
# This section handles success messages and command-line argument processing.
#
# Components:
#   - show_success_in_box() - Beautiful success message with URLs and commands
#   - show_success() - Legacy function (unused)
#   - Command handler (case statement) - Process install/stop/remove commands
#
# Success Message includes:
#   - GraphDone Ready banner
#   - Access URLs (Web App, GraphQL API, Database)
#   - Management commands (cd, stop, remove)
#
# Command-line arguments:
#   install (default) - Run full installation
#   stop             - Stop all GraphDone services
#   remove           - Complete cleanup and reset
#
# ############################################################################

# Continue the box with success information
show_success_in_box() {
    # Use same color definitions for consistency
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        # 256-color mode
        TEAL="\033[38;5;37m"     # Cyan/teal color
        LIGHTCYAN="\033[38;5;87m" # Light cyan
    else
        # Fallback to basic ANSI colors
        TEAL="\033[0;36m"        # Basic cyan
        LIGHTCYAN="\033[0;96m"   # Bright cyan
    fi
    NC="\033[0m"      # No Color (reset)
    GREEN="\033[38;5;154m"   # Yellowgreen for checkmarks (256-color, #9acd32)
    GRAY="\033[38;5;244m"   # Gray for progress indicators (256-color)
    CYAN="\033[38;5;51m"    # Cyan for labels (256-color)
    BOLD="\033[1m"          # Bold text
    INSTALL_DIR="$GRAPHDONE_CHECK_DIR"

    # Open the big success box
    printf "\n\n"
    printf "${TEAL}╔══════════════════════════════════════════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│${GREEN}${BOLD}                                   🏆 GraphDone Ready ✓${NC}                                     ${TEAL}│${NC}  ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}└────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"

    # Access URLs section in same box with inner box
    printf "${TEAL}║                                      🌐 Access URLs                                              ║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}Web App:${NC}    https://localhost:3128                                                        ${TEAL}│${NC}  ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}GraphQL:${NC}    https://localhost:4128/graphql                                                ${TEAL}│${NC}  ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}Database:${NC}   http://localhost:7474                                                         ${TEAL}│${NC}  ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}└────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"

    # Management commands section in same box with inner box
    printf "${TEAL}║                                      🧰 Management Commands                                      ║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    # Format cd command with proper padding
    CD_CMD="cd $INSTALL_DIR"
    # Truncate if too long
    if [ $(printf "%s" "$CD_CMD" | wc -c) -gt 85 ]; then
        CD_CMD="cd ...$(echo "$INSTALL_DIR" | sed 's/.*\(.\{75\}\)$/\1/')"
    fi
    CMD_LEN=$(printf "%s" "$CD_CMD" | wc -c)
    CD_PADDING=""
    # 90 chars total (accounting for the 2 spaces after │)
    PAD_COUNT=$((90 - CMD_LEN))
    while [ $PAD_COUNT -gt 0 ]; do
        CD_PADDING="$CD_PADDING "
        PAD_COUNT=$((PAD_COUNT - 1))
    done
    printf "${TEAL}║  ${TEAL}│  ${GRAY}%s${NC}%s${TEAL}│${NC}  ${TEAL}║${NC}\n" "$CD_CMD" "$CD_PADDING"
    printf "${TEAL}║  ${TEAL}│  ${GRAY}sh public/install.sh stop     ${NC}${GRAY}# Stop services${NC}                                             ${TEAL}│${NC}  ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${GRAY}sh public/install.sh remove   ${NC}${GRAY}# Complete reset${NC}                                            ${TEAL}│${NC}  ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}└────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"

    # Close the big box
    printf "${TEAL}╚══════════════════════════════════════════════════════════════════════════════════════════════════╝${NC}\n\n"
}

# Show success message (old function - no longer used)
show_success() {
    show_success_in_box
}

# Handle command line arguments
COMMAND="${1:-install}"

case "$COMMAND" in
    stop)
        stop_services
        ;;
    remove)
        remove_services
        ;;
    install|"")
        install_graphdone
        ;;
    *)
        error "Unknown command: $COMMAND. Use: install, stop, or remove"
        ;;
esac
