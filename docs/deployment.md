# GraphDone Deployment Guide

## 🚀 Quick Install (One-Command Setup)

GraphDone can be installed with a single command on macOS and Linux:

### Using GitHub (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/install.sh | sh
```

or using wget:

```bash
wget -qO- https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/install.sh | sh
```

### Using Custom Domain (Future)

Once deployed to graphdone.com:

```bash
curl -fsSL https://graphdone.com/install.sh | sh
```

## 📋 What the Installer Does

The installation script performs 9 automated steps:

### 1. Pre-flight Checks
- Network connectivity validation
- Disk space check (5GB minimum required)
- Download speed test (CloudFlare CDN)
- Upload speed test

### 2. System Information
- Platform detection (macOS/Linux)
- OS version compatibility check
- Architecture detection (x86_64/arm64)
- Shell environment validation

### 3. Dependency Installation
Automatically installs missing dependencies with smart sudo authentication:

**macOS:**
- Git via Homebrew
- Node.js 18+ via Homebrew
- OrbStack (lightweight Docker alternative) via Homebrew

**Linux (15+ distributions):**
- **Smart Sudo Management**:
  - Checks if sudo is already cached (no prompt if recently authenticated)
  - Works with curl/wget pipes via `/dev/tty` reconnection
  - Works with local execution (`sh install.sh`)
  - Requests administrative privileges once upfront
  - Keeps sudo alive (60-second refresh) during installation
  - Automatically clears sudo cache on exit for security
- Git via apt-get/dnf/yum
- Node.js 22 LTS via nvm
- Docker Engine via Snap (preferred) or apt-get/dnf/yum

**Supported Linux Distributions:**
- Ubuntu 20.04+, 22.04+, 24.04+
- Debian 10+, 11+, 12+
- Fedora 38+, 39+, 40+
- RHEL 8+, 9+
- CentOS 8+, Stream 9
- Rocky Linux 8+, 9+
- AlmaLinux 8+, 9+
- Linux Mint 20+, 21+
- Pop!_OS 22.04+
- Elementary OS 6+, 7+
- Arch Linux, Manjaro
- openSUSE Leap 15+, Tumbleweed

### 4. Code Installation
- Clones GraphDone repository to `~/graphdone`
- Installs npm dependencies with smart retry logic
- Handles package conflicts automatically

### 5. Environment Configuration
- Creates `.env` file from template
- Configures Neo4j credentials
- Sets up Redis connection
- Configures API and Web URLs with HTTPS

### 6. Security Initialization
- Generates self-signed TLS certificates
- Sets proper file permissions (600 for keys, 644 for certs)
- Enables HTTPS for API (port 4128) and Web (port 3128)

### 7. Services Status Check
- Checks if Docker containers are already running
- Validates container health status
- Tests Neo4j and Redis connectivity

### 8. Container Cleanup
- Stops old containers gracefully
- Removes orphaned containers
- Cleans up Docker volumes

### 9. Service Deployment
- Starts Neo4j database (ports 7474, 7687)
- Starts Redis cache (port 6379)
- Starts GraphQL API (port 4128 HTTPS)
- Starts React Web App (port 3128 HTTPS)
- Waits for all services to be healthy (60s timeout)

## 🌐 After Installation

Your GraphDone instance will be available at:

- **Web Application:** https://localhost:3128
  - Main interface for managing work items and graph visualization
- **GraphQL API:** https://localhost:4128/graphql
  - Apollo GraphQL Playground for API exploration
- **Neo4j Database Browser:** http://localhost:7474
  - Username: `neo4j`
  - Password: `graphdone_password`
  - Cypher query interface for direct database access

## ⚙️ Management Commands

```bash
# Stop all GraphDone services
sh ~/graphdone/public/install.sh stop

# Complete cleanup (removes containers, volumes)
sh ~/graphdone/public/install.sh remove

