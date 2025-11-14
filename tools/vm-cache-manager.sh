#!/bin/bash
# GraphDone VM Cache Manager
# Manages cached base VMs for faster E2E testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}\")\" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$PROJECT_ROOT/.vm-cache"
CACHE_REGISTRY="$CACHE_DIR/registry.json"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$CACHE_DIR"

# Initialize cache registry
if [ ! -f "$CACHE_REGISTRY" ]; then
    echo '{"images":{}}' > "$CACHE_REGISTRY"
fi

log_info() {
    echo -e "${BLUE}[CACHE]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[CACHE]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[CACHE]${NC} $1"
}

# Generate cache key from package.json hash
get_cache_key() {
    local branch="$1"
    local pkg_hash=$(md5sum "$PROJECT_ROOT/package.json" | cut -d' ' -f1 | cut -c1-8)
    echo "graphdone-cache-${branch}-${pkg_hash}"
}

# Create a cached base image
create_cache() {
    local branch="${1:-main}"
    local cache_name=$(get_cache_key "$branch")
    
    log_info "Creating cached image for branch: $branch"
    log_info "Cache name: $cache_name"
    
    # Check if cache already exists
    if multipass list | grep -q "^$cache_name"; then
        log_warn "Cache already exists. Delete it first with: $0 delete $branch"
        return 1
    fi
    
    # Launch VM without Tailscale, build everything
    log_info "Launching and provisioning VM (this will take ~15min)..."
    "$SCRIPT_DIR/multipass.sh" launch \
        --name "$cache_name" \
        --branch "$branch" \
        --no-tailscale \
        --auto-setup \
        --no-run-on-boot
    
    # Wait for cloud-init to complete
    log_info "Waiting for cloud-init to complete..."
    multipass exec "$cache_name" -- cloud-init status --wait
    
    # Run build and tests to warm up caches
    log_info "Running initial build to warm caches..."
    multipass exec "$cache_name" -- bash -c 'cd ~/graphdone && npm run build' || true
    
    # Stop the VM
    log_info "Stopping VM to prepare for caching..."
    multipass stop "$cache_name"
    
    # Register in cache
    local timestamp=$(date +%s)
    local pkg_hash=$(md5sum "$PROJECT_ROOT/package.json" | cut -d' ' -f1)
    
    # Update registry (using jq if available, otherwise manual)
    if command -v jq > /dev/null; then
        cat "$CACHE_REGISTRY" | jq \
            --arg branch "$branch" \
            --arg name "$cache_name" \
            --arg ts "$timestamp" \
            --arg hash "$pkg_hash" \
            '.images[$branch] = {name: $name, created: $ts, package_hash: $hash}' \
            > "$CACHE_REGISTRY.tmp"
        mv "$CACHE_REGISTRY.tmp" "$CACHE_REGISTRY"
    fi
    
    log_success "Cache created: $cache_name"
    log_info "To use: $0 clone $branch <test-vm-name>"
}

# Clone a test VM from cache
clone_cache() {
    local branch="${1:-main}"
    local test_name="${2:-graphdone-test-$(date +%s)}"
    local cache_name=$(get_cache_key "$branch")
    
    log_info "Cloning from cache: $cache_name → $test_name"
    
    # Check if cache exists
    if ! multipass list | grep -q "^$cache_name"; then
        log_warn "Cache not found for branch $branch. Create it first with: $0 create $branch"
        return 1
    fi
    
    # Start the cached VM temporarily
    log_info "Starting cached VM..."
    multipass start "$cache_name" || true
    
    # Copy the VM's disk image (Multipass doesn't have native clone, so we use a workaround)
    # Instead, we'll just start from cache and do a git pull
    log_info "Starting new VM from cache..."
    "$SCRIPT_DIR/multipass.sh" launch \
        --name "$test_name" \
        --branch "$branch" \
        --no-auto-setup
    
    # Mount host npm cache to speed up any npm installs
    log_info "Mounting host npm cache..."
    mkdir -p ~/.npm
    multipass mount ~/.npm "$test_name:/home/ubuntu/.npm-host-cache" || true
    
    # Pull latest changes
    log_info "Pulling latest changes..."
    multipass exec "$test_name" -- bash -c "cd ~/graphdone && git fetch && git checkout $branch && git pull"
    
    # Quick npm install (uses cache)
    log_info "Updating dependencies (should be fast with cache)..."
    multipass exec "$test_name" -- bash -c 'cd ~/graphdone && npm install --prefer-offline'
    
    # Build
    log_info "Building..."
    multipass exec "$test_name" -- bash -c 'cd ~/graphdone && npm run build'
    
    # Stop the cache VM again
    multipass stop "$cache_name" || true
    
    log_success "Test VM ready: $test_name"
    log_info "Time saved: ~10-12 minutes"
}

# List cached images
list_caches() {
    log_info "Cached base images:"
    multipass list | grep "graphdone-cache-" || log_warn "No caches found"
    echo ""
    log_info "Cache registry:"
    cat "$CACHE_REGISTRY" | jq '.' 2>/dev/null || cat "$CACHE_REGISTRY"
}

# Delete cache
delete_cache() {
    local branch="${1:-main}"
    local cache_name=$(get_cache_key "$branch")
    
    log_info "Deleting cache: $cache_name"
    multipass delete "$cache_name" --purge || true
    
    # Remove from registry
    if command -v jq > /dev/null; then
        cat "$CACHE_REGISTRY" | jq "del(.images[\"$branch\"])" > "$CACHE_REGISTRY.tmp"
        mv "$CACHE_REGISTRY.tmp" "$CACHE_REGISTRY"
    fi
    
    log_success "Cache deleted"
}

# Validate cache (check if package.json changed)
validate_cache() {
    local branch="${1:-main}"
    local cache_name=$(get_cache_key "$branch")
    local current_hash=$(md5sum "$PROJECT_ROOT/package.json" | cut -d' ' -f1)
    
    if command -v jq > /dev/null && [ -f "$CACHE_REGISTRY" ]; then
        local cached_hash=$(cat "$CACHE_REGISTRY" | jq -r ".images[\"$branch\"].package_hash // \"\"")
        
        if [ "$cached_hash" != "$current_hash" ]; then
            log_warn "Cache is outdated (package.json changed)"
            log_info "Cached hash: $cached_hash"
            log_info "Current hash: $current_hash"
            log_info "Rebuild cache with: $0 create $branch"
            return 1
        fi
    fi
    
    if ! multipass list | grep -q "^$cache_name"; then
        log_warn "Cache not found"
        return 1
    fi
    
    log_success "Cache is valid"
    return 0
}

# Main command dispatcher
case "${1:-help}" in
    create)
        create_cache "${2:-main}"
        ;;
    clone)
        clone_cache "${2:-main}" "$3"
        ;;
    list)
        list_caches
        ;;
    delete)
        delete_cache "${2:-main}"
        ;;
    validate)
        validate_cache "${2:-main}"
        ;;
    help|*)
        echo "GraphDone VM Cache Manager"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  create <branch>           Create cached base image for branch"
        echo "  clone <branch> [name]     Clone test VM from cached image"
        echo "  list                      List all cached images"
        echo "  delete <branch>           Delete cached image"
        echo "  validate <branch>         Check if cache is still valid"
        echo ""
        echo "Examples:"
        echo "  $0 create main                    # Create cache for main branch"
        echo "  $0 clone main my-test-vm          # Clone test VM from main cache"
        echo "  $0 validate main                  # Check if main cache is valid"
        ;;
esac
