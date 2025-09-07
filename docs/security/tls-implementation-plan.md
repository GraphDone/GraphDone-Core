# TLS Implementation Plan for GraphDone

> **🔒 SECURITY ROADMAP** - Comprehensive TLS/SSL and secrets management strategy

## Current Security State Analysis

### ❌ **Current Vulnerabilities** 
Based on existing codebase analysis:

1. **Hardcoded Secrets in Production**:
   ```javascript
   // packages/server/src/resolvers/sqlite-auth.ts:8 (NEW SQLite auth system)
   const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
   
   // deployment/docker-compose.yml:8
   NEO4J_AUTH: neo4j/graphdone_password  // Hardcoded database password
   ```

2. **No TLS/HTTPS Configuration**:
   ```yaml
   # deployment/docker-compose.yml:48,74
   - CORS_ORIGIN=http://localhost:3127  # HTTP only
   ports:
     - "3127:3127"  # Unencrypted traffic
     - "4127:4127"  # Unencrypted API
   ```

3. **Database Connections Unencrypted**:
   ```yaml
   # Neo4j, Redis, all internal communications use unencrypted channels
   - NEO4J_URI=bolt://graphdone-neo4j:7687  # No TLS
   # SQLite is local file system - no network encryption needed
   ```

4. **SQLite Database File Security**:
   ```bash
   # SQLite auth database needs secure file permissions
   # Default: potentially world-readable database file
   # Needed: 600 permissions (owner read/write only)
   # Location: packages/server/graphdone-auth.db
   ```

### ✅ **Current Security Strengths**
- **Hybrid Database Architecture**: User auth isolated in SQLite, graph data in Neo4j
- **Password hashing** with bcrypt (10 rounds)
- **JWT tokens** for stateless authentication
- **CORS configuration** for cross-origin protection
- **Database connection isolation** within Docker network
- **User role-based access control** (ADMIN, USER, VIEWER, GUEST)
- **Auth-only mode**: Server can run without Neo4j for authentication-only operations
- **Fast auth operations**: SQLite provides zero-latency authentication

## TLS Implementation Strategy

### Phase 1: Free SSL Certificates (No Browser Warnings)

#### **Option A: Let's Encrypt with Automatic Renewal** ✅ **RECOMMENDED**
```yaml
# deployment/docker-compose.prod.yml
version: '3.8'
services:
  # Add Caddy reverse proxy for automatic HTTPS
  caddy:
    image: caddy:2-alpine
    container_name: graphdone-caddy
    restart: unless-stopped
    ports:
      - "80:80"     # HTTP redirect to HTTPS
      - "443:443"   # HTTPS
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - graphdone-network
    depends_on:
      - graphdone-web
      - graphdone-api

  # Remove direct port exposure from web/api services  
  graphdone-web:
    # Remove: ports: - "3127:3127"
    expose:
      - "3127"  # Only internal network access
    
  graphdone-api:
    # Remove: ports: - "4127:4127"  
    expose:
      - "4127"  # Only internal network access

volumes:
  caddy_data:
  caddy_config:
```

**Caddyfile Configuration**:
```caddyfile
# deployment/Caddyfile
{
  # Global options
  email your-admin@domain.com  # For Let's Encrypt notifications
  acme_ca https://acme-v02.api.letsencrypt.org/directory
}

# Production domain
your-domain.com {
  # Web application
  handle_path /* {
    reverse_proxy graphdone-web:3127 {
      header_up Host {host}
      header_up X-Real-IP {remote}
      header_up X-Forwarded-For {remote}
      header_up X-Forwarded-Proto {scheme}
    }
  }
  
  # GraphQL API
  handle_path /graphql* {
    reverse_proxy graphdone-api:4127 {
      header_up Host {host}
      header_up X-Real-IP {remote}
      header_up X-Forwarded-For {remote}
      header_up X-Forwarded-Proto {scheme}
    }
  }
  
  # WebSocket support
  handle_path /graphql {
    reverse_proxy graphdone-api:4127 {
      header_up Connection {>Connection}
      header_up Upgrade {>Upgrade}
    }
  }
  
  # Security headers
  header {
    # HSTS
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    # Prevent clickjacking
    X-Frame-Options "SAMEORIGIN"
    # Prevent MIME sniffing
    X-Content-Type-Options "nosniff"
    # XSS protection
    X-XSS-Protection "1; mode=block"
    # Referrer policy
    Referrer-Policy "strict-origin-when-cross-origin"
    # Content Security Policy (adjust based on needs)
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' wss:"
  }
  
  # Logging
  log {
    output file /var/log/caddy/access.log
    format json
  }
}

# Development/staging with self-signed cert
localhost, 127.0.0.1 {
  tls internal  # Self-signed certificate
  
  handle_path /* {
    reverse_proxy graphdone-web:3127
  }
  
  handle_path /graphql* {
    reverse_proxy graphdone-api:4127
  }
}
```

