#!/bin/bash

# Generate SSL certificates for multiple host configurations
# Supports localhost, custom domains, Tailscale hosts, and IP addresses

set -e

CERT_DIR="./certs"
DAYS=365

# Default hosts if none specified
DEFAULT_HOSTS="localhost,127.0.0.1,::1,*.localhost"

# Parse command line arguments
HOSTS="$DEFAULT_HOSTS"
CERT_NAME="graphdone"
HELP=false

usage() {
    echo "Generate SSL certificates for GraphDone with multiple host support"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --hosts HOSTS    Comma-separated list of hostnames/IPs to include"
    echo "                       (default: localhost,127.0.0.1,::1,*.localhost)"
    echo "  -n, --name NAME      Certificate name prefix (default: graphdone)"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Default localhost only"
    echo "  $0"
    echo ""
    echo "  # Include Tailscale host"
    echo "  $0 -h 'localhost,my-host.ts.net,127.0.0.1'"
    echo ""
    echo "  # Production domain"
    echo "  $0 -h 'graphdone.com,*.graphdone.com,api.graphdone.com'"
    echo ""
    echo "  # Development with custom domain and IPs"
    echo "  $0 -h 'localhost,dev.local,192.168.1.100,10.0.0.50'"
    echo ""
    echo "Host types supported:"
    echo "  - localhost, *.localhost"
    echo "  - Custom domains (graphdone.com, *.graphdone.com)"  
    echo "  - Tailscale hosts (hostname.ts.net)"
    echo "  - IP addresses (127.0.0.1, 192.168.1.100, ::1)"
    echo "  - Wildcards (*.domain.com)"
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--hosts)
            HOSTS="$2"
            shift 2
            ;;
        -n|--name)
            CERT_NAME="$2"
            shift 2
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

echo "🔐 Generating multi-host SSL certificates for GraphDone"
echo "======================================================"
echo "Certificate name: $CERT_NAME"
echo "Hosts: $HOSTS"
echo "Certificate directory: $CERT_DIR"
echo "Validity period: $DAYS days"
echo ""

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Convert hosts to SAN entries
echo "📝 Parsing host configuration..."
IFS=',' read -ra HOST_ARRAY <<< "$HOSTS"
DNS_ENTRIES=""
IP_ENTRIES=""
DNS_COUNT=1
IP_COUNT=1

for host in "${HOST_ARRAY[@]}"; do
    # Trim whitespace
    host=$(echo "$host" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Check if it's an IP address
    if [[ $host =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ $host =~ ^[0-9a-fA-F:]+$ ]]; then
        IP_ENTRIES="${IP_ENTRIES}IP.${IP_COUNT} = ${host}\n"
        echo "   IP.${IP_COUNT}: $host"
        ((IP_COUNT++))
    else
        DNS_ENTRIES="${DNS_ENTRIES}DNS.${DNS_COUNT} = ${host}\n"
        echo "   DNS.${DNS_COUNT}: $host"
        ((DNS_COUNT++))
    fi
done

# Generate private key
echo ""
echo "📝 Generating private key..."
openssl genrsa -out "$CERT_DIR/${CERT_NAME}-key.pem" 2048

# Create certificate configuration
CONFIG_FILE="$CERT_DIR/${CERT_NAME}.conf"
cat > "$CONFIG_FILE" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Development
L = Local
O = GraphDone
OU = Development
CN = $(echo "$HOSTS" | cut -d',' -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
$(printf "%b" "$DNS_ENTRIES")$(printf "%b" "$IP_ENTRIES")
EOF

# Generate certificate signing request
echo "📝 Creating certificate signing request..."
openssl req -new \
  -key "$CERT_DIR/${CERT_NAME}-key.pem" \
  -out "$CERT_DIR/${CERT_NAME}-csr.pem" \
  -config "$CONFIG_FILE"

# Generate self-signed certificate
echo "📝 Generating self-signed certificate..."
openssl x509 -req \
  -in "$CERT_DIR/${CERT_NAME}-csr.pem" \
  -signkey "$CERT_DIR/${CERT_NAME}-key.pem" \
  -out "$CERT_DIR/${CERT_NAME}-cert.pem" \
  -days $DAYS \
  -extensions v3_req \
  -extfile "$CONFIG_FILE"

# Clean up temporary files
rm "$CERT_DIR/${CERT_NAME}-csr.pem" "$CONFIG_FILE"

# Set appropriate permissions
chmod 600 "$CERT_DIR/${CERT_NAME}-key.pem"
chmod 644 "$CERT_DIR/${CERT_NAME}-cert.pem"

# Verify certificate
echo ""
echo "🔍 Certificate verification:"
echo "Subject: $(openssl x509 -in "$CERT_DIR/${CERT_NAME}-cert.pem" -subject -noout)"
echo "Issuer: $(openssl x509 -in "$CERT_DIR/${CERT_NAME}-cert.pem" -issuer -noout)"
echo "Valid from: $(openssl x509 -in "$CERT_DIR/${CERT_NAME}-cert.pem" -startdate -noout)"
echo "Valid until: $(openssl x509 -in "$CERT_DIR/${CERT_NAME}-cert.pem" -enddate -noout)"
echo ""
echo "SAN entries:"
openssl x509 -in "$CERT_DIR/${CERT_NAME}-cert.pem" -text -noout | grep -A 10 "Subject Alternative Name" || echo "   (none)"

echo ""
echo "✅ Multi-host certificates generated successfully!"
echo "   Private key: $CERT_DIR/${CERT_NAME}-key.pem"
echo "   Certificate: $CERT_DIR/${CERT_NAME}-cert.pem"
echo ""
echo "🔧 Environment configuration:"
echo "   SSL_ENABLED=true"
echo "   SSL_KEY_PATH=./$CERT_DIR/${CERT_NAME}-key.pem"
echo "   SSL_CERT_PATH=./$CERT_DIR/${CERT_NAME}-cert.pem"
echo "   HTTPS_PORT=4128"
echo ""

# Show usage examples based on certificate type
if [[ "$HOSTS" == *"ts.net"* ]]; then
    echo "🔗 Tailscale usage:"
    echo "   Access your GraphDone server via: https://$(echo "$HOSTS" | grep -o '[^,]*\.ts\.net' | head -1):4128/graphql"
    echo ""
fi

if [[ "$HOSTS" == *".com"* ]] || [[ "$HOSTS" == *".org"* ]] || [[ "$HOSTS" == *".net"* ]]; then
    echo "🌐 Production domain usage:"
    echo "   Ensure DNS points to your server IP address"
    echo "   Configure reverse proxy (nginx/caddy) for production deployment"
    echo ""
fi

echo "⚠️  Browser warnings:"
echo "   Self-signed certificates will show security warnings"
echo "   Click 'Advanced' → 'Proceed to [hostname]' to bypass"
echo "   For production, use certificates from a trusted CA (Let's Encrypt)"
echo ""

echo "🔒 Security notes:"
echo "   - Keep private key file secure (chmod 600)"
echo "   - Regenerate certificates before expiry ($DAYS days)"
echo "   - Use trusted CA certificates in production"
echo "   - Consider certificate rotation automation"