# Reinstall/update GraphDone
sh ~/graphdone/public/install.sh install
```

## 📊 System Requirements

- **Disk Space:** 5GB minimum free space
- **Memory:** 4GB RAM minimum (8GB recommended)
- **Network:** Internet connection required for installation
- **OS:** macOS 10.15+ or modern Linux distribution
- **Shell:** POSIX-compatible shell (sh, bash, zsh, dash)

## 🔧 Troubleshooting

### Installation Logs

Logs are automatically saved to:
```
~/graphdone-logs/installation-YYYY-MM-DD_HH-MM-SS.log
```

### Common Issues

**Port Conflicts:**
- Stop services using ports 3128, 4128, 7474, 7687, 6379
- Check with: `lsof -i :3128` or `netstat -tuln | grep 3128`

**Docker Not Starting:**
- Ensure Docker Desktop or OrbStack is running
- macOS: Check OrbStack status in menu bar
- Linux: `sudo systemctl status docker`

**Permission Errors:**
- Script requires sudo for system package installation
- Ensure your user has sudo privileges

**Network Errors:**
- Check firewall settings
- Verify internet connectivity
- Test with: `curl -I https://github.com`

### Manual Installation

If the automated installer fails, see [Getting Started — Manual Setup](./guides/getting-started.md)

## Hosting the Installation Script

To host the installation script on graphdone.com:

### 1. Copy Script to Web Server

Place `public/start.sh` in your web server's document root:

```bash
# Example for nginx
sudo cp public/start.sh /var/www/graphdone.com/start.sh
sudo chmod 644 /var/www/graphdone.com/start.sh

# Example for Apache
sudo cp public/start.sh /var/www/html/start.sh
sudo chmod 644 /var/www/html/start.sh
```

### 2. Configure Web Server