#### **Option B: Cloudflare SSL (Free Tier)** ✅ **ALTERNATIVE**
```yaml
# For teams using Cloudflare DNS
# - Point domain to server IP
# - Enable "Full (strict)" SSL in Cloudflare dashboard
# - Origin certificates automatically trusted
# - No server-side SSL config needed
# - Free tier includes DDoS protection
```

#### **Option C: Self-Signed for Development** 
```bash
# deployment/scripts/generate-dev-certs.sh
#!/bin/bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/server.key \
  -out ssl/server.crt \
  -subj "/C=US/ST=Development/L=Local/O=GraphDone/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"
  
# Add to system keychain (macOS)
sudo security add-trusted-cert -d -r trustRoot -k /System/Library/Keychains/SystemRootCertificates.keychain ssl/server.crt

echo "✅ Development certificates generated and trusted"
echo "🌐 Access your app at: https://localhost"
```

### Phase 2: Database & Internal TLS

#### **Neo4j TLS Configuration**
```yaml
# deployment/docker-compose.prod.yml
services:
  graphdone-neo4j:
    environment:
      # Enable TLS
      NEO4J_dbms_connector_bolt_tls_level: REQUIRED
      NEO4J_dbms_connector_https_enabled: "true"
      NEO4J_dbms_ssl_policy_bolt_enabled: "true"
      NEO4J_dbms_ssl_policy_bolt_base_directory: /ssl
      NEO4J_dbms_ssl_policy_bolt_private_key: bolt.key
      NEO4J_dbms_ssl_policy_bolt_public_certificate: bolt.crt
    volumes:
      - ./ssl/neo4j:/ssl:ro
      - neo4j_data:/data
    ports:
      - "7473:7473"  # HTTPS browser interface
      # Remove: - "7474:7474"  # HTTP interface disabled
```

#### **Redis TLS Configuration**
```yaml
services:
  graphdone-redis:
    command: redis-server --tls-port 6380 --tls-cert-file /tls/redis.crt --tls-key-file /tls/redis.key --tls-protocols TLSv1.2
    volumes:
      - ./ssl/redis:/tls:ro
      - redis_data:/data
    ports:
      - "6380:6380"  # TLS port
    # Remove: - "6379:6379"  # Disable non-TLS
```

### Phase 3: Application TLS Configuration

#### **Node.js HTTPS Server**
```typescript
// packages/server/src/index.ts - Enhanced with HTTPS
import https from 'https';
import fs from 'fs';
import path from 'path';

async function startServer() {
  const app = express();
  
  // TLS configuration
  const isProduction = process.env.NODE_ENV === 'production';
  const tlsConfig = {
    key: fs.readFileSync(process.env.TLS_KEY_PATH || './ssl/server.key'),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH || './ssl/server.crt'),
    // Optional: CA bundle for client certificate verification
    ca: process.env.TLS_CA_PATH ? fs.readFileSync(process.env.TLS_CA_PATH) : undefined,
    // Security options
    ciphers: 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS',
    honorCipherOrder: true,
    secureProtocol: 'TLSv1_2_method'
  };
  
  // Create HTTPS server
  const httpServer = isProduction ? 
    https.createServer(tlsConfig, app) : 
    createServer(app);  // HTTP for development
  
  // Force HTTPS redirect middleware (production only)
  if (isProduction) {
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });
  }
  
  // Enhanced security headers
  app.use((req, res, next) => {
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
  
  // Rest of server configuration...
}
```

