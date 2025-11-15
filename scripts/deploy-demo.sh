#!/bin/bash
# GraphDone Demo Deployment Script
# Deploys the complete demo stack to any server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TRAEFIK_DIR="${TRAEFIK_DIR:-$HOME/graphdone-full/GraphDone-Devops/demo-servers/traefik}"
DEMO_HOST="${DEMO_HOST:-$(hostname -f)}"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  GraphDone Demo Deployment${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📍 Target Host: $DEMO_HOST"
echo "📂 Project Root: $PROJECT_ROOT"
echo "🔧 Traefik Dir: $TRAEFIK_DIR"
echo ""

# Step 1: Create Traefik file provider config
echo -e "${YELLOW}Step 1/6: Creating Traefik configuration...${NC}"
mkdir -p "$TRAEFIK_DIR/config"

cat > "$TRAEFIK_DIR/config/demo.yml" << 'EOF'
http:
  routers:
    # GraphQL API router - high priority
    demo-api:
      rule: "PathPrefix(`/graphql`) || PathPrefix(`/health`)"
      service: demo-api-service
      entryPoints:
        - web
      priority: 20

    # Demo web app router - medium priority
    demo-web:
      rule: "PathPrefix(`/demo`)"
      service: demo-web-service
      entryPoints:
        - web
      priority: 10
      middlewares:
        - demo-strip

  services:
    # GraphQL API service
    demo-api-service:
      loadBalancer:
        servers:
          - url: "http://graphdone-server:4127"

    # Demo web service
    demo-web-service:
      loadBalancer:
        servers:
          - url: "http://graphdone-web:80"

  middlewares:
    # Strip /demo prefix before passing to nginx
    demo-strip:
      stripPrefix:
        prefixes:
          - "/demo"
EOF

echo "✓ Created Traefik config at $TRAEFIK_DIR/config/demo.yml"

# Step 2: Ensure Docker network exists
echo -e "${YELLOW}Step 2/6: Ensuring Docker network exists...${NC}"
docker network create graphdone-demo 2>/dev/null && echo "✓ Created graphdone-demo network" || echo "✓ Network already exists"

# Step 3: Start/Restart Traefik
echo -e "${YELLOW}Step 3/6: Starting Traefik...${NC}"
cd "$TRAEFIK_DIR"
if docker ps | grep -q graphdone-traefik; then
    echo "⟳ Restarting existing Traefik..."
    docker-compose restart traefik
else
    echo "🚀 Starting Traefik..."
    docker-compose up -d traefik
fi
echo "✓ Traefik is running"

# Step 4: Build demo images
echo -e "${YELLOW}Step 4/6: Building demo images...${NC}"
cd "$PROJECT_ROOT"
echo "  Building web image..."
docker-compose -f docker-compose.demo.yml build web --quiet
echo "  Building server image..."
docker-compose -f docker-compose.demo.yml build server --quiet
echo "✓ Images built successfully"

# Step 5: Start demo services
echo -e "${YELLOW}Step 5/6: Starting demo services...${NC}"
docker-compose -f docker-compose.demo.yml up -d
echo "✓ Demo services started"

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Step 6: Verify deployment
echo -e "${YELLOW}Step 6/6: Verifying deployment...${NC}"

# Check service status
UNHEALTHY=$(docker-compose -f docker-compose.demo.yml ps | grep -c "unhealthy" || true)
if [ "$UNHEALTHY" -gt 0 ]; then
    echo -e "${RED}⚠️  Warning: Some services are unhealthy${NC}"
    docker-compose -f docker-compose.demo.yml ps
fi

# Test endpoints
echo ""
echo "Testing endpoints..."

# Test health endpoint
if curl -s http://localhost/health > /dev/null 2>&1; then
    echo "✓ Health endpoint: http://$DEMO_HOST/health"
else
    echo -e "${RED}✗ Health endpoint failed${NC}"
fi

# Test GraphQL endpoint
if curl -s -X POST -H "Content-Type: application/json" -d '{"query":"{__typename}"}' http://localhost/graphql | grep -q "Query"; then
    echo "✓ GraphQL endpoint: http://$DEMO_HOST/graphql"
else
    echo -e "${RED}✗ GraphQL endpoint failed${NC}"
fi

# Test demo page
if curl -s http://localhost/demo | grep -q "GraphDone"; then
    echo "✓ Demo app: http://$DEMO_HOST/demo"
else
    echo -e "${RED}✗ Demo app failed${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Deployment Complete! 🎉${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "🌐 Access the demo at:"
echo "   http://$DEMO_HOST/demo"
echo ""
echo "🔑 Default Credentials:"
echo "   Admin:  username: admin  | password: graphdone"
echo "   Viewer: username: viewer | password: graphdone"
echo "   Guest:  Click 'Continue as Guest'"
echo ""
echo "📊 Service Management:"
echo "   View logs:    docker-compose -f docker-compose.demo.yml logs -f"
echo "   Stop demo:    docker-compose -f docker-compose.demo.yml down"
echo "   Restart demo: docker-compose -f docker-compose.demo.yml restart"
echo ""
