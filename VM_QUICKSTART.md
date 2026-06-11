# GraphDone VM Quick Start

Run GraphDone in an isolated Multipass VM with automatic setup.

## Installation

```bash
# macOS
brew install --cask multipass

# Ubuntu
sudo snap install multipass

# Windows
# Download from https://multipass.run
```

## Quick Start (30 seconds)

```bash
# 1. Launch VM with auto-generated fun name
./start vm launch
# Example output: Generated random VM name: graphdone-vm-happy-turtle-1234

# 2. Wait for setup to complete (2-5 minutes)
# VM will auto-configure Ubuntu, Docker, Node.js, and GraphDone

# 3. List your VMs to see the generated name
./start vm list

# 4. Get VM IP address (use your generated VM name)
multipass info graphdone-vm-happy-turtle-1234 | grep IPv4

# 5. Access GraphDone
# http://<vm-ip>:3127        - Web UI
# http://<vm-ip>:4127        - GraphQL API
# http://<vm-ip>:7474        - Neo4j Browser
```

## Common Commands

```bash
# Launch VM with custom settings
./start vm launch --branch develop --cpus 8 --memory 16G

# Connect to VM
./start vm shell

# Stop VM
./start vm stop

# Start VM
./start vm start

# Delete VM
./start vm delete

# List all VMs
./start vm list

# Show VM info
./start vm info
```

## Inside the VM

```bash
# Shortcuts available in VM shell
gd              # Go to GraphDone directory
gd-start        # Start GraphDone
gd-stop         # Stop GraphDone
gd-status       # Check status

# Or use directly
cd ~/graphdone
./start dev
./start status
```

## Configuration

Edit `vm.config.yml` to customize:

```yaml
resources:
  cpus: 4       # CPU cores
  memory: 8G    # RAM
  disk: 30G     # Disk space

graphdone:
  branch: main  # Git branch to use
  auto_setup: true
  auto_seed: true

tailscale:
  enabled: false
  auth_key: ""  # Tailscale auth key
```

## Tailscale Integration

1. Get auth key: https://login.tailscale.com/admin/settings/keys
2. Set in config or environment:
   ```bash
   export TAILSCALE_AUTH_KEY="tskey-auth-xxxxx"
   ./start vm launch
   ```
3. VM joins your Tailscale network automatically

## Multiple VMs

Run different branches simultaneously:

```bash
# Main branch
./start vm launch --name main-vm --branch main

# Feature branch
./start vm launch --name feature-vm --branch feature/new-ui

# Shell into each
./start vm shell --name main-vm
./start vm shell --name feature-vm
```

## Troubleshooting

```bash
# VM not starting?
multipass list                    # Check status
./start vm delete                 # Delete and recreate
./start vm launch

# Services not accessible?
./start vm shell                  # Connect to VM
cd ~/graphdone && ./start status  # Check services
docker ps                         # Check containers

# Cloud-init still running?
./start vm shell
cloud-init status                 # Check provisioning status
```

## Full Documentation

See [docs/VM_SETUP.md](docs/VM_SETUP.md) for complete documentation including:
- Advanced configuration
- Network setup
- Port forwarding
- CI/CD integration
- Security best practices

## Command Reference

| Command | Description |
|---------|-------------|
| `./start vm launch` | Create and start new VM |
| `./start vm delete` | Delete VM and all data |
| `./start vm stop` | Stop running VM |
| `./start vm start` | Start stopped VM |
| `./start vm shell` | Open shell in VM |
| `./start vm info` | Show VM details |
| `./start vm list` | List all GraphDone VMs |

## Options

| Option | Description | Example |
|--------|-------------|---------|
| `--name` | VM name | `--name my-dev` |
| `--branch` | Git branch | `--branch develop` |
| `--cpus` | CPU cores | `--cpus 8` |
| `--memory` | RAM | `--memory 16G` |
| `--disk` | Disk size | `--disk 50G` |

## Environment Variables

Create `.env.vm` from `.env.vm.example`:

```bash
cp .env.vm.example .env.vm
# Edit .env.vm with your settings
```

Key variables:
- `TAILSCALE_AUTH_KEY` - Tailscale authentication
- `VM_BRANCH` - Default Git branch
- `VM_CPUS` - Default CPU count
- `VM_MEMORY` - Default memory
- `VM_DISK` - Default disk size

---

**Need help?** See [docs/VM_SETUP.md](docs/VM_SETUP.md) or run `./start vm --help`
