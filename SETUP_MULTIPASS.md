# Multipass VM Setup for GraphDone

Complete guide for using GraphDone's Multipass VM integration for isolated testing and development.

---

## Quick Start

The VM launcher is fully integrated with `./start` for easy discoverability:

### Launch a VM with one command:
```bash
./start vm launch
```

This will:
1. Create a new Ubuntu 24.04 VM with optimal resources (4 CPUs, 8GB RAM, 30GB disk)
2. Clone GraphDone code from the configured branch (default: `develop`)
3. Install all dependencies (Node.js, npm packages, Playwright browsers, Docker)
4. Run automatic health checks to verify the setup
5. Display connection information

### Other Common Commands:
```bash
./start vm shell         # Open shell in VM
./start vm list          # List all VMs
./start vm delete        # Delete a VM
./start vm info          # Show VM information
```

### Custom Launch Options:
```bash
# Launch with specific branch
./start vm launch --branch main

# Launch with custom resources
./start vm launch --cpus 8 --memory 16G --disk 50G

# Launch with custom name
./start vm launch --name my-test-vm --branch feature-xyz
```

---

## Health Check

The VM launcher automatically runs health checks after provisioning to verify:

- ✅ GraphDone code cloned successfully
- ✅ Node.js installed (v20+)
- ✅ npm dependencies installed
- ✅ Playwright browsers installed
- ✅ Docker installed and running
- ✅ Tailscale connected (if enabled)

The health check output is displayed automatically after launch.

You can also run health checks manually on existing VMs:

```bash
# Run comprehensive health check
multipass exec <vm-name> -- bash -c 'cd ~/graphdone && npm run test'

# Check Tailscale status
multipass exec <vm-name> -- tailscale status
```

---

## Complete Usage Guide

### Installation

Install Multipass first:

```bash
# macOS
brew install --cask multipass

# Ubuntu/Linux
sudo snap install multipass

# Windows
# Download from https://multipass.run
```

### Running E2E Tests in VM

To run comprehensive E2E tests in a VM:

```bash
./tools/test-vm-e2e.sh <branch-name>
```

This will:
- Launch a VM with the specified branch
- Run linting, typechecking, building
- Run unit tests
- Run E2E tests (core suite)
- Run visual regression screenshot suite (21 devices × 10 screens)
- Collect all artifacts (screenshots, coverage, Playwright reports)
- Generate test manifest for GraphDone-DevOps integration

### Configuration

Edit `vm.config.yml` to change default settings:

```yaml
vm:
  name: graphdone-vm
  cpus: 4
  memory: 8G
  disk: 30G
  image: 24.04

graphdone:
  repository: https://github.com/GraphDone/GraphDone-Core.git
  branch: develop

setup:
  auto_setup: true  # Automatically install dependencies on first boot
```

### Accessing Services

After the VM is launched, you can access GraphDone services:

```bash
# Get VM IP
multipass info <vm-name> | grep IPv4

# Access services
Web UI:       http://<vm-ip>:3127
GraphQL API:  http://<vm-ip>:4127/graphql
Neo4j Browser: http://<vm-ip>:7474
```

---

## Tailscale Integration

VMs are automatically connected to your Tailscale network for remote access from any device.

### Setup Tailscale Auth Key

**Required:** You must configure a Tailscale auth key before launching VMs.

1. **Generate an auth key** at https://login.tailscale.com/admin/settings/keys
   - ✅ Check "Ephemeral" (VMs are temporary)
   - ✅ Set expiration (90 days recommended)
   - ✅ Copy the key (starts with `tskey-auth-...`)

2. **Add the key to .env file:**
   ```bash
   # Edit .env and add:
   TAILSCALE_AUTH_KEY=tskey-auth-YOUR_KEY_HERE
   ```

3. **Verify it's loaded:**
   ```bash
   source .env
   echo $TAILSCALE_AUTH_KEY
   ```

### Accessing VMs via Tailscale

Once a VM is launched with Tailscale configured:

```bash
# Get Tailscale IP
multipass exec <vm-name> -- tailscale ip -4

# SSH via Tailscale (from any device on your tailnet)
ssh ubuntu@<tailscale-ip>

# Or use the hostname
ssh ubuntu@<vm-name>.your-tailnet.ts.net
```

### Tailscale Status Check

```bash
# Check if Tailscale is connected
multipass exec <vm-name> -- tailscale status

# Get Tailscale IP
multipass exec <vm-name> -- tailscale ip -4

# View all devices on your tailnet
multipass exec <vm-name> -- tailscale status
```

### Manually Configure Tailscale on Existing VM

If a VM was launched before Tailscale was configured:

```bash
# Source the .env with your auth key
source .env

# Configure Tailscale on the VM
multipass exec <vm-name> -- sudo tailscale up \
  --authkey="$TAILSCALE_AUTH_KEY" \
  --accept-routes \
  --accept-dns=false \
  --shields-up=false
```

### Disabling Tailscale

If you don't need Tailscale, disable it in `vm.config.yml`:

```yaml
tailscale:
  enabled: false  # Change from true to false
```

### Troubleshooting Tailscale

