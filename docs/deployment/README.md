# Deployment Guide

This guide covers various deployment options for GraphDone, from local development to production environments.

## Quick Deployment Options

### Development (Local)
```bash
./tools/run.sh
```

### Development (Docker)
```bash
./tools/run.sh --docker-dev
```

### Production (Docker)
```bash
./tools/run.sh --docker
```

## Environment Variables

### Required production signing secrets

With `NODE_ENV=production`, the API refuses to start if `JWT_SECRET` or
`SESSION_SECRET` is missing, blank, or a published GraphDone default/example
value. This applies to direct Node startup and containers. Development and test
startup retain their existing defaults.

Generate two independent secrets once for each deployment, store them privately,
and retain them across restarts. For example, create a new file outside this
checkout without printing its contents:

```bash
(umask 077; set -o noclobber; printf 'JWT_SECRET=%s\nSESSION_SECRET=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > /secure/path/graphdone.env)
```

Supply that file to the legacy production Compose variants:

```bash
docker compose --env-file /secure/path/graphdone.env -f deployment/docker-compose.yml up -d
```

The HTTP and registry variants use the same variables. `scripts/self-host.sh`
already creates separate random secrets in its private environment file. For
direct `npm start --workspace=@graphdone/server` or `node dist/index.js`, set both
environment variables, or put them in `.env` in the server process's working
directory; configuration loads before authentication modules initialize.

Existing production installations using defaults must configure both secrets
before upgrading. Replacing a JWT key invalidates existing bearer tokens;
replacing a session key invalidates signed sessions, so users must sign in again.
The guard rejects known unsafe configuration; it does not measure arbitrary
secret strength. Use a secret manager or cryptographically random values such
as those above. [Startup regression evidence and limits](../quality/PRODUCTION_SECRETS_2026-10-23.md).

### Server (.env)
```bash
# Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=graphdone_password

# Server
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://yourdomain.com

# Authentication
JWT_SECRET=
SESSION_SECRET=
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

### Web App (.env)
```bash
# API endpoints
VITE_GRAPHQL_URL=https://api.yourdomain.com/graphql
VITE_GRAPHQL_WS_URL=wss://api.yourdomain.com/graphql

# App configuration
VITE_APP_NAME=GraphDone
VITE_APP_VERSION=1.0.0

# Feature flags
VITE_ENABLE_SUBSCRIPTIONS=true
VITE_ENABLE_3D_VIEW=true
```

## Docker Deployment

### Production Stack

1. **Build and start services:**
   ```bash
   docker compose up -d
   ```

2. **Scale services:**
   ```bash
   docker compose up -d --scale server=3
   ```

3. **View logs:**
   ```bash
   docker compose logs -f server
   ```

### Custom Configuration

Create `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  server:
    environment:
      - NEO4J_URI=bolt://your-neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=secure_password
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  web:
    environment:
      - VITE_GRAPHQL_URL=https://your-api.com/graphql
```

## Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (1.20+)
- kubectl configured
- Ingress controller
- Cert-manager (for TLS)

### Quick Deploy
```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=graphdone

# Get external IP
kubectl get ingress graphdone-ingress
```

### Configuration

1. **Create secrets:**
   ```bash
   kubectl create secret generic graphdone-secrets \
     --from-env-file=/secure/path/graphdone.env
   ```

   Use the privately generated file described above. Map its `JWT_SECRET` and
   `SESSION_SECRET` keys into the API container environment, for example with
   `envFrom.secretRef`. Supply the deployment's Neo4j configuration separately.

2. **Configure ingress:**
   ```yaml
   # k8s/ingress.yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: graphdone-ingress
     annotations:
       cert-manager.io/cluster-issuer: letsencrypt-prod
   spec:
     tls:
       - hosts:
           - graphdone.yourdomain.com
         secretName: graphdone-tls
     rules:
       - host: graphdone.yourdomain.com
         http:
           paths:
             - path: /
               pathType: Prefix
               backend:
                 service:
                   name: graphdone-web
                   port:
                     number: 80
             - path: /graphql
               pathType: Prefix
               backend:
                 service:
                   name: graphdone-server
                   port:
                     number: 4000
   ```

## Cloud Provider Deployments

### AWS ECS

1. **Create task definition:**
   ```json
   {
     "family": "graphdone",
     "networkMode": "awsvpc",
     "cpu": "512",
     "memory": "1024",
     "containerDefinitions": [
       {
         "name": "graphdone-server",
         "image": "your-registry/graphdone-server:latest",
         "portMappings": [
           {
             "containerPort": 4000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "NODE_ENV",
             "value": "production"
           }
         ],
         "secrets": [
           {
             "name": "NEO4J_URI",
             "valueFrom": "arn:aws:secretsmanager:region:account:secret:graphdone/neo4j"
           }
         ]
       }
     ]
   }
   ```

2. **Create service:**
   ```bash
   aws ecs create-service \
     --cluster graphdone-cluster \
     --service-name graphdone-service \
     --task-definition graphdone \
     --desired-count 2
   ```

### Google Cloud Run

1. **Deploy server:**
   ```bash
   gcloud run deploy graphdone-server \
     --image gcr.io/your-project/graphdone-server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NODE_ENV=production
   ```

2. **Deploy web app:**
   ```bash
   gcloud run deploy graphdone-web \
     --image gcr.io/your-project/graphdone-web \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Azure Container Instances

