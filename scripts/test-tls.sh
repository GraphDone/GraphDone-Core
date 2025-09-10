#!/bin/bash

# Test TLS/SSL implementation for GraphDone
# This script validates the TLS configuration and server functionality

set -e

echo "🔐 Testing TLS/SSL Implementation for GraphDone"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
HTTP_PORT=4127
HTTPS_PORT=4128
CERT_DIR="./artifacts/certificates/certs-dev"

echo ""
echo "📋 Test Plan:"
echo "1. Generate development certificates"
echo "2. Test HTTP server (SSL disabled)"
echo "3. Test HTTPS server (SSL enabled)"
echo "4. Validate certificate properties"
echo "5. Test health endpoints"
echo ""

# Function to check if server is running
check_server() {
    local protocol=$1
    local port=$2
    local max_attempts=10
    local attempt=1
    
    echo "⏳ Checking ${protocol}://localhost:${port}/health..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f ${protocol}://localhost:${port}/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Server responding on ${protocol}://localhost:${port}${NC}"
            return 0
        fi
        
        if [ "$protocol" = "https" ]; then
            # For HTTPS, also try with -k flag to ignore certificate warnings
            if curl -s -f -k ${protocol}://localhost:${port}/health > /dev/null 2>&1; then
                echo -e "${GREEN}✅ HTTPS server responding (self-signed certificate)${NC}"
                return 0
            fi
        fi
        
        echo "Attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ Server not responding on ${protocol}://localhost:${port}${NC}"
    return 1
}

# Function to test GraphQL endpoint
test_graphql() {
    local protocol=$1
    local port=$2
    
    echo "🔍 Testing GraphQL endpoint at ${protocol}://localhost:${port}/graphql..."
    
    local curl_flags=""
    if [ "$protocol" = "https" ]; then
        curl_flags="-k"
    fi
    
    local query='{"query":"query { __schema { queryType { name } } }"}'
    
    if curl -s $curl_flags -X POST \
       -H "Content-Type: application/json" \
       -d "$query" \
       "${protocol}://localhost:${port}/graphql" | grep -q "queryType"; then
        echo -e "${GREEN}✅ GraphQL endpoint working${NC}"
        return 0
    else
        echo -e "${RED}❌ GraphQL endpoint not working${NC}"
        return 1
    fi
}

# Step 1: Generate development certificates
echo "1️⃣ Generating development certificates..."
if [ ! -d "$CERT_DIR" ]; then
    chmod +x ./scripts/generate-dev-certs.sh
    ./scripts/generate-dev-certs.sh
    echo -e "${GREEN}✅ Certificates generated${NC}"
else
    echo -e "${YELLOW}⚠️ Certificates already exist${NC}"
fi

# Step 2: Test HTTP server (SSL disabled)
echo ""
echo "2️⃣ Testing HTTP server (SSL disabled)..."
export SSL_ENABLED=false

# Start HTTP server in background
echo "Starting HTTP server..."
npm run dev > /tmp/graphdone-http.log 2>&1 &
HTTP_PID=$!

# Wait for server to start
sleep 5

if check_server "http" $HTTP_PORT; then
    test_graphql "http" $HTTP_PORT
    
    # Test health endpoint response
    health_response=$(curl -s http://localhost:$HTTP_PORT/health)
    if echo "$health_response" | grep -q '"protocol":"http"'; then
        echo -e "${GREEN}✅ Health endpoint reports HTTP protocol${NC}"
    else
        echo -e "${RED}❌ Health endpoint protocol mismatch${NC}"
    fi
else
    echo -e "${RED}❌ HTTP server test failed${NC}"
fi

# Stop HTTP server
kill $HTTP_PID 2>/dev/null || true
sleep 2

# Step 3: Test HTTPS server (SSL enabled)
echo ""
echo "3️⃣ Testing HTTPS server (SSL enabled)..."
export SSL_ENABLED=true
export SSL_KEY_PATH="./artifacts/certificates/certs-dev/dev-key.pem"
export SSL_CERT_PATH="./artifacts/certificates/certs-dev/dev-cert.pem"
export HTTPS_PORT=$HTTPS_PORT

# Start HTTPS server in background
echo "Starting HTTPS server..."
npm run dev > /tmp/graphdone-https.log 2>&1 &
HTTPS_PID=$!

# Wait for server to start
sleep 5

if check_server "https" $HTTPS_PORT; then
    test_graphql "https" $HTTPS_PORT
    
    # Test health endpoint response
    health_response=$(curl -s -k https://localhost:$HTTPS_PORT/health)
    if echo "$health_response" | grep -q '"protocol":"https"'; then
        echo -e "${GREEN}✅ Health endpoint reports HTTPS protocol${NC}"
    else
        echo -e "${RED}❌ Health endpoint protocol mismatch${NC}"
    fi
    
    # Test WebSocket endpoint exists
    if curl -s -k -H "Upgrade: websocket" -H "Connection: Upgrade" \
       https://localhost:$HTTPS_PORT/graphql | head -1 | grep -q "400\|426"; then
        echo -e "${GREEN}✅ WebSocket endpoint responding (expected 400/426 without proper headers)${NC}"
    else
        echo -e "${YELLOW}⚠️ WebSocket endpoint response unexpected${NC}"
    fi
else
    echo -e "${RED}❌ HTTPS server test failed${NC}"
fi

# Stop HTTPS server
kill $HTTPS_PID 2>/dev/null || true
sleep 2

# Step 4: Validate certificate properties
echo ""
echo "4️⃣ Validating certificate properties..."

if [ -f "$CERT_DIR/dev-cert.pem" ] && [ -f "$CERT_DIR/dev-key.pem" ]; then
    # Check certificate validity
    if openssl x509 -in "$CERT_DIR/dev-cert.pem" -text -noout > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Certificate is valid${NC}"
        
        # Check certificate subject
        subject=$(openssl x509 -in "$CERT_DIR/dev-cert.pem" -subject -noout)
        if echo "$subject" | grep -q "CN=localhost"; then
            echo -e "${GREEN}✅ Certificate is for localhost${NC}"
        else
            echo -e "${YELLOW}⚠️ Certificate subject: $subject${NC}"
        fi
        
        # Check certificate expiry
        not_after=$(openssl x509 -in "$CERT_DIR/dev-cert.pem" -enddate -noout)
        echo -e "${GREEN}✅ Certificate expiry: $not_after${NC}"
        
        # Check key validity
        if openssl rsa -in "$CERT_DIR/dev-key.pem" -check -noout > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Private key is valid${NC}"
        else
            echo -e "${RED}❌ Private key is invalid${NC}"
        fi
    else
        echo -e "${RED}❌ Certificate is invalid${NC}"
    fi
else
    echo -e "${RED}❌ Certificate files not found${NC}"
fi

# Step 5: Run unit tests
echo ""
echo "5️⃣ Running TLS unit tests..."
if npm test -- tls.test.ts; then
    echo -e "${GREEN}✅ TLS unit tests passed${NC}"
else
    echo -e "${RED}❌ TLS unit tests failed${NC}"
fi

echo ""
echo "🎉 TLS/SSL Implementation Testing Complete"
echo "========================================="

# Cleanup
unset SSL_ENABLED SSL_KEY_PATH SSL_CERT_PATH HTTPS_PORT
rm -f /tmp/graphdone-http.log /tmp/graphdone-https.log

echo ""
echo "💡 Next Steps:"
echo "- For development: Set SSL_ENABLED=true in .env file"
echo "- For production: Use certificates from a trusted CA"
echo "- For Docker: Use docker-compose.https.yml"
echo ""