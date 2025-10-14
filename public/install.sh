#!/bin/sh
# GraphDone Installation Script - Professional One-Liner Setup
# 
# Usage with curl:
#   curl -fsSL https://graphdone.com/install.sh | sh
#
# Usage with wget:
#   wget -qO- https://graphdone.com/install.sh | sh
#
# Or download and run:
#   wget https://graphdone.com/install.sh && sh install.sh

set -e

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

# Modern color palette using 256-color codes for better compatibility
if [ -t 1 ]; then
    if [ "$(tput colors 2>/dev/null)" -ge 256 ] 2>/dev/null; then
        # 256-color mode
        CYAN='\033[38;5;51m'
        GREEN='\033[38;5;154m'
        YELLOW='\033[38;5;220m'
        PURPLE='\033[38;5;135m'
        BLUE='\033[38;5;33m'
        GRAY='\033[38;5;244m'
        RED='\033[38;5;196m'
    else
        # Fallback to basic ANSI
        CYAN='\033[0;36m'
        GREEN='\033[38;5;154m'
        YELLOW='\033[0;33m'
        PURPLE='\033[0;35m'
        BLUE='\033[0;34m'
        GRAY='\033[0;90m'
        RED='\033[0;31m'
    fi
    BOLD='\033[1m'
    DIM='\033[2m'
    NC='\033[0m'
else
    CYAN='' GREEN='' YELLOW='' PURPLE='' BLUE='' GRAY='' RED='' BOLD='' DIM='' NC=''
fi

# Clean, minimal functions
log() { printf "${GRAY}▸${NC} %s\n" "$1"; }
ok() { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$1"; }
error() { 
    printf "${RED}✗${NC} %s\n" "$1" >&2
    CLEANUP_NEEDED=true
    cleanup
    exit 1
}

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
            read -r response < /dev/tty 2>/dev/null || response="n"
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
            read -r response < /dev/tty 2>/dev/null || response="n"
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                error "Installation cancelled - network required"
            fi
        fi
    elif command -v wget >/dev/null 2>&1; then
        if ! wget -q --timeout=5 --spider "$test_url" 2>/dev/null; then
            warn "Network connectivity test failed"
            printf "${CYAN}ℹ${NC} This may cause download failures. Continue? ${GRAY}[y/N]${NC} "
            read -r response < /dev/tty 2>/dev/null || response="n"
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                error "Installation cancelled - network required"
            fi
        fi
    fi
}

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


