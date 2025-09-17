#!/bin/sh
# GraphDone Installation Script - Professional One-Liner Setup
# Usage: curl -fsSL https://graphdone.com/start.sh | sh

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
    local pid=$1
    local message=$2
    local spin='⣾⣽⣻⢿⡿⣟⣯⣷'
    local i=0
    
    printf "${GRAY}▸${NC} %s " "$message"
    while kill -0 $pid 2>/dev/null; do
        printf "\r${GRAY}▸${NC} %s ${YELLOW}${spin:i:1}${NC}" "$message"
        i=$(( (i+1) % ${#spin} ))
        sleep 0.1
    done
    
    wait $pid
    local exit_code=$?
    
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
    local message=$1
    shift
    
    # Run command in background
    "$@" >/dev/null 2>&1 &
    local pid=$!
    
    # Show spinner
    spinner $pid "$message"
    return $?
}

# Platform detection
detect_platform() {
    if [ "$(uname)" = "Darwin" ]; then
        PLATFORM="macos"
    elif [ "$(uname)" = "Linux" ]; then
        PLATFORM="linux"
    else
        PLATFORM="unknown"
    fi
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
    local neo4j_healthy=false
    local redis_healthy=false
    local api_healthy=false
    local web_healthy=false

    # Check Neo4j container health and connectivity
    if docker ps --format "{{.Names}} {{.Status}}" | grep "graphdone-neo4j" | grep -q "Up.*healthy" 2>/dev/null; then
        # Verify Neo4j is actually responding with cypher-shell
        if timeout 15 docker exec graphdone-neo4j cypher-shell -u neo4j -p graphdone_password "RETURN 1" >/dev/null 2>&1; then
            neo4j_healthy=true
        fi
    fi

    # Check Redis container health and connectivity
    if docker ps --format "{{.Names}} {{.Status}}" | grep "graphdone-redis" | grep -q "Up.*healthy" 2>/dev/null; then
        # Verify Redis is actually responding
        if timeout 15 docker exec graphdone-redis redis-cli ping >/dev/null 2>&1; then
            redis_healthy=true
        fi
    fi

    # Check API container health and endpoint (HTTPS mode like smart-start configures)
    if docker ps --format "{{.Names}} {{.Status}}" | grep "graphdone-api" | grep -q "Up.*healthy" 2>/dev/null; then
        # Test HTTPS API health endpoint (port 4128) since that's what smart-start actually configures
        if timeout 15 curl -sf https://localhost:4128/health >/dev/null 2>&1; then
            api_healthy=true
        fi
    fi

    # Check Web container health and endpoint  
    if docker ps --format "{{.Names}}" | grep -q "graphdone-web" 2>/dev/null; then
        # Test the correct web endpoint (HTTP first, then HTTPS)
        if timeout 15 curl -sf http://localhost:3127 >/dev/null 2>&1 || timeout 15 curl -sf https://localhost:3128 >/dev/null 2>&1; then
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
    local spin='⣾⣽⣻⢿⡿⣟⣯⣷'
    local i=0
    local attempts=0
    
    printf "${GRAY}▸${NC} Waiting for services to initialize"
    
    while [ $attempts -lt 90 ]; do  # 90 attempts = ~90 seconds
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
    printf "${YELLOW}!${NC} Services started but initialization is taking longer than expected\n"
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
    printf "${CYAN}"
    cat << "EOF"
   ___                 _     ____                  
  / _ \ _ __ __ _ _ __| |__ |  _ \  ___  _ __   ___ 
 | | | | '__/ _` | '_ \ '_ \| | | |/ _ \| '_ \ / _ \
 | |_| | | | (_| | |_) | | | | |_| | (_) | | | |  __/
  \____|_|  \__,_| .__/|_| |_|____/ \___/|_| |_|\___| 
                 |_|                                  
EOF
    printf "${NC}${PURPLE}        Instant Setup. Zero Config. Pure Graph.${NC}\n\n"

    # Platform detection
    detect_platform

    # Auto-install dependencies if needed
    if ! command -v git >/dev/null 2>&1; then
        error "git required but not installed"
    fi
    
    if ! command -v node >/dev/null 2>&1; then
        if run_with_spinner "Installing Node.js via NVM" install_nodejs; then
            ok "Node.js installed successfully"
        else
            log "Node.js installation skipped - will use containers"
        fi
    else
        ok "Node.js already installed"
    fi
    
    if ! command -v docker >/dev/null 2>&1; then
        if run_with_spinner "Installing Docker" install_docker; then
            ok "Docker installed successfully"
        else
            error "Docker installation failed"
        fi
    else
        ok "Docker already installed"
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
    
    ok "Dependencies verified"

    # Installation directory
    INSTALL_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"
    log "Installing to $INSTALL_DIR"

    # Download or update
    if [ -d "$INSTALL_DIR" ]; then
        run_with_spinner "Updating existing installation" sh -c "cd '$INSTALL_DIR' && git pull --quiet"
    else
        run_with_spinner "Downloading GraphDone from GitHub" sh -c "git clone --quiet --branch fix/first-start https://github.com/GraphDone/GraphDone-Core.git '$INSTALL_DIR' || git clone --quiet https://github.com/GraphDone/GraphDone-Core.git '$INSTALL_DIR'"
    fi

    cd "$INSTALL_DIR"

    # Environment setup
    if [ ! -f ".env" ]; then
        log "Configuring environment"
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
    fi

    # TLS certificates
    if [ ! -f "deployment/certs/server-cert.pem" ]; then
        mkdir -p deployment/certs
        run_with_spinner "Generating TLS certificates" sh -c "openssl req -x509 -newkey rsa:4096 -nodes -keyout deployment/certs/server-key.pem -out deployment/certs/server-cert.pem -days 365 -subj '/CN=localhost'"
    else
        ok "TLS certificates already exist"
    fi

    # Check if services are already running
    if check_containers_healthy; then
        ok "Services already running"
        return 0
    fi

    # Container cleanup
    run_with_spinner "Preparing containers" sh -c "docker compose -f deployment/docker-compose.yml down --remove-orphans 2>/dev/null; docker compose -f deployment/docker-compose.registry.yml down --remove-orphans 2>/dev/null; true"

    # Smart deployment detection
    if run_with_spinner "Checking for pre-built images" docker pull ghcr.io/graphdone/graphdone-web:fix-first-start; then
        ok "Using pre-built containers"
        COMPOSE_FILE="deployment/docker-compose.registry.yml"
    else
        ok "Building from source"
        COMPOSE_FILE="deployment/docker-compose.yml"
    fi

    # Start services
    if [ -f "$COMPOSE_FILE" ]; then
        run_with_spinner "Starting GraphDone services" docker compose -f "$COMPOSE_FILE" up -d || error "Failed to start services"
    else
        # Fallback to default compose file
        run_with_spinner "Starting GraphDone services" docker compose -f deployment/docker-compose.yml up -d || error "Failed to start services"
    fi

    # Wait for services to be ready
    if wait_for_services; then
        ok "All services ready"
    fi
}

# Show success message
show_success() {
    printf "\n${GREEN}${BOLD}✓ GraphDone Ready${NC}\n\n"
    printf "  ${CYAN}Web App:${NC}    https://localhost:3128\n"
    printf "  ${CYAN}GraphQL:${NC}    https://localhost:4128/graphql\n"
    printf "  ${CYAN}Database:${NC}   http://localhost:7474\n\n"

    printf "${GRAY}Manage:${NC}\n"
    INSTALL_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"
    printf "  ${GRAY}cd $INSTALL_DIR${NC}\n"
    printf "  ${GRAY}sh public/start.sh stop     ${NC}${GRAY}# Stop${NC}\n"
    printf "  ${GRAY}sh public/start.sh remove   ${NC}${GRAY}# Reset${NC}\n\n"
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
        show_success
        ;;
    *)
        error "Unknown command: $COMMAND. Use: install, stop, or remove"
        ;;
esac