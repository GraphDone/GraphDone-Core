#!/bin/bash

# Generate development SSL certificates for GraphDone
# This creates self-signed certificates for local development only

set -e

CERT_DIR="./certs"
DAYS=365

echo "🔐 Generating development SSL certificates..."

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate private key
echo "📝 Generating private key..."
openssl genrsa -out "$CERT_DIR/dev-key.pem" 2048

# Generate certificate signing request
echo "📝 Creating certificate signing request..."
openssl req -new \
  -key "$CERT_DIR/dev-key.pem" \
  -out "$CERT_DIR/dev-csr.pem" \
  -subj "/C=US/ST=Development/L=Local/O=GraphDone/OU=Development/CN=localhost"

# Generate self-signed certificate
echo "📝 Generating self-signed certificate..."
openssl x509 -req \
  -in "$CERT_DIR/dev-csr.pem" \
  -signkey "$CERT_DIR/dev-key.pem" \
  -out "$CERT_DIR/dev-cert.pem" \
  -days $DAYS \
  -extensions v3_req \
  -extfile <(cat << EOF
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)

# Clean up CSR file
rm -f "$CERT_DIR/dev-csr.pem"

# Set appropriate permissions
chmod 600 "$CERT_DIR/dev-key.pem"
chmod 644 "$CERT_DIR/dev-cert.pem"

echo "✅ Development certificates generated successfully!"
echo "   Private key: $CERT_DIR/dev-key.pem"
echo "   Certificate: $CERT_DIR/dev-cert.pem"
echo ""
echo "⚠️  These are self-signed certificates for development only."
echo "   Your browser will show security warnings which you can safely bypass."
echo "   For production, use certificates from a trusted CA."
echo ""
echo "🔧 Add these to your .env file:"
echo "   SSL_ENABLED=true"
echo "   SSL_KEY_PATH=./certs/dev-key.pem"
echo "   SSL_CERT_PATH=./certs/dev-cert.pem"
echo "   HTTPS_PORT=4128"