# Fancy dots spinner function for installation steps
show_spinner() {
    pid=$1
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    i=0
    
    while kill -0 $pid 2>/dev/null; do
        printf " ${YELLOW}${spin:i:1}${NC}"
        i=$(( (i+1) % ${#spin} ))
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
        printf "\r${GRAY}▸${NC} %s ${YELLOW}${spin:i:1}${NC}" "$message"
        i=$(( (i+1) % ${#spin} ))
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

# Platform detection
detect_platform() {
    case "$(uname)" in
        Darwin*)
            PLATFORM="macos"
            ;;
        Linux*)
            PLATFORM="linux"
            ;;
        *BSD*)
            PLATFORM="bsd"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            PLATFORM="windows"
            ;;
        *)
            PLATFORM="unknown"
            ;;
    esac
}




# Interactive Git check with animated progress
check_and_prompt_git() {
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
    
    if [ "$check_result" = "current" ]; then
        # Get full version info
        GIT_VERSION_FULL=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
        
        # Format the line to match last box alignment
        local git_display="${GREEN}✓${NC} ${BOLD}Git${NC} ${GREEN}${GIT_VERSION_FULL}${NC} ${GRAY}already installed${NC}"
        local git_plain="✓ Git ${GIT_VERSION_FULL} already installed"
        local padding=$((90 - ${#git_plain}))
        printf "\r  ${git_display}%*s\n" $padding ""
        return 0
    elif [ "$check_result" = "apple_git" ]; then
        GIT_VERSION_OLD=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
        printf "\r  ${YELLOW}⚠${NC} ${BOLD}Git${NC} ${YELLOW}${GIT_VERSION_OLD}${NC} ${GRAY}(Apple's bundled version)${NC}%-40s\n" " "
        
        printf "        ${YELLOW}🟡 ${BOLD}Git Update Recommended${NC}\n"
        # Try to fetch latest version from Homebrew (macOS only)
        LATEST_GIT_VERSION=""
        if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
            LATEST_GIT_VERSION=$(brew info git 2>/dev/null | head -n 1 | sed 's/.*stable \([0-9.]*\).*/\1/' || echo "")
        fi
        if [ -n "$LATEST_GIT_VERSION" ]; then
            printf "        ${GRAY}Apple's bundled Git is outdated. Latest version is ${BOLD}${LATEST_GIT_VERSION}${NC}${GRAY}.${NC}\n\n"
        else
            printf "        ${GRAY}Apple's bundled Git is typically outdated. Homebrew provides the latest version.${NC}\n\n"
        fi
        printf "        ${GREEN}✓${NC} Install latest Git via Homebrew\n"
        printf "        ${GREEN}✓${NC} Get the newest features and performance improvements\n"
        printf "        ${GREEN}✓${NC} Better compatibility with modern repositories\n"
        printf "        ${GREEN}✓${NC} Zero manual configuration required\n\n"
        printf "        ${CYAN}❯${NC} ${BOLD}Upgrade to latest Git?${NC} ${GRAY}[Press Enter] or 'n' to skip${NC}\n"
        printf "        "
        read -r response < /dev/tty 2>/dev/null || response="" < /dev/tty 2>/dev/null || response="n"
        
        if [ "$response" != "n" ] && [ "$response" != "N" ]; then
            # Run the Git setup script
            if sh "scripts/setup_git.sh"; then
                # After successful installation, clear all output and show clean result
                # Clear approximately 27 lines (Git Update section + Git Installation Script)
                i=1
                while [ $i -le 27 ]; do
                    printf "\033[F\033[K"  # Move up and clear line
                    i=$((i + 1))
                done
                
                # Get the new Git version and show clean success message
                NEW_GIT_VERSION=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
                local git_success="${GREEN}✓${NC} ${BOLD}Git${NC} upgraded to ${GREEN}${NEW_GIT_VERSION}${NC} successfully"
                local git_success_plain="✓ Git upgraded to ${NEW_GIT_VERSION} successfully"
                local padding=$((90 - ${#git_success_plain}))
                printf "  ${git_success}%*s\n" $padding ""
            else
                printf "${RED}✗${NC} Git setup failed\n"
                printf "${CYAN}ℹ${NC} Continuing with Apple Git\n"
            fi
        else
            printf "${CYAN}ℹ${NC} Continuing with Apple Git ${GIT_VERSION_OLD}\n"
        fi
        return 0
    elif [ "$check_result" = "outdated" ]; then
        GIT_VERSION_OLD=$(git --version 2>/dev/null | sed 's/git version //' || echo "unknown")
        printf "\r${YELLOW}⚠${NC} ${BOLD}Git${NC} ${YELLOW}${GIT_VERSION_OLD}${NC} ${GRAY}outdated (need >= 2.30)${NC}"
        printf "                    \n\n"
        
        printf "${YELLOW}🟡 ${BOLD}Git Update Required${NC}\n"
        printf "${GRAY}GraphDone requires Git >= 2.30 for modern features.${NC}\n\n"
        printf "${GREEN}✓${NC} We'll use the dedicated Git setup script for your platform\n"
        printf "${GREEN}✓${NC} Automatic upgrade to latest version\n"
        printf "${GREEN}✓${NC} Zero manual configuration required\n\n"
        printf "${CYAN}❯${NC} ${BOLD}Continue with Git upgrade?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
        read -r response < /dev/tty 2>/dev/null || response="" < /dev/tty 2>/dev/null || response="n"
        
        # Run the Git setup script
        if sh "scripts/setup_git.sh"; then
            printf "\n"
        else
            printf "${RED}✗${NC} Git setup failed\n"
            exit 1
        fi
        return 0
    fi
    
    printf "\n${YELLOW}🟡 ${BOLD}Git Setup Required${NC}\n"
    printf "${GRAY}GraphDone requires Git for version control and cloning repositories.${NC}\n\n"
    printf "${GREEN}✓${NC} We'll use the dedicated Git setup script for your platform\n"
    printf "${GREEN}✓${NC} Automatic installation via package manager\n"
    printf "${GREEN}✓${NC} Includes latest stable version\n"
    printf "${GREEN}✓${NC} Zero manual configuration required\n\n"
    printf "${CYAN}❯${NC} ${BOLD}Continue with Git installation?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
    read -r response < /dev/tty 2>/dev/null || response=""
    
    # Run the Git setup script (skip redundant check)
    if sh "scripts/setup_git.sh" --skip-check; then
        printf "\n"
    else
        printf "${RED}✗${NC} Git setup failed\n"
        exit 1
    fi
    
    return 0
}


# Interactive Node.js check with animated progress
check_and_prompt_nodejs() {
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
            # Perform the check on final cycle - check if Node.js is installed with correct version
            if command -v node >/dev/null 2>&1; then
                NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
                if [ "$NODE_VERSION" -ge 18 ]; then
                    # Check npm version too
                    if command -v npm >/dev/null 2>&1; then
                        NPM_VERSION=$(npm --version 2>/dev/null | cut -d. -f1 || echo "0")
                        if [ "$NPM_VERSION" -ge 9 ]; then
                            check_result="current"  # Node.js and npm are current
                        else
                            check_result="npm_old"  # Node.js OK but npm outdated
                        fi
                    else
                        check_result="npm_missing"  # Node.js OK but npm missing
                    fi
                else
                    check_result="outdated"  # Node.js outdated
                fi
            else
                check_result="missing"  # Node.js not installed
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
    
    if [ "$check_result" = "current" ]; then
        # Get full version info
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")
        NPM_VERSION_FULL=$(npm --version 2>/dev/null || echo "unknown")
        
        # Format the line to match last box alignment
        local node_display="${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}and${NC} ${BOLD}npm${NC} ${GREEN}${NPM_VERSION_FULL}${NC} ${GRAY}already installed${NC}"
        local node_plain="✓ Node.js ${NODE_VERSION_FULL} and npm ${NPM_VERSION_FULL} already installed"
        local padding=$((90 - ${#node_plain}))
        printf "\r  ${node_display}%*s\n" $padding ""
        return 0
    elif [ "$check_result" = "npm_old" ] || [ "$check_result" = "npm_missing" ]; then
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")
        printf "\r${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}OK, but npm needs update${NC}"
        printf "                    \n\n"
        
        printf "        ${YELLOW}🟡 ${BOLD}npm Update Required${NC}\n"
        printf "        ${GRAY}Node.js is current but npm needs to be updated to >= 9.0.0${NC}\n\n"
        printf "        ${GREEN}✓${NC} We'll use the dedicated Node.js setup script to update npm\n"
        printf "        ${GREEN}✓${NC} Zero manual intervention required\n\n"
        printf "        ${CYAN}❯${NC} ${BOLD}Continue with npm update?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
        printf "        "
        read -r response < /dev/tty 2>/dev/null || response="" < /dev/tty 2>/dev/null || response="n"
        
        # Run the Node.js setup script
        if sh "scripts/setup_nodejs.sh"; then
            # After successful installation, clear all output and show clean result
            # Clear exactly 15 lines (checking animation + npm Update section + Node.js setup output)
            i=1
            while [ $i -le 15 ]; do
                printf "\033[F\033[K"  # Move up and clear line
                i=$((i + 1))
            done
            
            # Get the new Node.js and npm versions
            NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
            NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
            local node_success="${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} updated successfully"
            local node_success_plain="✓ Node.js ${NEW_NODE_VERSION} and npm ${NEW_NPM_VERSION} updated successfully"
            local padding=$((90 - ${#node_success_plain}))
            printf "  ${node_success}%*s\n" $padding ""
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            exit 1
        fi
        return 0
    elif [ "$check_result" = "outdated" ]; then
        NODE_VERSION_OLD=$(node --version 2>/dev/null || echo "unknown")
        printf "\r${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${YELLOW}${NODE_VERSION_OLD}${NC} ${GRAY}outdated (need >= 18.0.0)${NC}"
        printf "                    \n\n"
        
        printf "        ${YELLOW}🟡 ${BOLD}Node.js Update Required${NC}\n"
        printf "        ${GRAY}GraphDone requires Node.js >= 18.0.0 for optimal performance.${NC}\n\n"
        printf "        ${GREEN}✓${NC} We'll use the dedicated Node.js setup script for your platform\n"
        printf "        ${GREEN}✓${NC} Automatic installation of latest version\n"
        printf "        ${GREEN}✓${NC} Zero manual configuration required\n\n"
        printf "        ${CYAN}❯${NC} ${BOLD}Continue with Node.js upgrade?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
        printf "        "
        read -r response < /dev/tty 2>/dev/null || response="" < /dev/tty 2>/dev/null || response="n"
        
        # Run the Node.js setup script
        if sh "scripts/setup_nodejs.sh"; then
            # After successful installation, clear all output and show clean result
            # Clear exactly 16 lines (checking animation + Node.js Update section + Node.js setup output)
            i=1
            while [ $i -le 16 ]; do
                printf "\033[F\033[K"  # Move up and clear line
                i=$((i + 1))
            done
            
            # Get the new Node.js and npm versions
            NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
            NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
            local node_success="${GREEN}✓${NC} ${BOLD}Node.js${NC} upgraded to ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} successfully"
            local node_success_plain="✓ Node.js upgraded to ${NEW_NODE_VERSION} and npm ${NEW_NPM_VERSION} successfully"
            local padding=$((90 - ${#node_success_plain}))
            printf "  ${node_success}%*s\n" $padding ""
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            exit 1
        fi
        return 0
    fi
    
    printf "\n        ${YELLOW}🟡 ${BOLD}Node.js Setup Required${NC}\n"
    printf "        ${GRAY}GraphDone requires Node.js >= 18.0.0 and npm >= 9.0.0 for development.${NC}\n\n"
    printf "        ${GREEN}✓${NC} We'll use the dedicated Node.js setup script for your platform\n"
    printf "        ${GREEN}✓${NC} Automatic installation of latest version\n"
    printf "        ${GREEN}✓${NC} Includes npm package manager automatically\n"
    printf "        ${GREEN}✓${NC} Zero manual configuration required\n\n"
    printf "        ${CYAN}❯${NC} ${BOLD}Continue with Node.js installation?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
    printf "        "
    read -r response < /dev/tty 2>/dev/null || response=""
    
    # Run the Node.js setup script (skip redundant check)
    if sh "scripts/setup_nodejs.sh" --skip-check; then
        # After successful installation, clear all output and show clean result
        # Clear exactly 18 lines (checking animation + Node.js Setup section + Node.js setup output)
        i=1
        while [ $i -le 18 ]; do
            printf "\033[F\033[K"  # Move up and clear line
            i=$((i + 1))
        done
        
        # Get the new Node.js and npm versions
        NEW_NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
        NEW_NPM_VERSION=$(npm --version 2>/dev/null || echo "unknown")
        local node_success="${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NEW_NODE_VERSION}${NC} and ${BOLD}npm${NC} ${GREEN}${NEW_NPM_VERSION}${NC} installed successfully"
        local node_success_plain="✓ Node.js ${NEW_NODE_VERSION} and npm ${NEW_NPM_VERSION} installed successfully"
        local padding=$((90 - ${#node_success_plain}))
        printf "  ${node_success}%*s\n" $padding ""
    else
        printf "${RED}✗${NC} Node.js setup failed\n"
        exit 1
    fi
    
    return 0
}


# Interactive Docker check with animated progress like Node.js
check_and_prompt_docker() {
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
            # Perform the check on final cycle - check if Docker is installed AND running
            if command -v docker >/dev/null 2>&1; then
                if docker info >/dev/null 2>&1; then
                    check_result="running"  # Docker is installed and running
                else
                    check_result="installed"  # Docker is installed but not running
                fi
            else
                check_result="missing"  # Docker not installed
            fi
        fi
        
        # Show current state - animation only, no box borders
        printf "\r  $circle ${GRAY}Checking Docker installation${NC}$dots_display"
        # Clear to end of line to avoid artifacts
        printf "\033[K"
        sleep 0.4
    done
    
    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3
    
    if [ "$check_result" = "running" ]; then
        # Get version info
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
        
        # Format the line to match last box alignment  
        local docker_display="${GREEN}✓${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}already installed and running${NC}"
        local docker_plain="✓ Docker ${DOCKER_VERSION} already installed and running"
        local padding=$((90 - ${#docker_plain}))
        printf "\r  ${docker_display}%*s\n" $padding ""
        return 0
    elif [ "$check_result" = "installed" ]; then
        # Docker installed but not running - start it
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
        printf "\n  ${YELLOW}⚠${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}installed but not running${NC}"
        printf "                    \n\n"
        
        printf "        ${YELLOW}🟡 ${BOLD}Docker Startup Required${NC}\n"
        printf "        ${GRAY}Docker is installed but the daemon is not running.${NC}\n\n"
        printf "        ${GREEN}✓${NC} We'll start Docker Desktop automatically\n"
        printf "        ${GREEN}✓${NC} Wait for the Linux VM to boot and be ready\n"
        printf "        ${GREEN}✓${NC} Zero manual intervention required\n\n"
        printf "        ${CYAN}❯${NC} ${BOLD}Continue with Docker startup?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
        printf "        "
        read -r response < /dev/tty 2>/dev/null || response="" < /dev/tty 2>/dev/null || response="n"
        
        # Run the Docker setup script to start Docker (it handles all output)
        if sh "scripts/setup_docker.sh"; then
            # After successful startup, clear all output and show clean result
            # Clear exactly 22 lines (checking animation + Docker Startup section + Docker setup output)
            i=1
            while [ $i -le 22 ]; do
                printf "\033[F\033[K"  # Move up and clear line
                i=$((i + 1))
            done
            
            # Get Docker version and show clean success message
            DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
            local docker_success="${GREEN}✓${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} started successfully"
            local docker_success_plain="✓ Docker ${DOCKER_VERSION} started successfully"
            local padding=$((90 - ${#docker_success_plain}))
            printf "  ${docker_success}%*s\n" $padding ""
        else
            printf "${RED}✗${NC} Docker startup failed\n"
            exit 1
        fi
        return 0
    fi
    
    printf "\n        ${YELLOW}🟡 ${BOLD}Docker Setup Required${NC}\n"
    printf "        ${GRAY}GraphDone uses Docker containers for Neo4j database and Redis cache.${NC}\n\n"
    printf "        ${GREEN}✓${NC} We'll use the dedicated Docker setup script for your platform\n"
    printf "        ${GREEN}✓${NC} Automatic installation and configuration\n"
    printf "        ${GREEN}✓${NC} Proper permissions and service setup\n"
    printf "        ${GREEN}✓${NC} Zero manual configuration, automatic setup\n\n"
    printf "        ${CYAN}❯${NC} ${BOLD}Continue with Docker installation?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
    printf "        "
    read -r response < /dev/tty 2>/dev/null || response=""
    
    # Run the Docker setup script - it handles everything (skip redundant check)
    if sh "scripts/setup_docker.sh" --skip-check; then
        # After successful installation, clear all output and show clean result
        # Clear exactly 26 lines (checking animation + Docker Setup section + Docker setup output)
        i=1
        while [ $i -le 26 ]; do
            printf "\033[F\033[K"  # Move up and clear line
            i=$((i + 1))
        done
        
        # Get Docker version and show clean success message
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
        local docker_success="${GREEN}✓${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} installed and running successfully"
        local docker_success_plain="✓ Docker ${DOCKER_VERSION} installed and running successfully"
        local padding=$((90 - ${#docker_success_plain}))
        printf "  ${docker_success}%*s\n" $padding ""
    else
        printf "${RED}✗${NC} Docker setup failed\n"
        exit 1
    fi
    
    return 0
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

# Smart npm install function with caching and multiple fallback strategies
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
            # First attempt: standard npm install (show some output for debugging)
            if npm install >/dev/null 2>"$npm_error_log"; then
                return 0
            fi
            # Log first attempt failure
            echo "First attempt failed, trying with --legacy-peer-deps" >> "$npm_debug_log"
        elif [ $attempt -eq 2 ]; then
            # Second attempt: handle peer dependency conflicts
            echo "Resolving dependency conflicts" >> "$npm_debug_log"
            if npm install --legacy-peer-deps >/dev/null 2>>"$npm_error_log"; then
                return 0
            fi
            echo "Second attempt failed, trying platform-specific approach" >> "$npm_debug_log"
        else
            # Third attempt: handle rollup module issue specifically
            echo "Installing platform-specific rollup" >> "$npm_debug_log"
            
            # Install platform-specific rollup binary
            local rollup_package=""
            case "$(uname)" in
                "Darwin")
                    # Detect macOS architecture
                    if [ "$(uname -m)" = "arm64" ]; then
                        rollup_package="@rollup/rollup-darwin-arm64"
                    else
                        rollup_package="@rollup/rollup-darwin-x64"
                    fi
                    ;;
                "Linux")
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
                # Try without platform-specific rollup
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

# Auto-install Docker if missing (silent version for progress box)
install_docker() {
    if command -v docker >/dev/null 2>&1; then
        return 0
    fi
    
    log "Installing Docker"
    
    case $PLATFORM in
        "macos")
            warn "Please install Docker Desktop from https://docker.com/products/docker-desktop"
            return 1
            ;;
        "linux")
            # Install Docker on Linux
            curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || return 1
            # Add user to docker group
            sudo usermod -aG docker "$USER" 2>/dev/null || true
            ;;
        *)
            warn "Please install Docker manually from https://docker.com"
            return 1
            ;;
    esac
    return 0
}

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
    
    printf "  ${GRAY}▸${NC} Waiting for services to initialize%-54s\n" " "
    
    while [ $attempts -lt 180 ]; do  # 180 attempts = ~3 minutes
        if check_containers_healthy; then
            printf "\r\033[K"  # Clear entire line
            return 0
        fi
        
        printf "\r  ${GRAY}▸${NC} Waiting for services to initialize ${YELLOW}${spin:i:1}${NC} (%ds)%-35s" $attempts " "
        i=$(( (i+1) % ${#spin} ))
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
    printf "${GREEN}✅ Cleanup complete!${NC}\n"
}

# Main installation function
install_graphdone() {
    # Beautiful GraphDone header
    clear
    printf "\n\n"
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
    
    printf "${TEAL}╔══════════════════════════════════════════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    printf "${TEAL}║                  ${TEAL}${BOLD}██     ██ ███████╗██╗      ██████╗ ██████╗ ███╗   ███╗███████╗${NC}                  ${TEAL}║${NC}\n"
    printf "${TEAL}║                  ${TEAL}${BOLD}██     ██ ██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║██╔════╝${NC}                  ${TEAL}║${NC}\n"
    printf "${TEAL}║                  ${TEAL}${BOLD}██  █  ██ █████╗  ██║     ██║     ██║   ██║██╔████╔██║█████╗${NC}                    ${TEAL}║${NC}\n"
    printf "${TEAL}║                  ${TEAL}${BOLD}██ ███ ██ ██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║██╔══╝${NC}                    ${TEAL}║${NC}\n"
    printf "${TEAL}║                  ${TEAL}${BOLD}╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗${NC}                  ${TEAL}║${NC}\n"
    printf "${TEAL}║                  ${TEAL}${BOLD} ╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝   ╚══════╝╚═══════╝${NC}                  ${TEAL}║${NC}\n"
    printf "${TEAL}║${NC}                                                                                                  ${TEAL}║${NC}\n"
    printf "${TEAL}║${NC}                                      ${TEAL}${BOLD}████████╗ ██████╗${NC}                                           ${TEAL}║${NC}\n"
    printf "${TEAL}║${NC}                                      ${TEAL}${BOLD}╚══██╔══╝██╔═══██╗${NC}                                          ${TEAL}║${NC}\n"
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}██║   ██║   ██║${NC}                                          ${TEAL}║${NC}\n"
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}██║   ██║   ██║${NC}                                          ${TEAL}║${NC}\n"
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}██║   ╚██████╔╝${NC}                                          ${TEAL}║${NC}\n"
    printf "${TEAL}║${NC}                                         ${TEAL}${BOLD}╚═╝    ╚═════╝${NC}                                           ${TEAL}║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    printf "${TEAL}║           ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗██████╗  ██████╗ ███╗   ██╗███████╗            ║${NC}\n"
    printf "${TEAL}║          ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██║  ██║██╔══██╗██╔═══██╗████╗  ██║██╔════╝            ║${NC}\n"
    printf "${TEAL}║          ██║  ███╗██████╔╝███████║██████╔╝███████║██║  ██║██║   ██║██╔██╗ ██║█████╗              ║${NC}\n"
    printf "${TEAL}║          ██║   ██║██╔══██╗██╔══██║██╔═══╝ ██╔══██║██║  ██║██║   ██║██║╚██╗██║██╔══╝              ║${NC}\n"
    printf "${TEAL}║          ╚██████╔╝██║  ██║██║  ██║██║     ██║  ██║██████╔╝╚██████╔╝██║ ╚████║███████╗            ║${NC}\n"
    printf "${TEAL}║           ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚══════╝            ║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    printf "${TEAL}║${NC}${OLIVE}                             Instant Setup. Zero Config. Pure Graph.                              ${NC}${TEAL}║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    printf "${TEAL}║${LIGHTCYAN}                          Built with ♥ ${YELLOW}for${LIGHTCYAN} teams ${ORANGE}who${LIGHTCYAN} think differently.                           ${TEAL}║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    printf "${TEAL}╚══════════════════════════════════════════════════════════════════════════════════════════════════╝${NC}\n\n"

    # Platform detection
    detect_platform
    
    # Pre-flight checks
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}✈️  Pre-flight Checks${NC}  ${TEAL}─────-──────────────────────────────────${NC}\n"
    
    # Check disk space
    printf "  ${BLUE}◉${NC} ${GRAY}Checking disk space...${NC}"
    check_disk_space
    printf "\r  ${GREEN}✓${NC} ${GRAY}Disk space:${NC} ${BOLD}Sufficient${NC}\n"
    
    # Check network connectivity
    printf "  ${BLUE}◉${NC} ${GRAY}Checking network...${NC}"
    check_network
    printf "\r  ${GREEN}✓${NC} ${GRAY}Network:${NC} ${BOLD}Connected${NC}\n"

    # Installation check section with box
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🖥️  System Information${NC}  ${TEAL}────-──────────────────────────────────${NC}\n"
    # Platform display with system name in brackets
    local platform_name
    case "$(uname)" in
        "Darwin")
            platform_name="(macOS)"
            ;;
        "Linux")
            platform_name="(Linux)"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            platform_name="(Windows)"
            ;;
        *)
            platform_name=""
            ;;
    esac
    
    printf "  ${BLUE}◉${NC} ${GRAY}Platform:${NC} ${BOLD}$(uname) $(uname -m)${NC} ${GRAY}${platform_name}${NC}\n"
    printf "  ${BLUE}◉${NC} ${GRAY}Shell:${NC} ${BOLD}${SHELL}${NC}\n"

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
    
    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}📡 Code Installation${NC}  ${TEAL}────-───────────────────────────────────${NC}\n"
    # Target line with exact 88-character content area
    target_content="${BLUE}◉${NC} ${GRAY}Target:${NC} ${BOLD}$INSTALL_DIR${NC}"
    target_plain="◉ Target: $INSTALL_DIR"
    target_spaces=$((88 - ${#target_plain}))
    if [ $target_spaces -lt 0 ]; then target_spaces=0; fi
    target_padding=$(printf "%*s" $target_spaces "")
    echo "  ${target_content}"
    
    # Download or update with animated progress
    if [ -d "$INSTALL_DIR" ]; then
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
        
        # Show download progress
        printf "  ${BLUE}📦${NC} Downloading GraphDone"
        
        # Clone in background to show progress
        git clone --quiet --branch fix/first-start https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR" >/dev/null 2>&1 &
        clone_pid=$!
        
        # Animated progress bar
        while kill -0 $clone_pid 2>/dev/null; do
            for spinner in "⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏"; do
                # Download line with exact 88-character content area
                download_content="${BLUE}📦${NC} Downloading GraphDone ${CYAN}${spinner}${NC}"
                download_plain="📦 Downloading GraphDone ${spinner}"
                download_spaces=$((88 - ${#download_plain}))
                if [ $download_spaces -lt 0 ]; then download_spaces=0; fi
                download_padding=$(printf "%*s" $download_spaces "")
                printf "\r  ${download_content}"
                sleep 0.1
                kill -0 $clone_pid 2>/dev/null || break
            done
        done
        wait $clone_pid
        
        # Clear the line completely to prevent spinner artifacts
        printf "\r\033[K"
        
        # Success line with exact 88-character content area
        success_content="${GREEN}✓${NC} ${BOLD}Downloaded${NC} ${GREEN}GraphDone${NC}"
        success_plain="✓ Downloaded GraphDone"
        success_spaces=$((88 - ${#success_plain}))
        if [ $success_spaces -lt 0 ]; then success_spaces=0; fi
        success_padding=$(printf "%*s" $success_spaces "")
        printf "  ${success_content}\n"
    fi

    cd "$INSTALL_DIR"

    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🔰 Dependency Checks${NC}  ${TEAL}────-───────────────────────────────────${NC}\n"
    
    # Run dependency checks inside the box
    check_and_prompt_git
    check_and_prompt_nodejs
    
    # Project dependencies check (repository already downloaded in Installation Setup)
    
    # Now check dependencies for both fresh and existing installations
    if [ -f "$GRAPHDONE_CHECK_DIR/package.json" ]; then
        # Start showing animation immediately while checking in background
        PINK='\033[38;5;213m'
        printf "  ${PINK}•${NC} ${GRAY}Checking project dependencies${NC}"
        # Clear to end of line
        printf "\033[K"
        
        cd "$GRAPHDONE_CHECK_DIR"
        
        # Check dependencies status in background
        deps_need_install=false
        if [ ! -d "node_modules" ] || ! check_deps_fresh; then
            deps_need_install=true
        fi
        
        if [ "$deps_need_install" = true ]; then
            # Clear the initial message
            printf "\r\033[K"
            # Blinking bullet with progressive dots (same as Node.js check)
            PINK='\033[38;5;213m'
            blink_state=0
            
            # Run npm install silently in background
            smart_npm_install &
            npm_pid=$!
            
            # Show animation exactly like Node.js check
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
                
                # Build the dots display based on cycle (same as Node.js)
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
                
                # Show current state - animation only, no box borders
                printf "\r  $circle ${GRAY}Checking project dependencies${NC}$dots_display"
                # Clear to end of line to avoid artifacts
                printf "\033[K"
                sleep 0.4
            done
            
            # Continue waiting if still running (keep same 3 dots, 4th will be completion)
            while kill -0 $npm_pid 2>/dev/null; do
                # Toggle blink state for bullet
                if [ $blink_state -eq 0 ]; then
                    circle="${PINK}•${NC}"
                    blink_state=1
                else
                    circle="${DIM}•${NC}"
                    blink_state=0
                fi
                
                # Keep the same 3 dots (4th dot is the completion green dot)
                dots_display=" ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC}"
                
                # Show current state - animation only, no box borders
                printf "\r  $circle ${GRAY}Checking project dependencies${NC}$dots_display"
                # Clear to end of line to avoid artifacts
                printf "\033[K"
                sleep 0.4
            done
            
            # Smooth transition: show completion state briefly
            printf " ${GREEN}●${NC}"
            sleep 0.3
            
            wait $npm_pid
            npm_exit_code=$?
            
            if [ $npm_exit_code -eq 0 ]; then
                update_deps_hash
                # Format the line to match last box alignment
                local deps_display="${GREEN}✓${NC} Project dependencies installed"
                local deps_plain="✓ Project dependencies installed"
                local padding=$((90 - ${#deps_plain}))
                printf "\r  ${deps_display}%*s\n" $padding ""
            else
                printf "\r  ${RED}✗${NC} Failed to install project dependencies%-45s\n" " "
                # Continue anyway - will try again later
            fi
        else
            # Already showed initial message, continue with animation
            blink_state=0
            
            # Continue with animation from where we started
            for cycle in 1 2 3 4 5; do
                # Toggle blink state
                if [ $blink_state -eq 0 ]; then
                    circle="${PINK}•${NC}"
                    blink_state=1
                else
                    circle="${DIM}•${NC}"
                    blink_state=0
                fi
                
                # Build the dots display based on cycle (same timing as Node.js)
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
                printf "\r  $circle ${GRAY}Checking project dependencies${NC}$dots_display"
                # Clear to end of line to avoid artifacts
                printf "\033[K"
                sleep 0.4
            done
            
            # Smooth transition: show completion state briefly
            printf " ${GREEN}●${NC}"
            sleep 0.3
            
            # Format the line to match last box alignment
            local deps_display="${GREEN}✓${NC} Project dependencies up to date (cached)"
            local deps_plain="✓ Project dependencies up to date (cached)"
            local padding=$((90 - ${#deps_plain}))
            printf "\r  ${deps_display}%*s\n" $padding ""
        fi
        cd - >/dev/null 2>&1
    fi
    
    check_and_prompt_docker
    
    
    # Brief pause for smooth transition
    sleep 0.5
    
    printf "  ${GREEN}✓ All dependencies verified${NC}\n"

    # Environment setup
    if [ ! -f ".env" ]; then
        printf "\n"
        printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}✳️ Environment Configuration${NC}  ${TEAL}────────────────────────────────────${NC}\n"
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

    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}🔐 Security Initialization${NC}  ${TEAL}─────────-────────────────────────${NC}\n"
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

    # Smart dependency management with MD5 hash-based caching
    # Only installs if node_modules is missing or package.json has changed
    # For updates, this was already done during Node.js check
    # For fresh installs, this happens now after downloading the code
    if [ ! -d "node_modules" ] || ! check_deps_fresh; then
        # Blinking bullet with progressive dots (same as Node.js check)
        PINK='\033[38;5;213m'
        blink_state=0
        
        # Run npm install silently in background
        smart_npm_install &
        npm_pid=$!
        
        # Show animation exactly like Node.js check
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
            
            # Build the dots display based on cycle (same as Node.js)
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
            printf "\r$circle ${GRAY}Checking project dependencies${NC}$dots_display"
            sleep 0.4
        done
        
        # Continue waiting if still running (keep same 3 dots, 4th will be completion)
        while kill -0 $npm_pid 2>/dev/null; do
            # Toggle blink state for bullet
            if [ $blink_state -eq 0 ]; then
                circle="${PINK}•${NC}"
                blink_state=1
            else
                circle="${DIM}•${NC}"
                blink_state=0
            fi
            
            # Keep the same 3 dots (4th dot is the completion green dot)
            dots_display=" ${GRAY}●${NC} ${BLUE}●${NC} ${CYAN}●${NC}"
            
            # Show current state
            printf "\r$circle ${GRAY}Checking project dependencies${NC}$dots_display"
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
            printf "${GREEN}✓${NC} Project dependencies installed\n"
        else
            printf "${RED}✗${NC} Failed to install project dependencies\n"
            error "Dependency installation failed"
        fi
    fi
    # If dependencies are cached and up-to-date, nothing is shown (silent)

    printf "\n"
    printf "${TEAL}────────────────────────────────────${NC}  ${CYAN}${BOLD}💹 Services Status${NC}  ${TEAL}──────────────────────────────────────────${NC}\n"
    
    # Check if services are already running
    if check_containers_healthy; then
        printf "  ${GREEN}✓${NC} Services already running\n"
        printf "\n"
        show_success_in_box
        return 0
    fi
    printf "  ${BLUE}◉${NC} Starting fresh services\n"

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
    printf "  ${BLUE}🔍${NC} Checking for port conflicts\n"
    GRAPHDONE_PORTS="3127 3128 4127 4128 6379 7474 7687"
    CONFLICTS_FOUND=false
    
    for port in $GRAPHDONE_PORTS; do
        if lsof -ti:$port >/dev/null 2>&1; then
            if [ "$CONFLICTS_FOUND" = false ]; then
                printf "  ${YELLOW}⚠${NC} Port conflicts detected, resolving\n"
                CONFLICTS_FOUND=true
            fi
            printf "    ${RED}✗${NC} Port $port is in use, killing process\n"
            pids=$(lsof -ti:$port 2>/dev/null)
            if [ -n "$pids" ]; then
                echo "$pids" | xargs kill -9 >/dev/null 2>&1 || true
            fi
            sleep 0.5
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
    
    # Service startup animation with service names
    services=("neo4j" "redis" "api" "web")
    spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    i=0
    service_index=0
    
    # Print the initial line
    printf "  ${BLUE}⚡${NC} ${GRAY}Starting services${NC}\n"
    
    while kill -0 $startup_pid 2>/dev/null; do
        current_service=${services[$((service_index % 4))]}
        # Only update the service name and spinner, not the whole line
        printf "\r  ${BLUE}▶${NC} ${GRAY}Starting ${BOLD}graphdone-${current_service}${NC} ${CYAN}${spin:i:1}${NC}%-52s" " "
        
        i=$(( (i+1) % ${#spin} ))
        # Change service name every 8 iterations
        if [ $((i % 8)) -eq 0 ]; then
            service_index=$((service_index + 1))
        fi
        sleep 0.1
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
    printf "${TEAL}║  ${TEAL}│${GREEN}${BOLD}                                    ✓ GraphDone Ready 🏆${NC}                                    ${TEAL}│${NC}  ${TEAL}║${NC}\n"
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