```bash
# Create resource group
az group create --name graphdone-rg --location eastus

# Deploy container group
az container create \
  --resource-group graphdone-rg \
  --file azure-container-group.yaml
```

## Database Setup

### Neo4j

#### Managed Services
- **Neo4j AuraDB**: Recommended for production
- **AWS**: Neo4j on EC2 or ECS
- **Google Cloud**: Neo4j on GKE
- **Azure**: Neo4j on AKS

#### Self-hosted
```bash
# Using Docker
docker run -d \
  --name graphdone-neo4j \
  -e NEO4J_AUTH=neo4j/graphdone_password \
  -e NEO4J_PLUGINS='["apoc"]' \
  -e NEO4J_apoc_export_file_enabled=true \
  -e NEO4J_apoc_import_file_enabled=true \
  -v neo4j_data:/data \
  -v neo4j_logs:/logs \
  -p 7474:7474 -p 7687:7687 \
  neo4j:5.15-community
```

### Redis (Optional)

For caching and session management:

```bash
# Using Docker
docker run -d \
  --name graphdone-redis \
  -v redis_data:/data \
  -p 6379:6379 \
  redis:7-alpine
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Custom Certificates

Add to nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
}
```

## Monitoring and Logging

### Health Checks

The server provides health check endpoints:
- `GET /health` - Basic health status
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Metrics

Configure Prometheus metrics:
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'graphdone'
    static_configs:
      - targets: ['graphdone-server:4000']
    metrics_path: /metrics
```

### Logging

Configure structured logging:
```json
{
  "level": "info",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "graphdone-server",
  "message": "Server started",
  "port": 4000
}
```

## Performance Optimization

### Caching
- Enable Redis for session and query caching
- Configure CDN for static assets
- Implement GraphQL query caching

### Database
- Create appropriate indexes
- Configure connection pooling
- Enable query optimization

### Scaling
- Horizontal scaling with load balancer
- Database read replicas
- CDN for global distribution

## Security Considerations

### Production Checklist
- [ ] Enable HTTPS everywhere
- [ ] Configure CORS properly
- [ ] Set up authentication
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Regular security updates
- [ ] Monitor for vulnerabilities
- [ ] Backup strategy implemented

### Environment Hardening
```bash
# Disable unnecessary services
sudo systemctl disable apache2
sudo systemctl disable nginx-default

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Backup and Recovery

### Database Backup
```bash
# Daily backup script
#!/bin/bash
neo4j-admin backup --backup-dir=/backups --name=graphdone-$(date +%Y%m%d)

# Upload to cloud storage
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://your-backup-bucket/
```

### Disaster Recovery
1. Maintain database backups (point-in-time recovery)
2. Store application artifacts in registry
3. Document recovery procedures
4. Test recovery process regularly

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Find process using port
sudo lsof -i :4000
sudo kill -9 <PID>
```

#### Database Connection
```bash
# Test connection
cypher-shell -u neo4j -p $NEO4J_PASSWORD
MATCH (n) RETURN count(n);  // Test query
:exit  // Quit
```

#### Docker Issues
```bash
# View logs
docker compose logs server

# Restart service
docker compose restart server

# Rebuild images
docker compose build --no-cache
```

## Support

For deployment support:
- [GitHub Issues](https://github.com/GraphDone/GraphDone-Core/issues)
- [Community Discord](https://discord.gg/graphdone)
- [Documentation](../README.md)