#### **React App HTTPS Configuration**
```typescript
// packages/web/src/lib/apollo.ts - HTTPS-aware GraphQL client
const isSecure = window.location.protocol === 'https:';
const wsProtocol = isSecure ? 'wss:' : 'ws:';
const httpProtocol = isSecure ? 'https:' : 'http:';

const httpUri = process.env.VITE_GRAPHQL_URL || `${httpProtocol}//${window.location.host}/graphql`;
const wsUri = process.env.VITE_GRAPHQL_WS_URL || `${wsProtocol}//${window.location.host}/graphql`;

// Enhanced Apollo Client with secure defaults
const client = new ApolloClient({
  link: from([
    // Error handling
    onError(({ graphQLErrors, networkError }) => {
      // Enhanced security: don't log sensitive errors in production
      if (process.env.NODE_ENV !== 'production') {
        if (graphQLErrors) console.error('GraphQL errors:', graphQLErrors);
        if (networkError) console.error('Network error:', networkError);
      }
    }),
    
    // Authentication
    setContext((_, { headers }) => ({
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : "",
        // Security headers
        'X-Requested-With': 'XMLHttpRequest',
      }
    })),
    
    // WebSocket link with secure connection
    split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
      },
      new GraphQLWsLink(createClient({
        url: wsUri,
        connectionParams: () => ({
          authorization: token ? `Bearer ${token}` : "",
        }),
      })),
      new HttpLink({ uri: httpUri })
    ),
  ]),
  cache: new InMemoryCache({
    // Enhanced cache security
    possibleTypes: {
      // Define possible types to prevent cache poisoning
    }
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'ignore',  // Handle errors gracefully
    },
    query: {
      errorPolicy: 'all',
    },
  },
});
```

## Secrets Management Strategy

### **Current Problems**
```bash
# deployment/docker-compose.yml - INSECURE
NEO4J_AUTH: neo4j/graphdone_password          # Hardcoded in version control
CORS_ORIGIN: http://localhost:3127            # Hardcoded domain  
JWT_SECRET = 'your-secret-key-change-in-production'  # Default secret
```

### **Phase 1: Environment Variables** ✅ **IMMEDIATE**
```bash
# .env.production (NOT in version control)
# Database - Neo4j (graph data)
NEO4J_USER=neo4j
NEO4J_PASSWORD=secureRandomPassword123!@#
NEO4J_URI=bolt://graphdone-neo4j:7687

# Authentication - SQLite (user data)
SQLITE_AUTH_DB=/secure/path/graphdone-auth.db
SQLITE_ENCRYPTION_KEY=sqlite-encryption-key-32-bytes-long

# JWT Authentication  
JWT_SECRET=your-super-secure-random-jwt-secret-256-bits-long
JWT_EXPIRES_IN=24h

# TLS Certificates
TLS_KEY_PATH=/ssl/server.key
TLS_CERT_PATH=/ssl/server.crt
TLS_CA_PATH=/ssl/ca.crt

# External API Keys (when needed)
GITHUB_API_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
CONFLUENCE_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxx
INFLUXDB_TOKEN=xxxxxxxxxxxxxxxxxxxxxxx
INFLUXDB_URL=https://your-influxdb-instance.com

# Email Service (for verification, password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-app-specific-password

# Production Settings
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
```

```yaml
# deployment/docker-compose.prod.yml - Secure version
services:
  graphdone-neo4j:
    environment:
      NEO4J_AUTH: ${NEO4J_USER}/${NEO4J_PASSWORD}  # From environment
    env_file:
      - .env.production
      
  graphdone-api:
    environment:
      - NODE_ENV=production
      - NEO4J_URI=${NEO4J_URI}
      - NEO4J_USER=${NEO4J_USER}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    env_file:
      - .env.production
```

### **Phase 2: Docker Secrets** ✅ **RECOMMENDED**
```yaml
# deployment/docker-compose.prod.yml - Production secrets
version: '3.8'
services:
  graphdone-api:
    secrets:
      - neo4j_password
      - jwt_secret
      - github_token
      - influxdb_token
    environment:
      - NEO4J_PASSWORD_FILE=/run/secrets/neo4j_password
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - GITHUB_API_TOKEN_FILE=/run/secrets/github_token
      - INFLUXDB_TOKEN_FILE=/run/secrets/influxdb_token

secrets:
  neo4j_password:
    file: ./secrets/neo4j_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  github_token:
    file: ./secrets/github_token.txt
  influxdb_token:
    file: ./secrets/influxdb_token.txt
