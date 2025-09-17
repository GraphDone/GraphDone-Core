# GraphDone Deployment Guide

## Quick Install (Like Ollama!)

GraphDone can be installed with a single command:

### Using GitHub (Available Now!)

```bash
curl -fsSL https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/start.sh | sh
```

or using wget:

```bash
wget -qO- https://raw.githubusercontent.com/GraphDone/GraphDone-Core/main/public/start.sh | sh
```

### Using Custom Domain (Future)

Once deployed to graphdone.com:

```bash
curl -fsSL https://graphdone.com/start.sh | sh
```

This will:
1. Check for required dependencies (git, docker)
2. Clone GraphDone to `~/graphdone` (visible directory)
3. Generate TLS certificates automatically
4. Configure environment for HTTPS
5. Start services using smart-start
6. Provide access at https://localhost:3128

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

1. **HTTPS Only**: Always serve the script over HTTPS
2. **Integrity**: Consider adding SHA256 checksum verification
3. **Version Pinning**: Allow users to specify versions
4. **No Root**: Script runs without sudo by default

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