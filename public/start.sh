#!/bin/sh
# GraphDone Installation Script
# Usage: curl -fsSL https://graphdone.com/start.sh | sh

set -e

# Colors
if [ -t 1 ]; then
    CYAN='\033[0;36m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    PURPLE='\033[0;35m'
    BOLD='\033[1m'
    DIM='\033[2m'
    NC='\033[0m'
else
    CYAN=''
    GREEN=''
    YELLOW=''
    PURPLE=''
    BOLD=''
    DIM=''
    NC=''
fi

# Functions
print_header() {
    printf "\n${CYAN}%s${NC}\n" "$1"
    printf "${DIM}%s${NC}\n" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

status() { printf "${GREEN}✓${NC} %s\n" "$1"; }
progress() { printf "${YELLOW}⚡${NC} %s\n" "$1"; }
error() { printf "${YELLOW}✗${NC} Error: %s\n" "$1" >&2; exit 1; }
info() { printf "${DIM}  %s${NC}\n" "$1"; }

# Banner
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
printf "${PURPLE}%s${NC}\n" "        Instant Setup. Zero Config. Pure Graph."
printf "\n"

# Check requirements
print_header "CHECKING REQUIREMENTS"
for cmd in git docker; do
    if command -v $cmd >/dev/null 2>&1; then
        status "$cmd installed"
    else
        error "Missing $cmd. Please install it first."
    fi
done

# Install directory
INSTALL_DIR="${GRAPHDONE_HOME:-$HOME/graphdone}"

print_header "INSTALLATION"
progress "Installing to $INSTALL_DIR"

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
    progress "Found existing installation"
    info "Updating to latest version..."
    cd "$INSTALL_DIR" && git pull --quiet
    status "Updated successfully"
else
    progress "Downloading GraphDone"
    info "Cloning repository..."
    # Clone from fix/first-start branch for now (until merged to main)
    git clone --quiet --branch fix/first-start https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR" 2>/dev/null || \
    git clone --quiet https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR" 2>/dev/null || \
    error "Failed to download GraphDone"
    status "Downloaded successfully"
fi

cd "$INSTALL_DIR"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
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
    status "Environment configured"
fi

# Generate certificates if needed for HTTPS
if [ ! -f "deployment/certs/server-cert.pem" ] || [ -d "deployment/certs/server-cert.pem" ]; then
    progress "Generating TLS certificates..."
    # Remove incorrect directories if they exist
    rm -rf deployment/certs/server-cert.pem deployment/certs/server-key.pem 2>/dev/null
    mkdir -p deployment/certs

    # Always use OpenSSL for self-signed certificates in installation script
    # This avoids mkcert dependency issues during first-time installation
    if command -v openssl >/dev/null 2>&1; then
        openssl req -x509 -newkey rsa:4096 -nodes \
            -keyout deployment/certs/server-key.pem \
            -out deployment/certs/server-cert.pem \
            -days 365 -subj "/CN=localhost" 2>/dev/null
        status "Self-signed certificates generated"
        info "For trusted certificates, run: ./scripts/generate-dev-certs.sh local"
    else
        error "OpenSSL not found. Cannot generate certificates."
    fi
fi

# Make smart-start executable
if [ -f "smart-start" ]; then
    chmod +x smart-start
    status "Scripts configured"
fi

print_header "LAUNCHING GRAPHDONE"

# Just run smart-start - it handles everything
if [ -f "./smart-start" ]; then
    ./smart-start
else
    error "smart-start not found in installation"
fi

# Simple success message
printf "\n${GREEN}✨ Installation complete!${NC}\n\n"
printf "To manage GraphDone:\n"
printf "  ${DIM}cd $INSTALL_DIR${NC}\n"
printf "  ${DIM}./smart-start stop    # Stop services${NC}\n"
printf "  ${DIM}./smart-start         # Restart${NC}\n\n"