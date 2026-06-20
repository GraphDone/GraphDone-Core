#!/usr/bin/env bash
# Install the live test dashboard as a systemd --user service so it is ALWAYS up:
# auto-restarts on crash, starts on boot, and (with linger) runs even when logged
# out. Serves the latest unified report — videos, graphs, images, narration — at
# http://localhost:3199. Idempotent; re-run to update.
#
#   bash scripts/install-dashboard-service.sh        # install + start + enable
#   systemctl --user status  graphdone-dashboard     # check
#   systemctl --user restart graphdone-dashboard     # restart
#   systemctl --user disable --now graphdone-dashboard  # stop + remove from boot
set -euo pipefail

CORE="/home/scubasonar/Code/graphdone-repos/GraphDone-Core"
PORT="${DASHBOARD_PORT:-3199}"
NODE="$(command -v node || echo /home/scubasonar/.nvm/versions/node/v20.20.2/bin/node)"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT="$UNIT_DIR/graphdone-dashboard.service"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "❌ systemctl not available — fall back to the cron loop (scripts/dashboard-loop.sh) which keeps it alive every ~30 min + @reboot."
  exit 1
fi

mkdir -p "$UNIT_DIR"

# free the port from any stray non-systemd instance so ExecStart can bind
pkill -f 'dashboard/server.mjs' 2>/dev/null || true
sleep 1

cat > "$UNIT" <<EOF
[Unit]
Description=GraphDone live test dashboard (unified report: videos, graphs, images, narrated)
After=network.target

[Service]
Type=simple
WorkingDirectory=$CORE
ExecStart=$NODE $CORE/tests/lib/dashboard/server.mjs --port $PORT
Restart=always
RestartSec=3
Environment=NODE_NO_WARNINGS=1
Environment=DASHBOARD_PORT=$PORT

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now graphdone-dashboard

# keep it running across logout / before login (best-effort; may need privileges)
loginctl enable-linger "$USER" 2>/dev/null && echo "✅ linger enabled (survives logout)" || echo "ℹ️  linger not enabled (service still runs while logged in; @reboot cron covers boot)"

sleep 2
echo
systemctl --user --no-pager status graphdone-dashboard | head -6 || true
echo
code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/state" 2>/dev/null || echo 000)"
echo "🌐 dashboard http://localhost:$PORT  → HTTP $code"
echo "   (Restart=always · enabled on boot · auto-restarts on crash)"
