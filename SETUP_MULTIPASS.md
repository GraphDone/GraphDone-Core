# Setting Up Multipass for GraphDone

This guide will help you set up Multipass so you can run GraphDone VMs independently.

## Step 1: Authenticate Multipass

Multipass needs one-time authentication after installation:

```bash
multipass authenticate
```

You'll be prompted to enter a passphrase. This creates a secure connection between your user account and the Multipass service.

## Step 2: Install yq (YAML processor)

Run the automated setup script:

```bash
./tools/setup-vm-tools.sh
```

This will:
- Verify Multipass is installed and authenticated
- Install `yq` to `~/.local/bin/` (no sudo required)
- Add `~/.local/bin` to your PATH if needed
- Verify everything is working

### Manual yq Installation (if needed)

**macOS:**
```bash
brew install yq
```

**Ubuntu/Linux (without sudo):**
```bash
# Create local bin directory
mkdir -p ~/.local/bin

# Download yq
wget https://github.com/mikefarah/yq/releases/download/v4.35.1/yq_linux_amd64 \
  -O ~/.local/bin/yq

# Make executable
chmod +x ~/.local/bin/yq

# Add to PATH (add this to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Reload your shell or source the file
source ~/.bashrc
```

## Step 3: Verify Setup

Check that everything is ready:

```bash
# Check Multipass
multipass list

# Check yq
yq --version

# Test VM command
./start vm --help
```

You should see:
- Multipass list showing no VMs or existing VMs
- yq version 4.x
- VM help menu with all commands

## Step 4: Launch Your First VM

```bash
# Simple launch with defaults
./start vm launch

# Or with custom settings
./start vm launch --branch develop --cpus 8 --memory 16G
```

The VM will:
1. Get a fun random name (e.g., `graphdone-vm-happy-turtle-1234`)
2. Provision Ubuntu 24.04
3. Install Docker, Node.js 20, and all dependencies
4. Clone GraphDone from your specified branch
5. Run `./start setup` automatically
6. Seed the database with test data
7. Be ready to use in 3-5 minutes

## Step 5: Access Your VM

```bash
# List all VMs
./start vm list

# Connect to VM shell
./start vm shell

# Or specify VM name
./start vm shell --name graphdone-vm-happy-turtle-1234
```

Inside the VM, use these shortcuts:
```bash
gd           # Go to GraphDone directory
gd-start     # Start GraphDone
gd-stop      # Stop GraphDone
gd-status    # Check status
```

## Step 6: Access GraphDone Services

Get your VM's IP address:

```bash
multipass info <your-vm-name> | grep IPv4
```

Then access services at:
- **Web UI:** `http://<vm-ip>:3127`
- **GraphQL API:** `http://<vm-ip>:4127/graphql`
- **Neo4j Browser:** `http://<vm-ip>:7474`

## Common Issues and Solutions

### "Multipass needs authentication"

```bash
multipass authenticate
# Follow the prompts
```

### "yq not found"

```bash
# Run setup script
./tools/setup-vm-tools.sh

# Or install manually (see Step 2)
```

### "Permission denied" when installing yq

The setup script installs to `~/.local/bin` which doesn't need sudo. If you see this error, make sure you're not using `sudo`:

```bash
# Don't do this
sudo ./tools/setup-vm-tools.sh

# Do this instead
./tools/setup-vm-tools.sh
```

### PATH not updated

After installing yq, reload your shell:

```bash
source ~/.bashrc   # or ~/.zshrc for zsh
```

Or close and reopen your terminal.

### VM won't start

Check Multipass status:

```bash
multipass list
multipass info <vm-name>
```

If the VM is in an error state:

```bash
./start vm delete --name <vm-name>
./start vm launch
```

## Testing the Setup (Without Launching a VM)

You can verify the scripts work without actually launching a VM:

```bash
# Test script syntax
bash -n ./tools/multipass.sh
bash -n ./start

# Test help menus
./start vm --help
./tools/multipass.sh --help

# Test random name generation
bash -c 'source <(grep -A 20 "^ADJECTIVES=" ./tools/multipass.sh); source <(grep -A 6 "^generate_random_name" ./tools/multipass.sh); generate_random_name'
```

## Tailscale Integration (Optional)

GraphDone VMs can automatically join your Tailscale network for secure mesh networking:

### Setup Tailscale

1. **Get an auth key** from https://login.tailscale.com/admin/settings/keys
   - Click "Generate auth key"
   - Enable "Ephemeral" for security (VM will be removed when stopped)
   - Copy the generated key (starts with `tskey-auth-`)

2. **Add to your `.env` file:**
   ```bash
   TAILSCALE_AUTH_KEY=tskey-auth-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Enable in `vm.config.yml`:**
   ```yaml
   tailscale:
     enabled: true
     flags: ""  # Optional: e.g., "--advertise-routes=10.0.0.0/24"
   ```

4. **Launch VM** - Tailscale will auto-configure:
   ```bash
   ./start vm launch
   ```

### Benefits

- **Secure Access:** Access VM services from anywhere via Tailscale IP
- **Multi-VM Networking:** VMs can communicate with each other
- **No Port Forwarding:** Access services directly without complex networking
- **Persistent Identity:** VMs get consistent Tailscale hostnames

### Usage

After Tailscale is configured, access your VM services via Tailscale hostname:
```bash
# Find VM's Tailscale hostname
tailscale status

# Access GraphDone from any device on your Tailscale network
http://<vm-tailscale-hostname>:3127
```

## Advanced: Running Tests Independently

Once setup is complete, Claude Code (or you) can run these commands:

```bash
# Launch a test VM
./start vm launch --name test-vm --branch main

# Wait for provisioning (check status)
multipass exec test-vm -- cloud-init status --wait

# Run tests inside VM
multipass exec test-vm -- bash -c 'cd ~/graphdone && ./start test'

# Cleanup
./start vm delete --name test-vm
```

## Full Automation Script

Save this as `test-vm-full.sh` for completely automated testing:

```bash
#!/bin/bash
set -e

VM_NAME="test-$(date +%s)"
BRANCH="${1:-main}"

echo "🚀 Launching VM: $VM_NAME with branch: $BRANCH"
./start vm launch --name "$VM_NAME" --branch "$BRANCH"

echo "⏳ Waiting for provisioning..."
multipass exec "$VM_NAME" -- cloud-init status --wait

echo "🧪 Running tests..."
multipass exec "$VM_NAME" -- bash -c 'cd ~/graphdone && ./start test'

echo "🧹 Cleaning up..."
./start vm delete --name "$VM_NAME"

echo "✅ All done!"
```

Usage:
```bash
chmod +x test-vm-full.sh
./test-vm-full.sh          # Test main branch
./test-vm-full.sh develop  # Test develop branch
```

## Next Steps

- Read [VM_QUICKSTART.md](VM_QUICKSTART.md) for quick reference
- Read [docs/VM_SETUP.md](docs/VM_SETUP.md) for advanced configuration
- Configure Tailscale for mesh networking
- Set up multiple VMs for different branches

---

**Need Help?**

Run `./start vm --help` or check the documentation at `docs/VM_SETUP.md`.
