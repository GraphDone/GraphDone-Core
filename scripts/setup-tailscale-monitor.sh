#!/bin/bash
# Setup Tailscale Health Monitoring for GraphDone Core
# Ensures Tailscale auto-recovers from freezes/hangs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  GraphDone Core - Tailscale Health Monitor Setup${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Create health monitor script
echo -e "${YELLOW}Step 1/4: Creating Tailscale health monitor script...${NC}"

sudo tee /usr/local/bin/tailscale-health-monitor.sh > /dev/null << 'EOF'
#!/bin/bash
# Tailscale Health Monitor - Auto-restart on freeze
# Part of GraphDone Core infrastructure

LOG_FILE="/var/log/tailscale-health.log"
TIMEOUT=5

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_tailscale() {
    if timeout $TIMEOUT tailscale status > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

log "Starting Tailscale health check (GraphDone Core)..."

if check_tailscale; then
    log "✓ Tailscale is healthy"
    exit 0
else
    log "✗ Tailscale is frozen or unresponsive"
    log "Restarting tailscaled service..."
    systemctl restart tailscaled
    sleep 3
    if check_tailscale; then
        log "✓ Tailscale successfully restarted"
        exit 0
    else
        log "✗ Tailscale restart failed - manual intervention needed"
        exit 1
    fi
fi
EOF

sudo chmod +x /usr/local/bin/tailscale-health-monitor.sh
echo -e "${BLUE}✓${NC} Created health monitor script"

# Step 2: Create systemd service
echo -e "${YELLOW}Step 2/4: Creating systemd service...${NC}"

sudo tee /etc/systemd/system/tailscale-health-monitor.service > /dev/null << 'EOF'
[Unit]
Description=Tailscale Health Monitor (GraphDone Core)
After=tailscaled.service
Documentation=https://github.com/graphdone/graphdone-core

[Service]
Type=oneshot
ExecStart=/usr/local/bin/tailscale-health-monitor.sh
StandardOutput=journal
StandardError=journal
User=root

[Install]
WantedBy=multi-user.target
EOF

echo -e "${BLUE}✓${NC} Created systemd service"

# Step 3: Create systemd timer
echo -e "${YELLOW}Step 3/4: Creating systemd timer...${NC}"

sudo tee /etc/systemd/system/tailscale-health-monitor.timer > /dev/null << 'EOF'
[Unit]
Description=Tailscale Health Monitor Timer (GraphDone Core)
Requires=tailscale-health-monitor.service
Documentation=https://github.com/graphdone/graphdone-core

[Timer]
# Run 2 minutes after boot
OnBootSec=2min
# Then every 5 minutes
OnUnitActiveSec=5min
# Precise timing
AccuracySec=1s
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo -e "${BLUE}✓${NC} Created systemd timer"

# Step 4: Enable and start timer
echo -e "${YELLOW}Step 4/4: Enabling and starting timer...${NC}"

sudo systemctl daemon-reload
sudo systemctl enable tailscale-health-monitor.timer
sudo systemctl start tailscale-health-monitor.timer

echo -e "${BLUE}✓${NC} Timer enabled and started"

# Verify installation
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Installation Complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Verification:"
sudo systemctl status tailscale-health-monitor.timer --no-pager | head -10
echo ""
echo "Log file: /var/log/tailscale-health.log"
echo "Next check: $(systemctl list-timers tailscale-health-monitor.timer --no-pager | grep tailscale)"
echo ""
echo -e "${GREEN}✓ Tailscale health monitoring is now active for GraphDone Core${NC}"