#### Nginx Configuration

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name graphdone.com www.graphdone.com;
    
    location /start.sh {
        root /var/www/graphdone.com;
        add_header Content-Type text/plain;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

#### Apache Configuration

```apache
<VirtualHost *:80>
    ServerName graphdone.com
    DocumentRoot /var/www/html
    
    <Location /start.sh>
        Header set Content-Type "text/plain"
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </Location>
</VirtualHost>
```

### 3. Using CDN (Recommended)

For better global distribution:

#### Cloudflare
1. Upload `start.sh` to your origin server
2. Create a Page Rule for `/start.sh`:
   - Cache Level: No Cache
   - Always Online: Off

#### AWS CloudFront
1. Upload to S3: `s3://graphdone.com/start.sh`
2. Set Cache-Control header: `no-cache`
3. Configure CloudFront distribution

### 4. GitHub Pages Alternative

If using GitHub Pages for graphdone.com:

1. Place script in repository root or `docs/` folder
2. Access via: `https://graphdone.github.io/start.sh`
3. Configure custom domain to point to GitHub Pages

## Testing the Installation

```bash
# Test the script locally
sh public/start.sh

# Test from remote URL (once deployed)
curl -fsSL https://graphdone.com/start.sh | sh
```

## Environment Variables

Users can customize installation:

```bash
# Custom installation directory
GRAPHDONE_HOME=/opt/graphdone curl -fsSL https://graphdone.com/start.sh | sh

# Skip auto-start
GRAPHDONE_NO_START=1 curl -fsSL https://graphdone.com/start.sh | sh
```

## Updating GraphDone

Users can update their installation by running the same command:

```bash
curl -fsSL https://graphdone.com/start.sh | sh
```

The script will detect existing installations and pull the latest changes.

## Uninstalling

```bash
# Stop services
cd ~/.graphdone && ./start stop

# Remove installation
rm -rf ~/.graphdone
```

## Security Considerations

### Script Verification

**Before running the one-liner installation**, verify the script:

```bash
# Option 1: Review before running
curl -fsSL https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/install.sh | less

# Option 2: Download, inspect, then execute
curl -fsSL https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/install.sh -o install.sh
cat install.sh  # Review contents
sh install.sh

# Option 3: Verify with checksums (recommended for production)
curl -fsSL https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/install.sh.sha256 -o install.sh.sha256
curl -fsSL https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/install.sh -o install.sh
sha256sum -c install.sh.sha256  # Verify integrity
sh install.sh
```

### What the Script Does

**Safe operations:**
- ✅ Installs to `~/graphdone` (user-owned, visible directory)
- ✅ Never requires sudo for core installation
- ✅ Only requests permission for system dependencies (Docker, Git)
- ✅ All source code is open and auditable on GitHub
- ✅ No telemetry or data collection
- ✅ Uses official Docker images from GitHub Container Registry

**Expected behavior:**
- ⚠️ Generates self-signed TLS certificates (browser warnings are normal)
- ⚠️ Creates `~/.graphdone-cache/` for dependency caching
- ⚠️ Modifies shell profile (.bashrc/.zshrc) to add paths (only if installing Node.js)

### Production Security

For production deployments:

1. **Change Default Passwords**
   ```bash
   # Edit deployment/.env
   NEO4J_PASSWORD=your-secure-password-here
   JWT_SECRET=your-secure-jwt-secret-here
   ```

2. **Use CA-Signed Certificates**
   ```bash
   # Replace self-signed certificates
   cp /path/to/your/certificate.crt deployment/certs/server-cert.pem
   cp /path/to/your/private-key.key deployment/certs/server-key.pem
   chmod 644 deployment/certs/server-cert.pem
   chmod 600 deployment/certs/server-key.pem
   ```

3. **Network Security**
   - Use firewall to restrict Neo4j ports (7474, 7687) to localhost
   - Enable TLS for Neo4j Bolt connections (see Neo4j docs)
   - Use reverse proxy (nginx, Caddy) for additional security layers
   - Consider VPN for remote access instead of public exposure

4. **Authentication**
   - GraphDone uses SQLite for authentication by default
   - Supports JWT tokens with configurable expiration
   - See [docs/guides/sqlite-deployment-modes.md](./guides/sqlite-deployment-modes.md)

### Neo4j Configuration Notes

GraphDone disables Neo4j's strict configuration validation (`NEO4J_server_config_strict__validation_enabled: "false"`) to handle plugin installation quirks. See explanation below.

#### Why Strict Validation is Disabled

**The Issue:** Neo4j's automatic plugin downloader (used for GDS and APOC plugins) occasionally writes malformed entries to `neo4j.conf` during first-time installation. With strict validation enabled, Neo4j refuses to start.

**Our Solution:** Disable strict validation to allow reliable first-time setup across all platforms.

**Is This Safe?**
- ✅ Yes - our configuration is minimal and well-tested
- ✅ Health checks verify Neo4j is functioning correctly
- ✅ Plugins are official Neo4j libraries (GDS, APOC)
- ✅ Neo4j runs in isolated Docker container
- ✅ Production deployments don't expose Neo4j externally

**Trade-offs:**
- ⚠️ Won't catch configuration typos (acceptable - we use version-controlled config)
- ⚠️ Malformed entries won't prevent startup (acceptable - health checks catch real issues)

See [deployment/docker-compose.yml](../deployment/docker-compose.yml) for full Neo4j configuration.

### Best Practices

1. **HTTPS Only**: Always serve installation script over HTTPS
2. **Integrity Checks**: Use SHA256 checksums for production deployments
3. **Version Pinning**: Specify version tags for reproducible deployments
4. **No Root**: Script runs without sudo by default (secure by design)
5. **Audit Regularly**: Review logs and container security updates
6. **Backup Strategy**: Schedule regular backups of Neo4j data volume

## Comparison with Ollama

| Feature | Ollama | GraphDone |
|---------|--------|-----------|
| One-liner install | ✓ | ✓ |
| Auto-updates | ✓ | ✓ |
| Platform detection | ✓ | ✓ (via smart-start) |
| Service management | systemd | Docker Compose |
| GPU support | ✓ | N/A |
| Offline mode | ✓ | ✓ |

## Troubleshooting

### Common Issues

1. **Docker not running**: Ensure Docker Desktop is started
2. **Port conflicts**: Check ports 3127, 4127, 7474
3. **Permission denied**: Check Docker group membership
4. **Network issues**: Verify firewall settings

### Debug Mode

```bash
# Run with debug output
DEBUG=1 curl -fsSL https://graphdone.com/start.sh | sh
```