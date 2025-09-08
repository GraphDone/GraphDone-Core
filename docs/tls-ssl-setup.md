# TLS/SSL Setup Guide

This guide explains how to enable HTTPS/TLS encryption for GraphDone in both development and production environments.

## Quick Start - Development HTTPS

1. **Generate development certificates:**
   ```bash
   ./scripts/generate-dev-certs.sh
   ```

2. **Enable SSL in environment:**
   ```bash
   # Copy .env.example to .env if you haven't already
   cp .env.example .env
   
   # Edit .env file
   SSL_ENABLED=true
   SSL_KEY_PATH=./certs/dev-key.pem
   SSL_CERT_PATH=./certs/dev-cert.pem
   HTTPS_PORT=4128
   
   # Update client URLs for HTTPS
   VITE_GRAPHQL_URL=https://localhost:4128/graphql
   VITE_GRAPHQL_WS_URL=wss://localhost:4128/graphql
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - API: https://localhost:4128/graphql
   - Web: https://localhost:3127 (configure web server for HTTPS separately)
   - Health: https://localhost:4128/health

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SSL_ENABLED` | Enable/disable TLS | `false` | No |
| `SSL_KEY_PATH` | Path to private key file | - | Yes (when SSL enabled) |
| `SSL_CERT_PATH` | Path to certificate file | - | Yes (when SSL enabled) |
| `HTTPS_PORT` | HTTPS server port | `4128` | No |

### Example Configurations

#### Development with self-signed certificates:
```bash
SSL_ENABLED=true
SSL_KEY_PATH=./certs/dev-key.pem
SSL_CERT_PATH=./certs/dev-cert.pem
HTTPS_PORT=4128
```

#### Production with CA-signed certificates:
```bash
SSL_ENABLED=true
SSL_KEY_PATH=/etc/ssl/private/graphdone.key
SSL_CERT_PATH=/etc/ssl/certs/graphdone.crt
HTTPS_PORT=443
```

## Docker Deployment

### Development Docker with HTTPS

Use the provided HTTPS Docker configuration:

```bash
# Generate certificates first
./scripts/generate-dev-certs.sh

# Create certs directory for Docker
mkdir -p deployment/certs
cp certs/dev-*.pem deployment/certs/

# Start with HTTPS configuration
cd deployment
docker-compose -f docker-compose.https.yml up
```

### Production Docker with HTTPS

1. **Obtain production certificates** (Let's Encrypt, CA, etc.)

2. **Place certificates in deployment/certs:**
   ```
   deployment/
   ├── certs/
   │   ├── server-key.pem    # Private key
   │   └── server-cert.pem   # Certificate
   └── docker-compose.https.yml
   ```

3. **Deploy:**
   ```bash
   cd deployment
   docker-compose -f docker-compose.https.yml up -d
   ```

## Production Considerations

### 1. Certificate Management

**For production, use certificates from a trusted Certificate Authority:**

- **Let's Encrypt (Free):**
  ```bash
  certbot certonly --webroot -w /var/www/html -d yourdomain.com
  cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/server-key.pem
  cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/server-cert.pem
  ```

- **Commercial CA:** Follow your CA's instructions for certificate generation

### 2. Security Best Practices

- **Use strong cipher suites**
- **Enable HTTP Strict Transport Security (HSTS)**
- **Disable insecure protocols (SSLv3, TLS 1.0, TLS 1.1)**
- **Regular certificate renewal**
- **Secure private key storage (restricted permissions)**

### 3. Load Balancer/Proxy Configuration

For production deployments, consider using a reverse proxy like Nginx or Caddy:

#### Nginx Example:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:4127;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /graphql {
        proxy_pass http://localhost:4127/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

#### Caddy Example:
```caddyfile
yourdomain.com {
    reverse_proxy localhost:4127
}
```

### 4. WebSocket Secure (WSS) Support

When HTTPS is enabled, WebSocket connections automatically upgrade to WSS:

- **HTTP mode:** `ws://localhost:4127/graphql`
- **HTTPS mode:** `wss://localhost:4128/graphql`

The client automatically detects the protocol and uses the appropriate WebSocket URL.

## Testing

### Manual Testing

1. **Test HTTP health endpoint:**
   ```bash
   curl http://localhost:4127/health
   ```

2. **Test HTTPS health endpoint:**
   ```bash
   curl -k https://localhost:4128/health
   ```

3. **Test GraphQL over HTTPS:**
   ```bash
   curl -k -X POST -H "Content-Type: application/json" \
        -d '{"query":"query { __schema { queryType { name } } }"}' \
        https://localhost:4128/graphql
   ```

### Automated Testing

Run the TLS test suite:

```bash
# Run TLS-specific unit tests
npm test -- tls.test.ts

# Run comprehensive TLS integration tests
./scripts/test-tls.sh

# Run E2E tests including TLS scenarios
npm run test:e2e -- tls-integration.spec.ts
```

## Troubleshooting

### Common Issues

1. **"SSL_KEY_PATH environment variable is required"**
   - Ensure SSL_KEY_PATH and SSL_CERT_PATH are set when SSL_ENABLED=true

2. **"SSL key file not found"**
   - Check file paths and permissions
   - Generate certificates: `./scripts/generate-dev-certs.sh`

3. **"Certificate appears to be invalid"**
   - Verify certificate format (PEM)
   - Check certificate expiry: `openssl x509 -in cert.pem -enddate -noout`

4. **Browser security warnings (development only)**
   - Expected with self-signed certificates
   - Click "Advanced" → "Proceed to localhost" in browser
   - For production, use CA-signed certificates

5. **WebSocket connection fails over HTTPS**
   - Ensure client uses `wss://` instead of `ws://`
   - Check that VITE_GRAPHQL_WS_URL uses wss protocol

### Debug Commands

```bash
# Check certificate validity
openssl x509 -in certs/dev-cert.pem -text -noout

# Check private key validity
openssl rsa -in certs/dev-key.pem -check -noout

# Test server response
curl -v -k https://localhost:4128/health

# Check if server is listening on HTTPS port
netstat -an | grep 4128
```

## Implementation Details

### Server Architecture

The GraphDone server supports both HTTP and HTTPS modes through conditional server creation:

- **HTTP mode:** Uses Node.js `http.createServer()`
- **HTTPS mode:** Uses Node.js `https.createServer()` with SSL certificates
- **Graceful fallback:** Automatically falls back to HTTP if SSL configuration fails

### File Structure

```
GraphDone-Core/
├── packages/server/src/
│   └── config/
│       ├── tls.ts              # TLS configuration module
│       └── tls.test.ts         # TLS unit tests
├── scripts/
│   ├── generate-dev-certs.sh   # Development certificate generator
│   └── test-tls.sh             # TLS validation script
├── deployment/
│   ├── docker-compose.yml      # Standard HTTP Docker config
│   └── docker-compose.https.yml # HTTPS Docker config
├── e2e/
│   └── tls-integration.spec.ts  # E2E TLS tests
└── certs/                      # Generated certificates (gitignored)
    ├── dev-key.pem
    └── dev-cert.pem
```

### Security Features

- **Certificate validation:** Automatic validation of SSL certificates and keys
- **Protocol detection:** Client automatically detects HTTPS and uses WSS for WebSockets
- **Error handling:** Graceful degradation when TLS configuration fails
- **Development safety:** Self-signed certificates for local development only

## Next Steps

1. **Production deployment:** Set up CA-signed certificates
2. **Monitoring:** Implement SSL certificate expiry monitoring
3. **Performance:** Consider TLS termination at load balancer level
4. **Security:** Implement HSTS and security headers