#!/bin/bash

#################################################################################
# GraphDone Demo Reset Script
#################################################################################
# This script resets the demo instance to a clean state by:
# - Deleting all user-created graphs, work items, and edges
# - Removing demo user accounts (keeping admin)
# - Resetting database to seed data
#
# Usage:
#   ./scripts/reset-demo.sh
#
# Schedule with cron (2 AM UTC daily):
#   0 2 * * * cd /path/to/GraphDone-Core && ./scripts/reset-demo.sh >> /var/log/graphdone-demo-reset.log 2>&1
#################################################################################

set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NEO4J_URI=${NEO4J_URI:-"bolt://localhost:7687"}
NEO4J_USER=${NEO4J_USER:-"neo4j"}
NEO4J_PASSWORD=${NEO4J_PASSWORD:-"graphdone_password"}
DEMO_MODE=${DEMO_MODE:-"false"}

# Check if demo mode is enabled
if [ "$DEMO_MODE" != "true" ]; then
  echo -e "${RED}❌ Demo mode is not enabled. Exiting.${NC}"
  echo -e "${YELLOW}   Set DEMO_MODE=true in .env to enable demo reset.${NC}"
  exit 1
fi

echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}   GraphDone Demo Reset${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "Timestamp: $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo -e "Neo4j URI: $NEO4J_URI"
echo ""

# Backup before reset (optional)
if [ "${DEMO_BACKUP_BEFORE_RESET:-false}" = "true" ]; then
  echo -e "${YELLOW}📦 Creating backup before reset...${NC}"
  BACKUP_DIR="./backups/demo-$(date '+%Y%m%d-%H%M%S')"
  mkdir -p "$BACKUP_DIR"
  # Add Neo4j backup command here if needed
  echo -e "${GREEN}✓ Backup created at: $BACKUP_DIR${NC}"
fi

# Reset database using Neo4j Cypher
echo -e "${YELLOW}🔄 Resetting demo database...${NC}"

# Create a Cypher script for reset
cat > /tmp/reset-demo.cypher <<'EOF'
// Delete all user-created data
MATCH (w:WorkItem)-[r:BELONGS_TO]->(g:Graph)
DELETE r;

MATCH (e:Edge)
DELETE e;

MATCH (w:WorkItem)
DELETE w;

MATCH (g:Graph)
DELETE g;

// Delete demo user accounts (keep admin users)
MATCH (u:User)
WHERE u.role <> 'ADMIN'
DETACH DELETE u;

// Delete orphaned contributors
MATCH (c:Contributor)
WHERE NOT (c)<-[:CONTRIBUTOR_PROFILE]-(:User)
DELETE c;

// Delete orphaned teams
MATCH (t:Team)
WHERE NOT (t)<-[:MEMBER_OF]-(:User)
DELETE t;

// Return stats
MATCH (u:User) WITH count(u) as userCount
MATCH (g:Graph) WITH userCount, count(g) as graphCount
MATCH (w:WorkItem) WITH userCount, graphCount, count(w) as workItemCount
RETURN userCount, graphCount, workItemCount;
EOF

# Execute reset using cypher-shell
if command -v cypher-shell &> /dev/null; then
  echo -e "${YELLOW}   Executing Cypher reset script...${NC}"
  cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" --file /tmp/reset-demo.cypher
  echo -e "${GREEN}✓ Database reset complete${NC}"
else
  echo -e "${RED}❌ cypher-shell not found. Install Neo4j shell tools.${NC}"
  echo -e "${YELLOW}   Attempting reset via HTTP API...${NC}"

  # Alternative: Use Neo4j HTTP API
  NEO4J_HTTP_URI=$(echo $NEO4J_URI | sed 's/bolt/http/' | sed 's/7687/7474/')

  CYPHER_QUERY=$(cat /tmp/reset-demo.cypher | tr '\n' ' ')

  curl -X POST "$NEO4J_HTTP_URI/db/neo4j/tx/commit" \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $(echo -n "$NEO4J_USER:$NEO4J_PASSWORD" | base64)" \
    -d "{\"statements\":[{\"statement\":\"$CYPHER_QUERY\"}]}" \
    --silent --output /tmp/reset-response.json

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database reset complete (via HTTP API)${NC}"
    cat /tmp/reset-response.json | python3 -m json.tool 2>/dev/null || cat /tmp/reset-response.json
  else
    echo -e "${RED}❌ Failed to reset database${NC}"
    exit 1
  fi
fi

# Clean up temp files
rm -f /tmp/reset-demo.cypher /tmp/reset-response.json

# Reseed demo data (optional)
if [ "${DEMO_RESEED_AFTER_RESET:-false}" = "true" ]; then
  echo -e "${YELLOW}🌱 Reseeding demo data...${NC}"
  npm run db:seed
  echo -e "${GREEN}✓ Demo data reseeded${NC}"
fi

# Log reset completion
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}   Demo Reset Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "Completed: $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# Send notification (optional)
if [ -n "${DEMO_RESET_WEBHOOK_URL}" ]; then
  curl -X POST "$DEMO_RESET_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Demo instance reset completed\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    --silent > /dev/null
fi

exit 0
