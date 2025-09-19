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

# Modern color palette
if [ -t 1 ]; then
    CYAN='\033[0;96m'
    GREEN='\033[0;92m'
    YELLOW='\033[0;93m'
    PURPLE='\033[0;95m'
    GRAY='\033[0;90m'
    RED='\033[0;91m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    CYAN='' GREEN='' YELLOW='' PURPLE='' GRAY='' RED='' BOLD='' NC=''
fi

# Clean, minimal functions
log() { printf "${GRAY}▸${NC} %s\n" "$1"; }
ok() { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$1"; }
error() { printf "${RED}✗${NC} %s\n" "$1" >&2; exit 1; }

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

# Auto-install Node.js if missing
install_nodejs() {
    if command -v node >/dev/null 2>&1; then
        return 0
    fi
    
    log "Installing Node.js via NVM"
    
    # Install NVM
    if [ ! -d "$HOME/.nvm" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash >/dev/null 2>&1 || return 1
    fi
    
    # Load NVM
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    
    # Install Node.js 18
    nvm install 18 >/dev/null 2>&1 && nvm use 18 >/dev/null 2>&1 || return 1
    return 0
}

# Auto-install Docker if missing
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
    
    # Stop containers
    for container in graphdone-neo4j graphdone-redis graphdone-api graphdone-web; do
        if docker ps -q -f name="$container" >/dev/null 2>&1; then
            docker stop "$container" >/dev/null 2>&1 || true
        fi
    done
    
    # Kill development processes
    if command -v lsof >/dev/null 2>&1; then
        for port in 3127 3128 4127 4128; do
            lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
        done
    fi
    
    ok "All services stopped"
}

# Remove all containers and volumes
remove_services() {
    log "Removing GraphDone containers and data"
    
    # Stop first
    stop_services >/dev/null 2>&1
    
    # Remove containers
    for container in graphdone-neo4j graphdone-redis graphdone-api graphdone-web; do
        docker rm "$container" >/dev/null 2>&1 || true
    done
    
    # Remove volumes
    docker volume rm graphdone_neo4j_data graphdone_neo4j_logs graphdone_redis_data >/dev/null 2>&1 || true
    
    # Clean build cache
    docker system prune -f >/dev/null 2>&1 || true
    
    ok "Complete reset finished"
}

# Main installation function
install_graphdone() {
    # Beautiful GraphDone header
    clear
    printf "\n\n"
    TEAL="\033[38;2;32;160;160m"
    NC="\033[0m"  # No Color
    OLIVE="\033[38;2;85;107;47m"
    LIGHTCYAN="\033[38;2;150;220;220m"
    YELLOW="\033[38;2;255;215;0m"
    ORANGE="\033[38;2;255;140;0m"
    GREEN="\033[0;92m"  # Bright green for checkmarks
    GRAY="\033[0;90m"   # Gray for progress indicators
    CYAN="\033[0;96m"   # Cyan for labels
    BOLD="\033[1m"      # Bold text
    
    printf "${TEAL}╔════════════════════════════════════════════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    printf "${TEAL}║           ██████╗ ██████╗  █████╗ ██████╗ ██╗  ██╗██████╗  ██████╗ ███╗   ██╗███████╗              ║${NC}\n"
    printf "${TEAL}║          ██╔════╝ ██╔══██╗██╔══██╗██╔══██╗██║  ██║██╔══██╗██╔═══██╗████╗  ██║██╔════╝              ║${NC}\n"
    printf "${TEAL}║          ██║  ███╗██████╔╝███████║██████╔╝███████║██║  ██║██║   ██║██╔██╗ ██║█████╗                ║${NC}\n"
    printf "${TEAL}║          ██║   ██║██╔══██╗██╔══██║██╔═══╝ ██╔══██║██║  ██║██║   ██║██║╚██╗██║██╔══╝                ║${NC}\n"
    printf "${TEAL}║          ╚██████╔╝██║  ██║██║  ██║██║     ██║  ██║██████╔╝╚██████╔╝██║ ╚████║███████╗              ║${NC}\n"
    printf "${TEAL}║           ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚══════╝              ║${NC}\n"
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    printf "${TEAL}║${OLIVE}                             Instant Setup. Zero Config. Pure Graph.                                ${TEAL}║${NC}\n"
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    printf "${TEAL}║${LIGHTCYAN}                          Built with ♥ ${YELLOW}for${LIGHTCYAN} teams ${ORANGE}who${LIGHTCYAN} think differently.                             ${TEAL}║${NC}\n"
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    printf "${TEAL}╚════════════════════════════════════════════════════════════════════════════════════════════════════╝${NC}\n\n"

    # Platform detection
    detect_platform

    # Start comprehensive status box (same width as banner)
    printf "${TEAL}╔════════════════════════════════════════════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${TEAL}║${LIGHTCYAN}                                    Installation Progress                                           ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌──────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"

    # Auto-install dependencies if needed
    if ! command -v git >/dev/null 2>&1; then
        error "git required but not installed"
    fi
    
    if ! command -v node >/dev/null 2>&1; then
        printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Installing Node.js via NVM                                                   ${TEAL}│  ║${NC}\n"
        if install_nodejs >/dev/null 2>&1; then
            printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Node.js installed successfully                                                  ${TEAL}│  ║${NC}\n"
        else
            printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Node.js installation skipped - will use containers                              ${TEAL}│  ║${NC}\n"
        fi
    else
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Node.js already installed                                                                 ${TEAL}│  ║${NC}\n"
    fi
    
    if ! command -v docker >/dev/null 2>&1; then
        printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Installing Docker                                                            ${TEAL}│  ║${NC}\n"
        if install_docker >/dev/null 2>&1; then
            printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Docker installed successfully                                                  ${TEAL}│  ║${NC}\n"
        else
            error "Docker installation failed"
        fi
    else
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Docker already installed                                                                  ${TEAL}│  ║${NC}\n"
    fi
    
    # Ensure Docker is running
    if ! docker ps >/dev/null 2>&1; then
        case $PLATFORM in
            "macos")
                log "Starting Docker Desktop"
                open -a Docker 2>/dev/null || true
                ;;
            "linux")
                log "Starting Docker service"
                sudo systemctl start docker 2>/dev/null || true
                ;;
        esac
        
        # Wait for Docker to start
        attempts=0
        while ! docker ps >/dev/null 2>&1 && [ $attempts -lt 10 ]; do
            sleep 3
            attempts=$((attempts + 1))
        done
        
        if ! docker ps >/dev/null 2>&1; then
            error "Docker is not running. Please start Docker and try again"
        fi
    fi
    
    printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Dependencies verified                                                                     ${TEAL}│  ║${NC}\n"

    # Installation directory
    INSTALL_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"
    # Truncate path if too long for display (POSIX-compatible)
    DISPLAY_DIR="$INSTALL_DIR"
    # Use expr for POSIX-compatible string length
    DIR_LENGTH=$(expr length "$DISPLAY_DIR" 2>/dev/null || echo "${#DISPLAY_DIR}")
    if [ "$DIR_LENGTH" -gt 45 ]; then
        # Use sed for POSIX-compatible substring
        DISPLAY_DIR="...$(echo "$INSTALL_DIR" | sed 's/.*\(.\{42\}\)$/\1/')"
    fi
    # Format the install directory line with proper padding (71 chars total like other lines)
    INSTALL_MSG="Installing to $DISPLAY_DIR"
    # Calculate padding needed (POSIX-compatible)
    MSG_LEN=$(printf "%s" "$INSTALL_MSG" | wc -c)
    PADDING=""
    PAD_COUNT=$((71 - MSG_LEN))
    while [ $PAD_COUNT -gt 0 ]; do
        PADDING="$PADDING "
        PAD_COUNT=$((PAD_COUNT - 1))
    done
    printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} %s%s                   ${TEAL}│  ║${NC}\n" "$INSTALL_MSG" "$PADDING"

    # Download or update
    if [ -d "$INSTALL_DIR" ]; then
        printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Updating existing installation                                                            ${TEAL}│  ║${NC}\n"
        cd "$INSTALL_DIR" && git pull --quiet >/dev/null 2>&1
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Updated existing installation                                                             ${TEAL}│  ║${NC}\n"
    else
        printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Downloading GraphDone from GitHub                                               ${TEAL}│  ║${NC}\n"
        git clone --quiet --branch fix/first-start https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR" >/dev/null 2>&1 || git clone --quiet https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR" >/dev/null 2>&1
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Downloaded GraphDone from GitHub                                                ${TEAL}│  ║${NC}\n"
    fi

    cd "$INSTALL_DIR"

    # Environment setup
    if [ ! -f ".env" ]; then
        printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Configuring environment                                                         ${TEAL}│  ║${NC}\n"
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
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Environment configured                                                          ${TEAL}│  ║${NC}\n"
    fi

    # TLS certificates
    if [ ! -f "deployment/certs/server-cert.pem" ]; then
        printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Generating TLS certificates                                                   ${TEAL}│  ║${NC}\n"
        mkdir -p deployment/certs || error "Failed to create certificate directory"
        openssl req -x509 -newkey rsa:4096 -nodes -keyout deployment/certs/server-key.pem -out deployment/certs/server-cert.pem -days 365 -subj '/CN=localhost' >/dev/null 2>&1 || error "Failed to generate certificates"
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} TLS certificates generated                                                    ${TEAL}│  ║${NC}\n"
    else
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} TLS certificates already exist                                                            ${TEAL}│  ║${NC}\n"
    fi

    # Check if services are already running
    if check_containers_healthy; then
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Services already running                                                                  ${TEAL}│  ║${NC}\n"
        printf "${TEAL}║  ${TEAL}└──────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
        # Don't close the box yet - continue with success info
        show_success_in_box
        return 0
    fi

    # Container cleanup
    printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Preparing containers                                                          ${TEAL}│  ║${NC}\n"
    # Try both docker-compose and docker compose for compatibility
    if command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE="docker compose"
    fi
    $DOCKER_COMPOSE -f deployment/docker-compose.yml down --remove-orphans >/dev/null 2>&1 || true
    $DOCKER_COMPOSE -f deployment/docker-compose.registry.yml down --remove-orphans >/dev/null 2>&1 || true

    # Smart deployment detection
    printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Checking for pre-built images                                                ${TEAL}│  ║${NC}\n"
    if docker pull ghcr.io/graphdone/graphdone-web:fix-first-start >/dev/null 2>&1; then
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Using pre-built containers                                                    ${TEAL}│  ║${NC}\n"
        COMPOSE_FILE="deployment/docker-compose.registry.yml"
    else
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Building from source                                                          ${TEAL}│  ║${NC}\n"
        COMPOSE_FILE="deployment/docker-compose.yml"
    fi

    # Start services
    printf "${TEAL}║  ${TEAL}│  ${GRAY}▸${NC} Starting GraphDone services                                                   ${TEAL}│  ║${NC}\n"
    if [ -f "$COMPOSE_FILE" ]; then
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d >/dev/null 2>&1 || error "Failed to start services"
    else
        # Fallback to default compose file
        $DOCKER_COMPOSE -f deployment/docker-compose.yml up -d >/dev/null 2>&1 || error "Failed to start services"
    fi
    printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} GraphDone services started                                                    ${TEAL}│  ║${NC}\n"

    # Wait for services to be ready (more reliable than smart-start's 8 second sleep)
    if wait_for_services; then
        printf "${TEAL}║  ${TEAL}│  ${GREEN}✓${NC} Installation complete                                                        ${TEAL}│  ║${NC}\n"
    else
        printf "${TEAL}║  ${TEAL}│  ${YELLOW}!${NC} Services started but initialization taking longer                            ${TEAL}│  ║${NC}\n"
    fi
    
    # Close the Installation Progress inner box
    printf "${TEAL}║  ${TEAL}└──────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    
    # Continue with success info in the same box
    show_success_in_box
}