```

```typescript
// packages/server/src/config/secrets.ts
import fs from 'fs';

export function getSecret(secretName: string, fallback?: string): string {
  // Try Docker secret first
  const secretPath = `/run/secrets/${secretName}`;
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }
  
  // Try environment file path
  const envFileKey = `${secretName.toUpperCase()}_FILE`;
  if (process.env[envFileKey]) {
    return fs.readFileSync(process.env[envFileKey]!, 'utf8').trim();
  }
  
  // Try direct environment variable
  const envKey = secretName.toUpperCase();
  if (process.env[envKey]) {
    return process.env[envKey]!;
  }
  
  if (fallback) {
    return fallback;
  }
  
  throw new Error(`Secret ${secretName} not found`);
}

// Usage in auth.ts
const JWT_SECRET = getSecret('jwt_secret');
const NEO4J_PASSWORD = getSecret('neo4j_password');
```

### **Phase 3: External Secrets Management** 🚀 **ENTERPRISE**
```yaml
# For larger deployments - HashiCorp Vault integration
# deployment/docker-compose.vault.yml
services:
  vault:
    image: vault:1.15
    container_name: graphdone-vault
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: vault-token-dev
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
    ports:
      - "8200:8200"
    cap_add:
      - IPC_LOCK
      
  graphdone-api:
    depends_on:
      - vault
    environment:
      VAULT_ADDR: http://vault:8200
      VAULT_TOKEN: vault-token-dev
```

```typescript
// packages/server/src/config/vault.ts
import { VaultApi } from 'node-vault-client';

class SecretsManager {
  private vault?: VaultApi;
  
  async initialize() {
    if (process.env.VAULT_ADDR) {
      this.vault = new VaultApi({
        endpoint: process.env.VAULT_ADDR,
        token: process.env.VAULT_TOKEN
      });
    }
  }
  
  async getSecret(path: string): Promise<string> {
    if (this.vault) {
      const secret = await this.vault.read(`secret/data/${path}`);
      return secret.data.data.value;
    }
    
    // Fallback to file-based secrets
    return getSecret(path);
  }
}

export const secrets = new SecretsManager();
```

## Deployment Security Checklist

### **Pre-Production Security Steps**

#### 1. **Generate Strong Secrets**
```bash
#!/bin/bash
# deployment/scripts/generate-secrets.sh
mkdir -p secrets

# Generate strong JWT secret (256 bits)
openssl rand -base64 32 > secrets/jwt_secret.txt

# Generate strong database password
openssl rand -base64 24 > secrets/neo4j_password.txt

# Generate API keys for external services (if needed)
echo "ghp_$(openssl rand -base64 24)" > secrets/github_token.txt
echo "influx_$(openssl rand -base64 32)" > secrets/influxdb_token.txt

