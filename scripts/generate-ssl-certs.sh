#!/bin/bash

# Generate SSL certificates for GraphDone
# This creates self-signed certificates for local development and production deployment

set -e

CERT_DIR="./deployment/certs"
DAYS=365

echo "🔐 Generating SSL certificates..."

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate private key
echo "📝 Generating private key..."
openssl genrsa -out "$CERT_DIR/server-key.pem" 2048

# Generate certificate signing request
echo "📝 Creating certificate signing request..."
openssl req -new \
  -key "$CERT_DIR/server-key.pem" \
  -out "$CERT_DIR/server-csr.pem" \
  -subj "/C=US/ST=Development/L=Local/O=GraphDone/OU=Development/CN=localhost"

# Generate self-signed certificate with Safari-compatible extensions
echo "📝 Generating self-signed certificate with Safari compatibility..."
openssl x509 -req \
  -in "$CERT_DIR/server-csr.pem" \
  -signkey "$CERT_DIR/server-key.pem" \
  -out "$CERT_DIR/server-cert.pem" \
  -days $DAYS \
  -extensions v3_req \
  -extfile <(cat << EOF
[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names
authorityKeyIdentifier = keyid,issuer:always

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = graphdone.local
DNS.4 = *.graphdone.local
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)

# Clean up CSR file
rm -f "$CERT_DIR/server-csr.pem"

# Set appropriate permissions
chmod 600 "$CERT_DIR/server-key.pem"
chmod 644 "$CERT_DIR/server-cert.pem"

echo "✅ SSL certificates generated successfully!"
echo "   Private key: $CERT_DIR/server-key.pem"
echo "   Certificate: $CERT_DIR/server-cert.pem"
echo ""
echo "⚠️  These are self-signed certificates for development only."
echo "   Your browser will show security warnings which you can safely bypass."
echo "   For production, use certificates from a trusted CA."
echo ""
echo "🔧 Add these to your .env file:"
echo "   SSL_ENABLED=true"
echo "   SSL_KEY_PATH=/app/certs/server-key.pem"
echo "   SSL_CERT_PATH=/app/certs/server-cert.pem"
echo "   HTTPS_PORT=4128"
echo ""
echo "🍎 For Safari users:"
echo "   1. Visit https://localhost:3128"
echo "   2. Click 'Advanced' if you see a security warning"
echo "   3. Click 'Proceed to localhost (unsafe)'"
echo "   4. Or add the certificate to your keychain for permanent trust"