# Continue the box with success information
show_success_in_box() {
    TEAL="\033[38;2;32;160;160m"
    NC="\033[0m"  # No Color
    LIGHTCYAN="\033[38;2;150;220;220m"
    GREEN="\033[0;92m"  # Bright green for checkmarks
    GRAY="\033[0;90m"   # Gray for progress indicators
    CYAN="\033[0;96m"   # Cyan for labels
    BOLD="\033[1m"      # Bold text
    INSTALL_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"
    
    # Success section in same box with inner box
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌──────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│${GREEN}${BOLD}                                      ✓ GraphDone Ready${NC}                                       ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}└──────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    
    # Access URLs section in same box with inner box
    printf "${TEAL}║${LIGHTCYAN}                                        Access URLs                                                 ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌──────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}Web App:${NC}    https://localhost:3128                                                          ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}GraphQL:${NC}    https://localhost:4128/graphql                                                  ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${CYAN}Database:${NC}   http://localhost:7474                                                           ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}└──────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    
    # Management commands section in same box with inner box
    printf "${TEAL}║${LIGHTCYAN}                                     Management Commands                                            ${TEAL}║${NC}\n"
    printf "${TEAL}║  ${TEAL}┌──────────────────────────────────────────────────────────────────────────────────────────────┐${TEAL}  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${GRAY}cd %s${NC}                                                           ${TEAL}│  ║${NC}\n" "$INSTALL_DIR"
    printf "${TEAL}║  ${TEAL}│  ${GRAY}sh public/install.sh stop     ${NC}${GRAY}# Stop services${NC}                                               ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}│  ${GRAY}sh public/install.sh remove   ${NC}${GRAY}# Complete reset${NC}                                              ${TEAL}│  ║${NC}\n"
    printf "${TEAL}║  ${TEAL}└──────────────────────────────────────────────────────────────────────────────────────────────┘${TEAL}  ║${NC}\n"
    printf "${TEAL}║                                                                                                    ║${NC}\n"
    
    # Close the big box
    printf "${TEAL}╚════════════════════════════════════════════════════════════════════════════════════════════════════╝${NC}\n\n"
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