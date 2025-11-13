#!/bin/bash

# GraphDone Multipass VM Management Script
# Manages Multipass VMs for GraphDone development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
CONFIG_FILE="$PROJECT_ROOT/vm.config.yml"
CLOUD_INIT_TEMPLATE="$PROJECT_ROOT/cloud-init.template.yml"
CLOUD_INIT_OUTPUT="/tmp/graphdone-cloud-init.yml"
COMMAND=""
VM_NAME=""
BRANCH=""
CPUS=""
MEMORY=""
DISK=""

# Fun word lists for random VM names
ADJECTIVES=(
    "happy" "jolly" "clever" "bright" "swift" "mighty" "gentle" "fierce"
    "brave" "wise" "lucky" "cosmic" "quantum" "stellar" "radiant" "vibrant"
    "turbo" "ultra" "mega" "super" "hyper" "ninja" "rocket" "blazing"
    "golden" "silver" "crystal" "diamond" "ruby" "sapphire" "emerald"
    "mystic" "magic" "wonder" "lightning" "thunder" "storm" "ocean" "forest"
)

NOUNS=(
    "turtle" "panda" "dragon" "phoenix" "falcon" "tiger" "wolf" "bear"
    "eagle" "shark" "lion" "leopard" "cheetah" "panther" "jaguar" "lynx"
    "otter" "beaver" "badger" "ferret" "weasel" "mink" "sable" "marten"
    "hawk" "owl" "raven" "crow" "sparrow" "robin" "finch" "wren"
    "whale" "dolphin" "seal" "walrus" "manatee" "dugong" "narwhal"
    "node" "graph" "vertex" "edge" "cluster" "mesh" "grid" "lattice"
)