**Error: "invalid key: API key ... not valid"**
- Your Tailscale auth key has expired
- Generate a new key at https://login.tailscale.com/admin/settings/keys
- Update `.env` with the new key
- Relaunch VMs or manually reconfigure existing ones

**VM not showing in Tailscale admin:**
- Check if Tailscale is running: `multipass exec <vm-name> -- systemctl status tailscaled`
- Check logs: `multipass exec <vm-name> -- journalctl -u tailscaled -n 50`
- Verify auth key is set: `source .env && echo $TAILSCALE_AUTH_KEY`

### Troubleshooting

**VM stuck in "Starting" state:**
```bash
multipass exec <vm-name> -- cloud-init status
multipass exec <vm-name> -- tail -100 /var/log/cloud-init-output.log
```

**Dependencies not installed:**
```bash
# Wait for cloud-init to complete
multipass exec <vm-name> -- cloud-init status --wait

# Manually run setup
multipass exec <vm-name> -- bash -c 'cd ~/graphdone && npm install'
```

---

## Performance Optimization

This section outlines strategies to speed up E2E testing with Multipass VMs.

## Current Performance Bottlenecks

**Full VM Setup Time: ~10-15 minutes**
- VM Launch: 30s
- Cloud-init provisioning: 1-2min
- Node.js installation: 1min
- GraphDone clone: 30s
- npm install: 5-8min (largest bottleneck!)
- Playwright browsers: 2-3min
- Database seeding: 30s

## Optimization Strategies

### 1. VM Image Caching (Fastest - Recommended)

**Concept:** Pre-build base VMs with all dependencies, clone for testing

**Benefits:**
- Reduces setup time from 15min → 2min
- Consistent test environment
- Parallel test execution possible

**Implementation:**
```bash
# Create base images for common branches
./tools/create-base-image.sh main
./tools/create-base-image.sh develop  
./tools/create-base-image.sh vm_multi-pass

# Use cached image for testing
./tools/test-vm-e2e.sh main --use-cache
```

**Cache Invalidation:**
- Update base images nightly via cron
- Rebuild on package.json changes
- Tag images with dependency hash

### 2. Layered Caching Strategy

**Layer 1: Base OS + System Dependencies** (rarely changes)
- Ubuntu 22.04
- Docker, Node.js, build-essential
- Playwright browsers + system deps
- **Cache duration:** Weeks/months

**Layer 2: GraphDone Dependencies** (changes weekly)
- node_modules from package.json
- Playwright browsers
- Docker images (Neo4j, Redis)
- **Cache duration:** 1 week or until package.json changes

**Layer 3: Source Code** (changes frequently)
- Git clone + checkout specific branch
- Build artifacts
- **Cache duration:** Per test run

### 3. Parallel Testing Architecture

```
┌─────────────────┐
│  Base Image     │
│  (cached)       │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    ▼         ▼        ▼        ▼
  Test VM1  Test VM2  Test VM3  Test VM4
  (main)    (develop) (PR-123)  (PR-124)
```

Run multiple test VMs in parallel from the same base image.

### 4. Docker Layer Caching

Pre-pull and cache Docker images in the base VM:
```bash
# In base image creation
docker pull neo4j:5.15-community
docker pull redis:7-alpine
```

### 5. npm Dependency Caching

**Option A: Local npm cache**
```bash
# Mount host npm cache into VM
multipass mount ~/.npm graphdone-vm:/home/ubuntu/.npm
```

**Option B: Verdaccio local npm registry**
- Run local npm proxy
- Cache all packages locally
- Reduces npm install from 8min → 1min

### 6. Incremental Updates

Instead of full rebuild, only update what changed:
```bash
# In cached VM
cd ~/graphdone
git fetch origin
git checkout $BRANCH
git pull
npm install  # Only installs new deps
npm run build
```

## Implementation Priority

1. **Phase 1: Basic Caching** (implement first)
   - Create base image script ✅
   - Add `--use-cache` flag to test script
   - Auto-rebuild base images nightly

2. **Phase 2: Smart Invalidation**
   - Hash package.json for cache keys
   - Detect dependency changes
   - Partial updates when possible

3. **Phase 3: Parallel Testing**
   - Clone VMs from base image
   - Run multiple branches simultaneously
   - Aggregate test results

4. **Phase 4: Advanced Caching**
   - Local npm registry (Verdaccio)
   - Docker image pre-caching
   - Build artifact caching

## Expected Performance Gains

| Strategy | Time Saved | Complexity | Priority |
|----------|-----------|------------|----------|
| VM Image Caching | 10-13min | Low | High |
| npm Cache | 5-7min | Medium | High |
| Docker Pre-pull | 1-2min | Low | Medium |
| Parallel Tests | N/A (throughput) | High | Low |
| Local npm Registry | 6-7min | High | Low |

**Target:** Reduce E2E test time from ~15min to **2-3min** with basic caching.

## Maintenance

**Daily:**
- Check base image health
- Clean up old test VMs

**Weekly:**
- Rebuild base images for active branches
- Update Playwright browsers
- Clean npm/Docker caches

**On package.json change:**
- Trigger base image rebuild
- Invalidate relevant caches

## Monitoring

Track metrics:
- VM launch time
- npm install duration
- Total test time
- Cache hit rate
- Storage usage

Store in test reports for trend analysis.