# Set proper permissions
chmod 600 secrets/*.txt
echo "✅ Secrets generated and secured"
```

#### 2. **TLS Certificate Setup**
```bash
#!/bin/bash
# deployment/scripts/setup-tls.sh
DOMAIN=${1:-localhost}

if [ "$DOMAIN" = "localhost" ]; then
  echo "🔧 Setting up development certificates..."
  ./scripts/generate-dev-certs.sh
else
  echo "🌐 Setting up production certificates for $DOMAIN..."
  # Let's Encrypt via Caddy will handle this automatically
  # Just ensure DNS points to the server
  echo "✅ Point DNS A record for $DOMAIN to this server IP"
  echo "✅ Start docker-compose to auto-generate Let's Encrypt certificates"
fi
```

#### 3. **Security Validation**
```bash
#!/bin/bash
# deployment/scripts/security-check.sh

echo "🔍 Security validation checklist:"

# Check for hardcoded secrets
echo "Checking for hardcoded secrets..."
grep -r "password.*=" --exclude-dir=node_modules . && echo "❌ Hardcoded passwords found" || echo "✅ No hardcoded passwords"

# Check TLS configuration  
echo "Checking TLS setup..."
[ -f "ssl/server.crt" ] && echo "✅ TLS certificate found" || echo "❌ TLS certificate missing"

# Check environment variables
echo "Checking environment configuration..."
[ -f ".env.production" ] && echo "✅ Production environment configured" || echo "❌ Production .env missing"

# Check Docker secrets
echo "Checking Docker secrets..."
ls secrets/*.txt 2>/dev/null && echo "✅ Docker secrets configured" || echo "❌ Docker secrets missing"

# Check SQLite database security
echo "Checking SQLite database security..."
SQLITE_DB="packages/server/graphdone-auth.db"
if [ -f "$SQLITE_DB" ]; then
  PERMS=$(stat -f "%OLp" "$SQLITE_DB" 2>/dev/null || stat -c "%a" "$SQLITE_DB" 2>/dev/null)
  if [ "$PERMS" = "600" ]; then
    echo "✅ SQLite database has secure permissions (600)"
  else
    echo "❌ SQLite database permissions are $PERMS (should be 600)"
    echo "Fix with: chmod 600 $SQLITE_DB"
  fi
else
  echo "⚠️  SQLite database not found (will be created on first run)"
fi

# Check default passwords
echo "Checking for default passwords..."
docker-compose exec graphdone-neo4j cypher-shell -u neo4j -p graphdone_password "RETURN 1" 2>/dev/null && echo "❌ Default Neo4j password detected" || echo "✅ Neo4j password secured"

# Check for default admin in SQLite
echo "Checking SQLite default users..."
if [ -f "$SQLITE_DB" ]; then
  DEFAULT_ADMIN=$(sqlite3 "$SQLITE_DB" "SELECT username FROM users WHERE username='admin' AND password_hash LIKE '%\$2b\$10\$%' LIMIT 1;" 2>/dev/null || echo "")
  if [ -n "$DEFAULT_ADMIN" ]; then
    echo "⚠️  Default admin user found in SQLite - ensure password is changed"
  else
    echo "✅ No default admin user found in SQLite"
  fi
fi

echo "🔒 Security check complete"
```

### **Production Deployment Commands**
```bash
# Complete production deployment
./deployment/scripts/generate-secrets.sh
./deployment/scripts/setup-tls.sh your-domain.com
./deployment/scripts/security-check.sh

# Deploy with secrets
docker-compose -f docker-compose.prod.yml up -d

# Verify HTTPS is working
curl -I https://your-domain.com
```

## Monitoring & Alerting

### **Security Monitoring**
```typescript
// packages/server/src/middleware/security-monitoring.ts
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: 'Too many login attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "wss:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Login attempt monitoring
app.post('/graphql', loginLimiter, (req, res, next) => {
  if (req.body.operationName === 'Login') {
    // Log failed login attempts
    console.log(`Login attempt from ${req.ip} at ${new Date()}`);
  }
  next();
});
```

### **Certificate Renewal Monitoring**
```bash
#!/bin/bash
# deployment/scripts/cert-monitor.sh
# Run via cron: 0 2 * * 1 /path/to/cert-monitor.sh

CERT_PATH="/ssl/server.crt"
DAYS_WARNING=30

if [ -f "$CERT_PATH" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
  EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
  
  if [ $DAYS_LEFT -lt $DAYS_WARNING ]; then
    echo "⚠️  TLS certificate expires in $DAYS_LEFT days!"
    # Send alert email/notification
  else
    echo "✅ TLS certificate valid for $DAYS_LEFT days"
  fi
else
  echo "❌ TLS certificate not found!"
fi
```

## Expected Outcomes

### **Security Improvements**
- ✅ **All traffic encrypted** via HTTPS/WSS
- ✅ **No hardcoded secrets** in version control
- ✅ **Strong authentication** with secure JWT secrets
- ✅ **Database encryption** for sensitive data
- ✅ **Free SSL certificates** with automatic renewal
- ✅ **Zero browser warnings** with proper certificate chains

### **Operational Benefits**
- 🚀 **One-command deployment** with automated TLS
- 📊 **Security monitoring** and alerting
- 🔄 **Automatic certificate renewal** via Caddy/Let's Encrypt
- 🐳 **Docker secrets** for production-ready secret management
- 📈 **Scalable architecture** ready for enterprise secrets management

### **Compliance & Trust**
- 🛡️ **Industry standard security** practices
- 🔒 **GDPR/SOC2 ready** encryption at rest and in transit  
- 👥 **Team confidence** in production deployments
- 📱 **Mobile app ready** with secure API endpoints

This comprehensive TLS implementation provides enterprise-grade security while maintaining the simplicity and rapid development pace that GraphDone is known for.