# Tailscale Health Monitoring

## Overview

GraphDone Core includes automatic Tailscale health monitoring to ensure reliable mesh networking across all instances.

## Problem

Tailscale can enter a "zombie" state where:
- The daemon process runs but doesn't respond
- Commands like `tailscale status` hang indefinitely
- DNS resolution fails (hostnames become unreachable)
- Network connectivity is lost across the mesh

This requires manual intervention to restart the service.

## Solution

Automated health monitoring that:
- ✅ Checks Tailscale every 5 minutes
- ✅ Detects hangs using timeout (not just process checks)
- ✅ Auto-restarts when unresponsive
- ✅ Logs all events for debugging
- ✅ Requires zero manual intervention

## Installation

### Automatic (Recommended)

The monitoring is automatically set up when you run:

```bash
./tools/setup.sh
```

If Tailscale is installed, the script will detect it and offer to set up monitoring.

### Manual Installation

If you need to install it manually:

```bash
sudo bash ./scripts/setup-tailscale-monitor.sh
```

## Verification

Check if monitoring is running:

```bash
sudo systemctl status tailscale-health-monitor.timer
```

View monitoring logs:

```bash
sudo cat /var/log/tailscale-health.log
```

Check next scheduled run:

```bash
systemctl list-timers tailscale-health-monitor.timer
```

## How It Works

### Health Check Logic

Every 5 minutes, the monitor:

1. Runs `timeout 5s tailscale status`
2. If successful → Logs "healthy" and exits
3. If timeout → Restarts `tailscaled` service
4. Verifies restart was successful
5. Logs all actions with timestamps

### Files Installed

```
/usr/local/bin/tailscale-health-monitor.sh         # Health check script
/etc/systemd/system/tailscale-health-monitor.service  # Systemd service
/etc/systemd/system/tailscale-health-monitor.timer    # 5-minute timer
/var/log/tailscale-health.log                      # Event log
```

### Systemd Timer Configuration

```ini
[Timer]
OnBootSec=2min       # First check 2 minutes after boot
OnUnitActiveSec=5min # Then every 5 minutes
AccuracySec=1s       # Precise timing
```

## Log Examples

### Healthy Status
```
[2025-11-16 06:15:00] Starting Tailscale health check (GraphDone Core)...
[2025-11-16 06:15:01] ✓ Tailscale is healthy
```

### Auto-Recovery
```
[2025-11-16 06:20:00] Starting Tailscale health check (GraphDone Core)...
[2025-11-16 06:20:05] ✗ Tailscale is frozen or unresponsive
[2025-11-16 06:20:05] Restarting tailscaled service...
[2025-11-16 06:20:08] ✓ Tailscale successfully restarted
```

## Troubleshooting

### Timer not running

Enable and start the timer:

```bash
sudo systemctl enable tailscale-health-monitor.timer
sudo systemctl start tailscale-health-monitor.timer
```

### Check for errors

View systemd journal:

```bash
sudo journalctl -u tailscale-health-monitor.service -n 50
```

### Manually trigger check

```bash
sudo systemctl start tailscale-health-monitor.service
```

### Disable monitoring

```bash
sudo systemctl stop tailscale-health-monitor.timer
sudo systemctl disable tailscale-health-monitor.timer
```

## Integration with GraphDone

This monitoring is critical for GraphDone Core because:

1. **Demo Instances**: Demo servers need reliable mesh connectivity
2. **Multi-Server Deployments**: Clusters rely on Tailscale for service discovery
3. **Developer Experience**: Frozen Tailscale blocks local development
4. **Production Reliability**: Auto-recovery prevents manual intervention

## Configuration

### Modify Check Interval

Edit the timer file:

```bash
sudo nano /etc/systemd/system/tailscale-health-monitor.timer
```

Change `OnUnitActiveSec=5min` to desired interval, then:

```bash
sudo systemctl daemon-reload
sudo systemctl restart tailscale-health-monitor.timer
```

### Modify Timeout

Edit the health check script:

```bash
sudo nano /usr/local/bin/tailscale-health-monitor.sh
```

Change `TIMEOUT=5` to desired value (in seconds).

## Related Documentation

- [GraphDone DevOps Monitoring](../../../GraphDone-Devops/monitoring/tailscale/README.md)
- [Tailscale Official Docs](https://tailscale.com/kb/)
- [Setup Script](../../tools/setup.sh)

## Change Log

### 2025-11-16 - Initial Integration
- Added Tailscale health monitoring to GraphDone Core
- Integrated into `tools/setup.sh`
- Created setup script and documentation
- Part of core infrastructure capabilities

---

**Status**: Production Ready
**Maintainer**: GraphDone DevOps
**Related**: GraphDone-Devops/monitoring/tailscale
