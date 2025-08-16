# Deployment Guide

**AI-Generated Content Warning: This documentation contains AI-generated content. Verify information before depending on it for decision making.**

This guide covers various deployment options for GraphDone, from local development to production environments.

## Quick Deployment Options

### Development (Local)
```bash
./run.sh
```

### Development (Docker)
```bash
./run.sh --docker-dev
```

### Production (Docker)
```bash
./run.sh --docker
```

## Environment Variables

### Server (.env)
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/graphdone
REDIS_URL=redis://localhost:6379

# Server
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://yourdomain.com

# Authentication (when implemented)
JWT_SECRET=your-secure-secret
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
   docker-compose up -d
   ```

2. **Scale services:**
   ```bash
   docker-compose up -d --scale server=3
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f server
   ```

### Custom Configuration

Create `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  server:
    environment:
      - DATABASE_URL=postgresql://user:pass@your-db:5432/graphdone
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
     --from-literal=database-url="postgresql://..." \
     --from-literal=jwt-secret="your-secret"
   ```

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
             "name": "DATABASE_URL",
             "valueFrom": "arn:aws:secretsmanager:region:account:secret:graphdone/database"
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

### PostgreSQL

#### Managed Services
- **AWS RDS**: Recommended for production
- **Google Cloud SQL**: Good performance and reliability
- **Azure Database**: Integrated with Azure services
- **DigitalOcean Managed Database**: Cost-effective option

#### Self-hosted
```bash
# Using Docker
docker run -d \
  --name graphdone-postgres \
  -e POSTGRES_DB=graphdone \
  -e POSTGRES_USER=graphdone \
  -e POSTGRES_PASSWORD=secure_password \
  -v postgres_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:15-alpine
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
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

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
psql $DATABASE_URL
\l  # List databases
\q  # Quit
```

#### Docker Issues
```bash
# View logs
docker-compose logs server

# Restart service
docker-compose restart server

# Rebuild images
docker-compose build --no-cache
```

## Support

For deployment support:
- [GitHub Issues](https://github.com/your-org/graphdone/issues)
- [Community Discord](https://discord.gg/graphdone)
- [Documentation](../README.md)