# Generate random VM name
generate_random_name() {
    local adj1=${ADJECTIVES[$RANDOM % ${#ADJECTIVES[@]}]}
    local noun=${NOUNS[$RANDOM % ${#NOUNS[@]}]}
    local uuid=$(printf "%04d" $((RANDOM % 10000)))
    echo "graphdone-vm-${adj1}-${noun}-${uuid}"
}

# Logging functions
log_info() {
    echo -e "${CYAN}$1${NC}"
}

log_success() {
    echo -e "${GREEN}$1${NC}"
}

log_warning() {
    echo -e "${YELLOW}$1${NC}"
}

log_error() {
    echo -e "${RED}$1${NC}"
}

# Check if multipass is installed
check_multipass() {
    if ! command -v multipass &> /dev/null; then
        log_error "❌ Multipass is not installed!"
        echo ""
        echo "Please install Multipass from: https://multipass.run"
        echo ""
        echo "Installation commands:"
        echo "  macOS:   brew install --cask multipass"
        echo "  Ubuntu:  sudo snap install multipass"
        echo "  Windows: Download from https://multipass.run"
        exit 1
    fi
}

# Check if yq is installed (for YAML parsing)
check_yq() {
    if ! command -v yq &> /dev/null; then
        log_warning "⚠️  yq is not installed. Installing..."

        # Detect OS and install yq
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
            sudo chmod +x /usr/local/bin/yq
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                brew install yq
            else
                log_error "❌ Please install Homebrew or manually install yq"
                exit 1
            fi
        else
            log_error "❌ Unsupported OS. Please install yq manually from: https://github.com/mikefarah/yq"
            exit 1
        fi

        log_success "✅ yq installed successfully"
    fi
}

# Read configuration from vm.config.yml
read_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "❌ Configuration file not found: $CONFIG_FILE"
        exit 1
    fi

    # Read VM name - generate random if not specified
    local config_name=$(yq eval '.name' "$CONFIG_FILE")
    if [ -z "$VM_NAME" ]; then
        # Check if config has a name and it's not "graphdone-dev" (the default)
        # If it's the default or empty, generate a random name
        if [ -z "$config_name" ] || [ "$config_name" = "null" ] || [ "$config_name" = "graphdone-dev" ]; then
            VM_NAME=$(generate_random_name)
            log_info "🎲 Generated random VM name: $VM_NAME"
        else
            VM_NAME="$config_name"
        fi
    fi

    # Read resources
    CPUS="${CPUS:-$(yq eval '.resources.cpus' "$CONFIG_FILE")}"
    MEMORY="${MEMORY:-$(yq eval '.resources.memory' "$CONFIG_FILE")}"
    DISK="${DISK:-$(yq eval '.resources.disk' "$CONFIG_FILE")}"

    # Read other config
    IMAGE=$(yq eval '.image' "$CONFIG_FILE")
    TAILSCALE_ENABLED=$(yq eval '.tailscale.enabled' "$CONFIG_FILE")
    TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-$(yq eval '.tailscale.auth_key' "$CONFIG_FILE")}"
    TAILSCALE_FLAGS=$(yq eval '.tailscale.flags' "$CONFIG_FILE")

    DOCKER_ENABLED=$(yq eval '.docker.enabled' "$CONFIG_FILE")
    DOCKER_COMPOSE=$(yq eval '.docker.compose' "$CONFIG_FILE")

    NODEJS_VERSION=$(yq eval '.nodejs.version' "$CONFIG_FILE")
    USE_NVM=$(yq eval '.nodejs.use_nvm' "$CONFIG_FILE")

    GRAPHDONE_REPO=$(yq eval '.graphdone.repo_url' "$CONFIG_FILE")
    GRAPHDONE_BRANCH="${BRANCH:-$(yq eval '.graphdone.branch' "$CONFIG_FILE")}"
    GRAPHDONE_PATH=$(yq eval '.graphdone.clone_path' "$CONFIG_FILE")
    AUTO_SETUP=$(yq eval '.graphdone.auto_setup' "$CONFIG_FILE")
    AUTO_SEED=$(yq eval '.graphdone.auto_seed' "$CONFIG_FILE")

    RUN_ON_BOOT=$(yq eval '.startup.run_on_boot' "$CONFIG_FILE")

    # Read dev tools
    DEV_TOOLS=$(yq eval '.development.dev_tools[]' "$CONFIG_FILE" 2>/dev/null | tr '\n' ' ' || echo "")
}

# Generate cloud-init configuration
generate_cloud_init() {
    log_info "📝 Generating cloud-init configuration..."

    # Read template
    cp "$CLOUD_INIT_TEMPLATE" "$CLOUD_INIT_OUTPUT"

    # Build dev tools package list
    local dev_tools_packages=""
    if [ -n "$DEV_TOOLS" ]; then
        for tool in $DEV_TOOLS; do
            dev_tools_packages="${dev_tools_packages}  - ${tool}\n"
        done
    fi

    # Build Docker install commands
    local docker_install=""
    if [ "$DOCKER_ENABLED" = "true" ]; then
        docker_install="  - echo '=== Installing Docker ==='\n"
        docker_install+="  - curl -fsSL https://get.docker.com -o /tmp/get-docker.sh\n"
        docker_install+="  - sh /tmp/get-docker.sh\n"
        docker_install+="  - usermod -aG docker ubuntu\n"
        docker_install+="  - systemctl enable docker\n"
        docker_install+="  - systemctl start docker\n"

        if [ "$DOCKER_COMPOSE" = "true" ]; then
            docker_install+="  - echo '=== Installing Docker Compose ==='\n"
            docker_install+="  - curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose\n"
            docker_install+="  - chmod +x /usr/local/bin/docker-compose\n"
        fi
    fi

    # Build Node.js install commands
    local nodejs_install=""
    if [ "$USE_NVM" = "true" ]; then
        nodejs_install="  - echo '=== Installing Node.js via nvm ==='\n"
        nodejs_install+="  - su - ubuntu -c 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'\n"
        nodejs_install+="  - su - ubuntu -c 'export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\" && nvm install ${NODEJS_VERSION} && nvm use ${NODEJS_VERSION} && nvm alias default ${NODEJS_VERSION}'\n"
    else
        nodejs_install="  - echo '=== Installing Node.js ==='\n"
        nodejs_install+="  - curl -fsSL https://deb.nodesource.com/setup_${NODEJS_VERSION}.x | bash -\n"
        nodejs_install+="  - apt-get install -y nodejs\n"
    fi

    # Build Tailscale install commands
    local tailscale_install=""
    if [ "$TAILSCALE_ENABLED" = "true" ] && [ -n "$TAILSCALE_AUTH_KEY" ]; then
        tailscale_install="  - echo '=== Installing Tailscale ==='\n"
        tailscale_install+="  - curl -fsSL https://tailscale.com/install.sh | sh\n"
        tailscale_install+="  - tailscale up --authkey=${TAILSCALE_AUTH_KEY} ${TAILSCALE_FLAGS}\n"
        tailscale_install+="  - echo 'Tailscale connected'\n"
    fi

    # Build GraphDone setup commands
    local graphdone_setup=""
    if [ "$AUTO_SETUP" = "true" ]; then
        graphdone_setup="  - echo '=== Setting up GraphDone ==='\n"
        graphdone_setup+="  - su - ubuntu -c 'cd ${GRAPHDONE_PATH} && ./start setup'\n"

        if [ "$AUTO_SEED" = "true" ]; then
            graphdone_setup+="  - su - ubuntu -c 'cd ${GRAPHDONE_PATH} && npm run db:seed'\n"
        fi
    fi

    # Build systemd service if run_on_boot is enabled
    local systemd_service=""
    if [ "$RUN_ON_BOOT" = "true" ]; then
        systemd_service="  - path: /etc/systemd/system/graphdone.service\n"
        systemd_service+="    content: |\n"
        systemd_service+="      [Unit]\n"
        systemd_service+="      Description=GraphDone Development Server\n"
        systemd_service+="      After=network.target docker.service\n"
        systemd_service+="      Requires=docker.service\n"
        systemd_service+="      \n"
        systemd_service+="      [Service]\n"
        systemd_service+="      Type=simple\n"
        systemd_service+="      User=ubuntu\n"
        systemd_service+="      WorkingDirectory=${GRAPHDONE_PATH}\n"
        systemd_service+="      ExecStart=/bin/bash -c 'source /home/ubuntu/.nvm/nvm.sh && ${GRAPHDONE_PATH}/start dev'\n"
        systemd_service+="      Restart=on-failure\n"
        systemd_service+="      RestartSec=10\n"
        systemd_service+="      \n"
        systemd_service+="      [Install]\n"
        systemd_service+="      WantedBy=multi-user.target\n"
        systemd_service+="    permissions: '0644'\n"
    fi

    local startup_config=""
    if [ "$RUN_ON_BOOT" = "true" ]; then
        startup_config="  - systemctl daemon-reload\n"
        startup_config+="  - systemctl enable graphdone\n"
    fi

    # Replace placeholders in cloud-init
    sed -i "s|{{DEV_TOOLS_PACKAGES}}|${dev_tools_packages}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{DOCKER_INSTALL}}|${docker_install}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{NODEJS_INSTALL}}|${nodejs_install}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{TAILSCALE_INSTALL}}|${tailscale_install}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{GRAPHDONE_SETUP}}|${graphdone_setup}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{GRAPHDONE_REPO}}|${GRAPHDONE_REPO}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{GRAPHDONE_BRANCH}}|${GRAPHDONE_BRANCH}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{GRAPHDONE_PATH}}|${GRAPHDONE_PATH}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{VM_NAME}}|${VM_NAME}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{SYSTEMD_SERVICE}}|${systemd_service}|g" "$CLOUD_INIT_OUTPUT"
    sed -i "s|{{STARTUP_CONFIG}}|${startup_config}|g" "$CLOUD_INIT_OUTPUT"

    log_success "✅ Cloud-init configuration generated"
}

# Launch VM
launch_vm() {
    log_info "🚀 Launching Multipass VM: $VM_NAME"

    # Check if VM already exists
    if multipass list | grep -q "^$VM_NAME"; then
        log_warning "⚠️  VM '$VM_NAME' already exists!"
        read -p "Do you want to delete and recreate it? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            delete_vm
        else
            log_info "Cancelled."
            exit 0
        fi
    fi

    # Read configuration
    read_config

    # Generate cloud-init
    generate_cloud_init

    # Launch VM
    log_info "Creating VM with:"
    log_info "  • Name: $VM_NAME"
    log_info "  • CPUs: $CPUS"
    log_info "  • Memory: $MEMORY"
    log_info "  • Disk: $DISK"
    log_info "  • Image: Ubuntu $IMAGE"
    log_info "  • Branch: $GRAPHDONE_BRANCH"

    multipass launch "$IMAGE" \
        --name "$VM_NAME" \
        --cpus "$CPUS" \
        --memory "$MEMORY" \
        --disk "$DISK" \
        --cloud-init "$CLOUD_INIT_OUTPUT"

    log_success "✅ VM launched successfully!"

    # Wait for cloud-init to complete
    log_info "⏳ Waiting for VM provisioning to complete (this may take several minutes)..."
    multipass exec "$VM_NAME" -- cloud-init status --wait

    log_success "✅ VM provisioning complete!"

    # Show VM info
    show_vm_info

    # Setup port forwarding if needed
    setup_port_forwarding
}

# Delete VM
delete_vm() {
    log_info "🗑️  Deleting VM: $VM_NAME"

    if multipass list | grep -q "^$VM_NAME"; then
        multipass delete "$VM_NAME"
        multipass purge
        log_success "✅ VM deleted"
    else
        log_warning "⚠️  VM '$VM_NAME' does not exist"
    fi
}

# Stop VM
stop_vm() {
    log_info "🛑 Stopping VM: $VM_NAME"

    if multipass list | grep -q "^$VM_NAME"; then
        multipass stop "$VM_NAME"
        log_success "✅ VM stopped"
    else
        log_warning "⚠️  VM '$VM_NAME' does not exist"
    fi
}

# Start VM
start_vm() {
    log_info "▶️  Starting VM: $VM_NAME"

    if multipass list | grep -q "^$VM_NAME"; then
        multipass start "$VM_NAME"
        log_success "✅ VM started"
        show_vm_info
    else
        log_warning "⚠️  VM '$VM_NAME' does not exist"
    fi
}

# Shell into VM
shell_vm() {
    log_info "🔌 Connecting to VM shell: $VM_NAME"
    multipass shell "$VM_NAME"
}

# Show VM info
show_vm_info() {
    log_info "📊 VM Information:"
    multipass info "$VM_NAME"

    echo ""
    log_info "🌐 Access GraphDone services:"
    local vm_ip=$(multipass info "$VM_NAME" | grep IPv4 | awk '{print $2}')
    echo -e "  ${GREEN}Web UI:${NC}       http://${vm_ip}:3127"
    echo -e "  ${GREEN}GraphQL API:${NC}  http://${vm_ip}:4127/graphql"
    echo -e "  ${GREEN}Neo4j Browser:${NC} http://${vm_ip}:7474"
    echo ""
    echo -e "  ${CYAN}Or use localhost if port forwarding is set up:${NC}"
    echo -e "  ${GREEN}Web UI:${NC}       http://localhost:3127"
    echo -e "  ${GREEN}GraphQL API:${NC}  http://localhost:4127/graphql"
    echo -e "  ${GREEN}Neo4j Browser:${NC} http://localhost:7474"
}

# Setup port forwarding (for macOS/Windows)
setup_port_forwarding() {
    # Note: Multipass on Linux uses a bridge network, so port forwarding isn't needed
    # On macOS/Windows, you may need to manually set up port forwarding or use SSH tunneling

    if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "msys"* ]]; then
        log_info "Setting up port forwarding..."

        local vm_ip=$(multipass info "$VM_NAME" | grep IPv4 | awk '{print $2}')

        log_info "For automatic port forwarding, run these commands in a separate terminal:"
        echo ""
        echo "  # Web UI"
        echo "  multipass exec $VM_NAME -- sudo iptables -t nat -A PREROUTING -p tcp --dport 3127 -j REDIRECT --to-port 3127"
        echo ""
        echo "  # GraphQL API"
        echo "  multipass exec $VM_NAME -- sudo iptables -t nat -A PREROUTING -p tcp --dport 4127 -j REDIRECT --to-port 4127"
        echo ""
        echo "  # Neo4j Browser"
        echo "  multipass exec $VM_NAME -- sudo iptables -t nat -A PREROUTING -p tcp --dport 7474 -j REDIRECT --to-port 7474"
        echo ""
        echo "  # Neo4j Bolt"
        echo "  multipass exec $VM_NAME -- sudo iptables -t nat -A PREROUTING -p tcp --dport 7687 -j REDIRECT --to-port 7687"
        echo ""
        log_info "Or access services directly via VM IP: $vm_ip"
    fi
}

# List all GraphDone VMs
list_vms() {
    log_info "📋 GraphDone Multipass VMs:"
    multipass list | grep -E "^graphdone-|Name"
}

# Show help
show_help() {
    echo -e "${BOLD}GraphDone Multipass VM Management${NC}"
    echo ""
    echo -e "${BOLD}USAGE:${NC}"
    echo "  ./tools/multipass.sh [COMMAND] [OPTIONS]"
    echo ""
    echo -e "${BOLD}COMMANDS:${NC}"
    echo -e "  ${CYAN}launch${NC}        Launch a new VM"
    echo -e "  ${CYAN}delete${NC}        Delete a VM"
    echo -e "  ${CYAN}stop${NC}          Stop a VM"
    echo -e "  ${CYAN}start${NC}         Start a stopped VM"
    echo -e "  ${CYAN}shell${NC}         Open shell in VM"
    echo -e "  ${CYAN}info${NC}          Show VM information"
    echo -e "  ${CYAN}list${NC}          List all GraphDone VMs"
    echo ""
    echo -e "${BOLD}OPTIONS:${NC}"
    echo -e "  ${YELLOW}--name NAME${NC}     VM name (default: from vm.config.yml)"
    echo -e "  ${YELLOW}--branch BRANCH${NC} Git branch to clone (default: from vm.config.yml)"
    echo -e "  ${YELLOW}--cpus N${NC}        Number of CPUs (default: from vm.config.yml)"
    echo -e "  ${YELLOW}--memory SIZE${NC}   Memory size (e.g., 4G, 8G)"
    echo -e "  ${YELLOW}--disk SIZE${NC}     Disk size (e.g., 20G, 50G)"
    echo ""
    echo -e "${BOLD}EXAMPLES:${NC}"
    echo -e "  ${GREEN}./tools/multipass.sh launch${NC}"
    echo -e "  ${GREEN}./tools/multipass.sh launch --name my-vm --branch develop${NC}"
    echo -e "  ${GREEN}./tools/multipass.sh launch --cpus 8 --memory 16G${NC}"
    echo -e "  ${GREEN}./tools/multipass.sh shell --name my-vm${NC}"
    echo -e "  ${GREEN}./tools/multipass.sh delete --name my-vm${NC}"
    echo ""
    echo -e "${BOLD}CONFIGURATION:${NC}"
    echo -e "  Edit ${CYAN}vm.config.yml${NC} to change default settings"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        launch|delete|stop|start|shell|info|list)
            COMMAND="$1"
            shift
            ;;
        --name)
            VM_NAME="$2"
            shift 2
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --cpus)
            CPUS="$2"
            shift 2
            ;;
        --memory)
            MEMORY="$2"
            shift 2
            ;;
        --disk)
            DISK="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check prerequisites
check_multipass
check_yq

# Read config for default VM name if not specified
if [ -z "$VM_NAME" ] && [ "$COMMAND" != "list" ]; then
    read_config
fi

# Execute command
case $COMMAND in
    launch)
        launch_vm
        ;;
    delete)
        delete_vm
        ;;
    stop)
        stop_vm
        ;;
    start)
        start_vm
        ;;
    shell)
        shell_vm
        ;;
    info)
        show_vm_info
        ;;
    list)
        list_vms
        ;;
    *)
        log_error "No command specified"
        show_help
        exit 1
        ;;
esac
