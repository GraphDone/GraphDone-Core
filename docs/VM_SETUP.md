# GraphDone Multipass VM Setup

This guide explains how to run GraphDone in a Multipass VM for isolated development and testing.

## Prerequisites

1. **Multipass** - Install from [multipass.run](https://multipass.run)
   - macOS: `brew install --cask multipass`
   - Ubuntu: `sudo snap install multipass`
   - Windows: Download from website

2. **yq** - YAML processor (automatically installed if missing)
   - macOS: `brew install yq`
   - Ubuntu: Auto-installed by the script

## Quick Start

```bash
# Launch a VM with auto-generated random name
./start vm launch
# Example: graphdone-vm-happy-turtle-1234

# List VMs to see your generated name
./start vm list

# Connect to the VM (use your generated name)
./start vm shell --name graphdone-vm-happy-turtle-1234

# Or if you only have one VM
multipass shell <your-vm-name>

# Inside the VM, GraphDone is automatically set up at ~/graphdone
cd ~/graphdone
./start status
```

### VM Names

By default, VMs get fun random names like:
- `graphdone-vm-happy-turtle-1234`
- `graphdone-vm-cosmic-dragon-5678`
- `graphdone-vm-mighty-phoenix-9012`

You can specify a custom name with `--name`:
```bash
./start vm launch --name my-dev-vm
```

## Configuration

Edit `vm.config.yml` to customize your VM:

### Basic Resources

```yaml
resources:
  cpus: 4        # Number of CPU cores
  memory: 8G     # RAM (4G, 8G, 16G, etc.)
  disk: 30G      # Disk size (20G, 50G, etc.)
```

### Git Configuration

```yaml
graphdone:
  repo_url: "https://github.com/GraphDone/GraphDone-Core.git"
  branch: "main"           # Change to develop, feature/xxx, etc.
  clone_path: "/home/ubuntu/graphdone"
  auto_setup: true         # Run ./start setup automatically
  auto_seed: true          # Seed database with test data
```

### Tailscale Integration

```yaml
tailscale:
  enabled: true
  auth_key: "tskey-auth-xxxxx"  # Get from https://login.tailscale.com/admin/settings/keys
  flags: "--advertise-tags=tag:dev"
```

To use Tailscale:
1. Go to https://login.tailscale.com/admin/settings/keys
2. Generate an **ephemeral** auth key
3. Set it in `vm.config.yml` or via environment variable:
   ```bash
   export TAILSCALE_AUTH_KEY="tskey-auth-xxxxx"
   ./start vm launch
   ```

### Node.js Version

```yaml
nodejs:
  version: "20"      # 18, 20, or latest
  use_nvm: true      # Recommended for version management
```

### Startup Configuration

```yaml
startup:
  auto_start: false      # Start VM on host boot
  run_on_boot: true      # Start GraphDone services on VM boot
```

## Usage

### Launch a VM

```bash
# Default configuration
./start vm launch

# Custom branch
./start vm launch --branch develop

# Custom resources
./start vm launch --cpus 8 --memory 16G --disk 50G

# Custom name and branch
./start vm launch --name my-dev-vm --branch feature/new-ui
```

### Manage VMs

```bash
# List all GraphDone VMs
./start vm list

# Connect to VM shell
./start vm shell
./start vm shell --name my-vm

# Show VM info
./start vm info

# Stop VM
./start vm stop

# Start a stopped VM
./start vm start

# Delete VM
./start vm delete
```

### Access Services

After launching a VM, services are available at:

**Via VM IP:**
- Web UI: `http://<vm-ip>:3127`
- GraphQL API: `http://<vm-ip>:4127/graphql`
- Neo4j Browser: `http://<vm-ip>:7474`

Get the VM IP:
```bash
multipass info graphdone-dev | grep IPv4
```

**Via localhost** (requires port forwarding):
- Web UI: `http://localhost:3127`
- GraphQL API: `http://localhost:4127/graphql`
- Neo4j Browser: `http://localhost:7474`

## Command-Line Options

All VM commands support these options:

| Option | Description | Example |
|--------|-------------|---------|
| `--name NAME` | VM name | `--name my-dev` |
| `--branch BRANCH` | Git branch | `--branch develop` |
| `--cpus N` | Number of CPUs | `--cpus 8` |
| `--memory SIZE` | Memory size | `--memory 16G` |
| `--disk SIZE` | Disk size | `--disk 50G` |

## Inside the VM

When you shell into the VM, helpful aliases are available:

```bash
# GraphDone shortcuts
gd              # cd to GraphDone directory
gd-start        # Start GraphDone
gd-stop         # Stop GraphDone
gd-status       # Check status

# Or use directly
cd ~/graphdone
./start dev
./start status
./start test
```

## Advanced Configuration

### Mount Host Directories

```yaml
mounts:
  enabled: true
  paths:
    - "~/graphdone-data:/home/ubuntu/data"
    - "~/projects:/home/ubuntu/projects"
```

### Custom Development Tools

```yaml
development:
  dev_tools:
    - git
    - vim
    - htop
    - tmux
    - jq
```

### Network Configuration

```yaml
network:
  bridged: true              # Use bridged network (external IP)
  bridge_interface: "eth0"   # Bridge interface name
```

## Troubleshooting

### VM fails to launch

```bash
# Check Multipass status
multipass list

# View VM logs
multipass exec graphdone-dev -- journalctl -xe

# Delete and recreate
./start vm delete
./start vm launch
```

### Services not starting

```bash
# Shell into VM
./start vm shell

# Check GraphDone status
cd ~/graphdone
./start status

# Check logs
docker logs graphdone-neo4j
journalctl -u graphdone -f
```

### Port forwarding not working

On macOS/Windows, Multipass uses NAT. Access services via VM IP:

```bash
# Get VM IP
multipass info graphdone-dev | grep IPv4

# Access directly
curl http://<vm-ip>:3127
```

Or set up SSH tunnel:

```bash
# Forward port 3127
multipass exec graphdone-dev -- sudo iptables -t nat -A PREROUTING -p tcp --dport 3127 -j REDIRECT --to-port 3127
```

### Tailscale not connecting

```bash
# Check Tailscale status in VM
./start vm shell
sudo tailscale status

# Reconnect
sudo tailscale up --authkey=<your-key>
```

## Performance Tips

1. **Allocate enough resources**: Development needs at least 4 CPUs and 8GB RAM
2. **Use SSD**: Multipass performs better on SSDs
3. **Enable Docker caching**: Speeds up container operations
4. **Use bridged networking**: Better performance than NAT on Linux

## Security Notes

1. **Use ephemeral Tailscale keys**: They expire and are safer
2. **Don't commit auth keys**: Use environment variables
3. **Limit VM resources**: Prevent host resource exhaustion
4. **Regular updates**: Keep Multipass and Ubuntu updated

## Integration with CI/CD

Use VMs for consistent testing:

```bash
# In CI pipeline
./start vm launch --name ci-test-$CI_BUILD_ID --branch $CI_BRANCH
./start vm shell --name ci-test-$CI_BUILD_ID -- "cd ~/graphdone && ./start test"
./start vm delete --name ci-test-$CI_BUILD_ID
```

## Examples

### Development on different branches

```bash
# Main branch VM
./start vm launch --name main-dev --branch main

# Feature branch VM
./start vm launch --name feature-dev --branch feature/new-api

# Work on both simultaneously
./start vm shell --name main-dev
./start vm shell --name feature-dev
```

### Testing with different resources

```bash
# Minimum viable setup
./start vm launch --name min-test --cpus 2 --memory 4G

# Production-like setup
./start vm launch --name prod-test --cpus 8 --memory 16G --disk 100G
```

### Tailscale mesh network

```bash
# Launch VMs that can communicate via Tailscale
export TAILSCALE_AUTH_KEY="tskey-auth-xxxxx"

./start vm launch --name dev1 --branch main
./start vm launch --name dev2 --branch develop

# VMs can now reach each other via Tailscale IPs
```

## Cleanup

```bash
# Delete a specific VM
./start vm delete --name my-vm

# Delete all GraphDone VMs
multipass list | grep graphdone | awk '{print $1}' | xargs -I {} multipass delete {}
multipass purge

# Clean up cloud-init artifacts
rm -f /tmp/graphdone-cloud-init.yml
```

## Additional Resources

- [Multipass Documentation](https://multipass.run/docs)
- [Cloud-init Documentation](https://cloud-init.io/)
- [Tailscale Documentation](https://tailscale.com/kb/)
- [GraphDone Documentation](../README.md)
