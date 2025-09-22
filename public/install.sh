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
error() { printf "${RED}✗${NC} %s\n" "$1" >&2; exit 1; }


# Fancy dots spinner function for installation steps
show_spinner() {
    pid=$1
    spin='⠣⠝⠙⠛⠧⠏⠟⠡'
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
    spin='⣾⣽⣻⢿⡿⣟⣯⣷'
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
        
        # Show current state
        printf "\r$circle ${GRAY}Checking Node.js installation${NC}$dots_display"
        sleep 0.4
    done
    
    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3
    
    if [ "$check_result" = "current" ]; then
        # Get full version info
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")
        NPM_VERSION_FULL=$(npm --version 2>/dev/null || echo "unknown")
        
        # Seamless transition - overwrite the checking line directly  
        printf "\r${GREEN}✓${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}and${NC} ${BOLD}npm${NC} ${GREEN}${NPM_VERSION_FULL}${NC} ${GRAY}already installed${NC}"
        # Add spaces to clear any remaining characters from the previous line
        printf "                    \n\n"
        return 0
    elif [ "$check_result" = "npm_old" ] || [ "$check_result" = "npm_missing" ]; then
        NODE_VERSION_FULL=$(node --version 2>/dev/null || echo "unknown")
        printf "\r${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${GREEN}${NODE_VERSION_FULL}${NC} ${GRAY}OK, but npm needs update${NC}"
        printf "                    \n\n"
        
        printf "${YELLOW}🟡 ${BOLD}npm Update Required${NC}\n"
        printf "${GRAY}Node.js is current but npm needs to be updated to >= 9.0.0${NC}\n\n"
        printf "${GREEN}✓${NC} We'll use the dedicated Node.js setup script to update npm\n"
        printf "${GREEN}✓${NC} Zero manual intervention required\n\n"
        printf "${CYAN}❯${NC} ${BOLD}Continue with npm update?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
        read -r response
        
        # Run the Node.js setup script
        if sh "scripts/setup_nodejs.sh"; then
            printf "\n"
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            exit 1
        fi
        return 0
    elif [ "$check_result" = "outdated" ]; then
        NODE_VERSION_OLD=$(node --version 2>/dev/null || echo "unknown")
        printf "\r${YELLOW}⚠${NC} ${BOLD}Node.js${NC} ${YELLOW}${NODE_VERSION_OLD}${NC} ${GRAY}outdated (need >= 18.0.0)${NC}"
        printf "                    \n\n"
        
        printf "${YELLOW}🟡 ${BOLD}Node.js Update Required${NC}\n"
        printf "${GRAY}GraphDone requires Node.js >= 18.0.0 for optimal performance.${NC}\n\n"
        printf "${GREEN}✓${NC} We'll use the dedicated Node.js setup script for your platform\n"
        printf "${GREEN}✓${NC} Automatic installation of latest LTS version\n"
        printf "${GREEN}✓${NC} Zero manual configuration required\n\n"
        printf "${CYAN}❯${NC} ${BOLD}Continue with Node.js upgrade?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
        read -r response
        
        # Run the Node.js setup script
        if sh "scripts/setup_nodejs.sh"; then
            printf "\n"
        else
            printf "${RED}✗${NC} Node.js setup failed\n"
            exit 1
        fi
        return 0
    fi
    
    printf "\n${YELLOW}🟡 ${BOLD}Node.js Setup Required${NC}\n"
    printf "${GRAY}GraphDone requires Node.js >= 18.0.0 and npm >= 9.0.0 for development.${NC}\n\n"
    printf "${GREEN}✓${NC} We'll use the dedicated Node.js setup script for your platform\n"
    printf "${GREEN}✓${NC} Automatic installation of latest LTS version\n"
    printf "${GREEN}✓${NC} Includes npm package manager automatically\n"
    printf "${GREEN}✓${NC} Zero manual configuration required\n\n"
    printf "${CYAN}❯${NC} ${BOLD}Continue with Node.js installation?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
    read -r response
    
    # Run the Node.js setup script (skip redundant check)
    if sh "scripts/setup_nodejs.sh" --skip-check; then
        printf "\n"
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
        
        # Show current state
        printf "\r$circle ${GRAY}Checking Docker installation${NC}$dots_display"
        sleep 0.4
    done
    
    # Smooth transition: show completion state briefly
    printf " ${GREEN}●${NC}"
    sleep 0.3
    
    if [ "$check_result" = "running" ]; then
        # Get version info
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
        
        # Seamless transition - overwrite the checking line directly  
        printf "\r${GREEN}✓${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}already installed and running${NC}"
        # Add spaces to clear any remaining characters from the previous line
        printf "                    \n\n"
        return 0
    elif [ "$check_result" = "installed" ]; then
        # Docker installed but not running - start it
        DOCKER_VERSION=$(docker --version 2>/dev/null | cut -d' ' -f3 | cut -d',' -f1 || echo "unknown")
        printf "\r${YELLOW}⚠${NC} ${BOLD}Docker${NC} ${GREEN}${DOCKER_VERSION}${NC} ${GRAY}installed but not running${NC}"
        printf "                    \n\n"
        
        printf "${YELLOW}🟡 ${BOLD}Docker Startup Required${NC}\n"
        printf "${GRAY}Docker is installed but the daemon is not running.${NC}\n\n"
        printf "${GREEN}✓${NC} We'll start Docker Desktop automatically\n"
        printf "${GREEN}✓${NC} Wait for the Linux VM to boot and be ready\n"
        printf "${GREEN}✓${NC} Zero manual intervention required\n\n"
        printf "${CYAN}❯${NC} ${BOLD}Continue with Docker startup?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
        read -r response
        
        # Run the Docker setup script to start Docker (it handles all output)
        if sh "scripts/setup_docker.sh"; then
            # Docker script handles success message
            printf "\n"
        else
            printf "${RED}✗${NC} Docker startup failed\n"
            exit 1
        fi
        return 0
    fi
    
    printf "\n${YELLOW}🟡 ${BOLD}Docker Setup Required${NC}\n"
    printf "${GRAY}GraphDone uses Docker containers for Neo4j database and Redis cache.${NC}\n\n"
    printf "${GREEN}✓${NC} We'll use the dedicated Docker setup script for your platform\n"
    printf "${GREEN}✓${NC} Automatic installation and configuration\n"
    printf "${GREEN}✓${NC} Proper permissions and service setup\n"
    printf "${GREEN}✓${NC} Zero manual configuration, automatic setup\n\n"
    printf "${CYAN}❯${NC} ${BOLD}Continue with Docker installation?${NC} ${GRAY}[Press Enter] or Ctrl+C to exit${NC}\n"
    read -r response
    
    # Run the Docker setup script - it handles everything (skip redundant check)
    if sh "scripts/setup_docker.sh" --skip-check; then
        # Docker script handles all success messages
        printf "\n"
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
            printf "  ${GRAY}• Downloading Docker installation script...${NC}\n"
            curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || return 1
            printf "  ${GRAY}• Adding user to docker group...${NC}\n"
            sudo usermod -aG docker "$USER" 2>/dev/null || true
            printf "  ${GRAY}• Starting Docker service...${NC}\n"
            sudo systemctl start docker 2>/dev/null || true
            sudo systemctl enable docker 2>/dev/null || true
            ;;
        *)
            return 1
            ;;
    esac
    return 0
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
    spin='⣾⣽⣻⢿⡿⣟⣯⣷'
    i=0
    attempts=0
    
    printf "${GRAY}▸${NC} Waiting for services to initialize"
    
    while [ $attempts -lt 180 ]; do  # 180 attempts = ~3 minutes
        if check_containers_healthy; then
            printf "\r\033[K"  # Clear entire line
            printf "${GREEN}✓${NC} Services are ready and healthy\n"
            return 0
        fi
        
        printf "\r${GRAY}▸${NC} Waiting for services to initialize ${YELLOW}${spin:i:1}${NC} (%ds)" $attempts
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
    printf " ${YELLOW}🛑${NC} Stopping running containers...\n"

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
            lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
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
    
    printf " ${YELLOW}🗑️${NC}  Removing old containers...\n"
    
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

    # Start installation progress (without outer box wrapper)
    printf "\n"

    # Check dependencies and prompt user before installation
    if ! command -v git >/dev/null 2>&1; then
        error "git required but not installed"
    fi
    
    # Interactive dependency checks before showing progress box
    check_and_prompt_nodejs
    check_and_prompt_docker
    
    # Brief pause for smooth transition
    sleep 0.5
    
    printf "${GREEN}✓${NC} Dependencies verified\n"

    # Modern installation section with progress
    INSTALL_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"
    
    printf "\n${CYAN}${BOLD}📍 Installation Setup${NC}\n"
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    printf "${BLUE}◉${NC} ${GRAY}Target:${NC} ${BOLD}$INSTALL_DIR${NC}\n"
    
    # Download or update with animated progress
    if [ -d "$INSTALL_DIR" ]; then
        printf "${BLUE}◉${NC} ${GRAY}Mode:${NC} ${YELLOW}Update existing${NC}\n\n"
        
        # Show fetching animation
        printf "${BLUE}↻${NC} Fetching latest changes"
        cd "$INSTALL_DIR"
        
        # Run git pull in background to show progress
        git pull --quiet >/dev/null 2>&1 &
        pull_pid=$!
        
        # Animated dots while updating
        while kill -0 $pull_pid 2>/dev/null; do
            for dot in "" "." ".." "..."; do
                printf "\r${BLUE}↻${NC} Fetching latest changes${dot}   "
                sleep 0.2
                kill -0 $pull_pid 2>/dev/null || break
            done
        done
        wait $pull_pid
        
        printf "\r${GREEN}✓${NC} ${BOLD}Updated${NC} ${GREEN}to latest version${NC}      \n"
    else
        printf "${BLUE}◉${NC} ${GRAY}Mode:${NC} ${GREEN}Fresh installation${NC}\n\n"
        
        # Show download progress
        printf "${BLUE}📦${NC} Downloading GraphDone"
        
        # Clone in background to show progress
        git clone --quiet --branch fix/first-start https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR" >/dev/null 2>&1 &
        clone_pid=$!
        
        # Animated progress bar
        while kill -0 $clone_pid 2>/dev/null; do
            for frame in "⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏"; do
                printf "\r${BLUE}📦${NC} Downloading GraphDone ${CYAN}${frame}${NC} "
                sleep 0.1
                kill -0 $clone_pid 2>/dev/null || break
            done
        done
        wait $clone_pid
        
        printf "\r${GREEN}✓${NC} ${BOLD}Downloaded${NC} ${GREEN}GraphDone Core${NC}   \n"
    fi
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    cd "$INSTALL_DIR"

    # Environment setup
    if [ ! -f ".env" ]; then
        printf "${GRAY}▸${NC} Configuring environment\n"
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
        printf "${GREEN}✓${NC} Environment configured\n"
    fi

    # TLS certificates
    if [ ! -f "deployment/certs/server-cert.pem" ]; then
        printf "${GRAY}▸${NC} Generating TLS certificates\n"
        mkdir -p deployment/certs || error "Failed to create certificate directory"
        openssl req -x509 -newkey rsa:4096 -nodes -keyout deployment/certs/server-key.pem -out deployment/certs/server-cert.pem -days 365 -subj '/CN=localhost' >/dev/null 2>&1 || error "Failed to generate certificates"
        printf "${GREEN}✓${NC} TLS certificates generated\n"
    else
        printf "${GREEN}✓${NC} TLS certificates already exist\n"
    fi

    # Check if services are already running
    if check_containers_healthy; then
        printf "${GREEN}✓${NC} Services already running\n"
        show_success_in_box
        return 0
    fi

    # Container preparation with interactive progress
    printf "\n${CYAN}${BOLD}📦 Container Preparation${NC}\n"
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    # Try both docker-compose and docker compose for compatibility
    if command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE="docker compose"
    fi
    
    # Clean up existing containers with progress
    printf "${BLUE}♻${NC} ${GRAY}Cleaning up existing containers${NC}\n"
    $DOCKER_COMPOSE -f deployment/docker-compose.yml down --remove-orphans >/dev/null 2>&1 || true
    $DOCKER_COMPOSE -f deployment/docker-compose.registry.yml down --remove-orphans >/dev/null 2>&1 || true

    # Smart deployment detection with animated progress
    printf "${BLUE}🔍${NC} Checking deployment strategy"
    
    # Test for pre-built containers in background
    docker pull ghcr.io/graphdone/graphdone-web:fix-first-start >/dev/null 2>&1 &
    check_pid=$!
    
    # Animated checking
    dots=""
    while kill -0 $check_pid 2>/dev/null; do
        for i in 1 2 3; do
            printf "\r${BLUE}🔍${NC} Checking deployment strategy${dots}   "
            dots="${dots}."
            [ ${#dots} -gt 3 ] && dots=""
            sleep 0.3
            kill -0 $check_pid 2>/dev/null || break
        done
    done
    wait $check_pid
    check_result=$?
    
    if [ $check_result -eq 0 ]; then
        printf "\r${GREEN}✓${NC} ${GRAY}Strategy:${NC} ${BOLD}Pre-built containers${NC} ${GREEN}(fast deployment)${NC}   \n"
        COMPOSE_FILE="deployment/docker-compose.registry.yml"
        DEPLOYMENT_MODE="registry"
    else
        printf "\r${GREEN}✓${NC} ${GRAY}Strategy:${NC} ${BOLD}Build from source${NC} ${YELLOW}(longer setup)${NC}   \n"
        COMPOSE_FILE="deployment/docker-compose.yml"
        DEPLOYMENT_MODE="local"
    fi
    
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    # GraphDone service startup with modern progress
    printf "\n${CYAN}${BOLD}🚀 Starting GraphDone Services${NC}\n"
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    
    if [ "$DEPLOYMENT_MODE" = "registry" ]; then
        printf "${BLUE}◉${NC} ${GRAY}Mode:${NC} ${BOLD}Registry deployment${NC}\n"
        printf "${BLUE}◉${NC} ${GRAY}Images:${NC} Pre-built containers from ghcr.io/graphdone\n"
    else
        printf "${BLUE}◉${NC} ${GRAY}Mode:${NC} ${BOLD}Source build${NC}\n"
        printf "${BLUE}◉${NC} ${GRAY}Build:${NC} Local container compilation\n"
    fi
    
    printf "\n${BLUE}↻${NC} ${GRAY}Initializing services${NC}"
    
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
    
    while kill -0 $startup_pid 2>/dev/null; do
        current_service=${services[$((service_index % 4))]}
        printf "\r${BLUE}↻${NC} ${GRAY}Starting ${BOLD}graphdone-${current_service}${NC} ${CYAN}${spin:i:1}${NC}  "
        
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
        printf "\r${GREEN}✓${NC} ${BOLD}All services started successfully${NC}         \n"
    else
        printf "\r${RED}✗${NC} ${BOLD}Service startup failed${NC}         \n"
        error "Failed to start services"
    fi
    
    printf "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    # Wait for services to be ready (more reliable than smart-start's 8 second sleep)
    if wait_for_services; then
        printf "${GREEN}✓${NC} Installation complete\n"
    else
        printf "${YELLOW}!${NC} Services started but initialization taking longer\n"
    fi
    
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
    INSTALL_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"
    
    # Success section in same box with inner box
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│${GREEN}${BOLD}                                      ✓ GraphDone Ready${NC}                                     ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}└────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    
    # Access URLs section in same box with inner box
    printf "${TEAL}║                                        Access URLs                                               ║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}Web App:${NC}    https://localhost:3128                                                        ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}GraphQL:${NC}    https://localhost:4128/graphql                                                ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}Database:${NC}   http://localhost:7474                                                         ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}└────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                  ║${NC}\n"
    
    # Management commands section in same box with inner box
    printf "${TEAL}║                                     Management Commands                                          ║${NC}\n"
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
    printf "${TEAL}║  ${TEAL}│  ${GRAY}%s${NC}%s${TEAL}│  ║${NC}\n" "$CD_CMD" "$CD_PADDING"
    printf "${TEAL}║  ${TEAL}│  ${GRAY}sh public/install.sh stop     ${NC}${GRAY}# Stop services${NC}                                             ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${GRAY}sh public/install.sh remove   ${NC}${GRAY}# Complete reset${NC}                                            ${TEAL}│  ║${NC}\n"
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