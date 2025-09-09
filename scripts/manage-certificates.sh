#!/bin/bash

# Certificate Management Script for GraphDone
# Supports both local development (mkcert) and production (Let's Encrypt)

set -e

CERT_DIR="./deployment/certs"
MODE="${1:-local}"
DOMAIN="${2:-localhost}"
EMAIL="${3:-admin@example.com}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 GraphDone Certificate Manager${NC}"
echo "======================================="

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

case "$MODE" in
  "local")
    echo -e "${YELLOW}📝 Setting up LOCAL development certificates with mkcert...${NC}"
    
    # Check if mkcert is installed
    if ! command -v mkcert &> /dev/null; then
      echo -e "${RED}❌ mkcert is not installed!${NC}"
      echo "Please install mkcert first:"
      echo "  macOS: brew install mkcert"
      echo "  Linux: https://github.com/FiloSottile/mkcert#installation"
      exit 1
    fi
    
    # Install local CA if not already installed
    echo "Installing local Certificate Authority..."
    mkcert -install
    
    # Generate certificates for localhost and common variations
    echo "Generating trusted certificates for local development..."
    cd "$CERT_DIR"
    mkcert -key-file server-key.pem -cert-file server-cert.pem \
      localhost \
      127.0.0.1 \
      ::1 \
      "*.localhost" \
      "graphdone.local" \
      "*.graphdone.local"
    cd ../..
    
    echo -e "${GREEN}✅ Local development certificates created successfully!${NC}"
    echo "Certificates are automatically trusted by your system."
    echo "No browser warnings should appear."
    ;;
    
  "production")
    echo -e "${YELLOW}📝 Setting up PRODUCTION certificates with Let's Encrypt...${NC}"
    echo "Domain: $DOMAIN"
    echo "Email: $EMAIL"
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
      echo -e "${RED}❌ Certbot is not installed!${NC}"
      echo "Installing certbot..."
      
      # Detect OS and install certbot
      if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update
        sudo apt-get install -y certbot
      elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install certbot
      else
        echo "Please install certbot manually: https://certbot.eff.org/"
        exit 1
      fi
    fi
    
    # Generate Let's Encrypt certificate
    echo "Generating Let's Encrypt certificate..."
    
    # Use standalone mode for initial certificate generation
    sudo certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "$EMAIL" \
      --domains "$DOMAIN" \
      --domains "www.$DOMAIN"
    
    # Copy certificates to deployment directory
    echo "Copying certificates to deployment directory..."
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/server-key.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/server-cert.pem"
    sudo chown $(whoami):$(whoami) "$CERT_DIR/server-key.pem" "$CERT_DIR/server-cert.pem"
    chmod 600 "$CERT_DIR/server-key.pem"
    chmod 644 "$CERT_DIR/server-cert.pem"
    
    echo -e "${GREEN}✅ Production certificates created successfully!${NC}"
    echo "Certificates are signed by Let's Encrypt and trusted globally."
    
    # Create renewal script
    cat > "$CERT_DIR/renew-certificates.sh" << 'EOF'
#!/bin/bash
# Auto-renewal script for Let's Encrypt certificates

DOMAIN="$1"
CERT_DIR="$(dirname "$0")"

echo "Renewing certificates for $DOMAIN..."

# Renew certificates
sudo certbot renew

# Copy renewed certificates
if [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
  sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/server-key.pem"
  sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/server-cert.pem"
  sudo chown $(whoami):$(whoami) "$CERT_DIR/server-key.pem" "$CERT_DIR/server-cert.pem"
  chmod 600 "$CERT_DIR/server-key.pem"
  chmod 644 "$CERT_DIR/server-cert.pem"
  
  # Reload nginx in Docker container
  docker exec graphdone-web nginx -s reload
  
  echo "✅ Certificates renewed and reloaded!"
fi
EOF
    chmod +x "$CERT_DIR/renew-certificates.sh"
    
    # Add cron job for auto-renewal
    echo "Setting up auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 3 * * * $PWD/$CERT_DIR/renew-certificates.sh $DOMAIN") | crontab -
    
    echo -e "${YELLOW}📅 Auto-renewal configured to run daily at 3 AM${NC}"
    ;;
    
  "docker")
    echo -e "${YELLOW}📝 Setting up Docker-friendly certificates with nginx-certbot...${NC}"
    
    # Create docker-compose override for certbot
    cat > deployment/docker-compose.certbot.yml << EOF
version: '3.8'

services:
  certbot:
    image: certbot/certbot
    container_name: graphdone-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"

  graphdone-web:
    volumes:
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    command: "/bin/sh -c 'while :; do sleep 6h & wait \$\${!}; nginx -s reload; done & nginx -g \"daemon off;\"'"
EOF
    
    # Create nginx configuration for ACME challenge
    cat > packages/web/nginx-letsencrypt.conf << 'EOF'
# HTTP server for ACME challenge
server {
    listen 80;
    server_name ${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server with Let's Encrypt certificates
server {
    listen 443 ssl;
    server_name ${DOMAIN};
    
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Rest of your nginx configuration...
    include /etc/nginx/conf.d/graphdone.conf;
}
EOF
    
    echo -e "${GREEN}✅ Docker Certbot configuration created!${NC}"
    echo "To use with Docker:"
    echo "  1. Set DOMAIN environment variable"
    echo "  2. Run: docker-compose -f deployment/docker-compose.yml -f deployment/docker-compose.certbot.yml up"
    ;;
    
  *)
    echo -e "${RED}Usage: $0 [local|production|docker] [domain] [email]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 local                          # Local development with mkcert"
    echo "  $0 production example.com email@example.com  # Production with Let's Encrypt"
    echo "  $0 docker                         # Docker setup with Certbot container"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}🎉 Certificate setup complete!${NC}"
echo ""
echo "Certificate locations:"
echo "  Private Key: $CERT_DIR/server-key.pem"
echo "  Certificate: $CERT_DIR/server-cert.pem"
echo ""

if [ "$MODE" = "local" ]; then
  echo "For local development:"
  echo "  - Certificates are automatically trusted"
  echo "  - Access via: https://localhost:3128"
  echo "  - No browser warnings!"
elif [ "$MODE" = "production" ]; then
  echo "For production:"
  echo "  - Certificates are valid for 90 days"
  echo "  - Auto-renewal is configured via cron"
  echo "  - Manual renewal: $CERT_DIR/renew-certificates.sh $DOMAIN"
fi