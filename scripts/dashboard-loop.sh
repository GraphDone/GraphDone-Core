#!/usr/bin/env bash
# Autonomous continuous-improvement loop for GraphDone, driven by cron so it
# survives session limits AND reboots. Each invocation (cron passes "once"):
#   1. ensures the live test dashboard server is up (the guiding light)
#   2. self-checks the dashboard (its own unit tests)
#   3. runs ONE bounded headless `claude -p` improvement iteration — the agent
#      decides whether to run a real test suite (which is what feeds the
#      dashboard fresh run data); the driver never fabricates synthetic runs.
# Single-instance via flock. Set NO_AGENT=1 to skip step 3 (mechanical only).
#
#   bash scripts/dashboard-loop.sh once
set -uo pipefail

CORE="/home/scubasonar/Code/graphdone-repos/GraphDone-Core"
STATE="$CORE/test-artifacts/dashboard"
LOG="$STATE/loop.log"
LOCK="$STATE/loop.lock"
PORT="${DASHBOARD_PORT:-3199}"
AGENT_TIMEOUT="${AGENT_TIMEOUT:-1500}"

# cron runs with a minimal env — put nvm node + ~/.local/bin (claude) on PATH
export PATH="/home/scubasonar/.nvm/versions/node/v20.20.2/bin:/home/scubasonar/.local/bin:$PATH"
export NODE_NO_WARNINGS=1

mkdir -p "$STATE"
log() { echo "[$(date -Is)] $*" >> "$LOG"; }

# single instance: bail if a previous iteration is still running
exec 9>"$LOCK"
if ! flock -n 9; then log "skip: previous iteration still running"; exit 0; fi

cd "$CORE" || { log "fatal: cannot cd $CORE"; exit 1; }
log "── iteration start (pid $$) ──"

health() { curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/state" 2>/dev/null; }

# 1) keep the dashboard alive
if [ "$(health)" != "200" ]; then
  log "dashboard down → starting"
  nohup npm run dashboard >/tmp/gd-dash.log 2>&1 & disown
  for _ in 1 2 3 4 5 6; do sleep 1; [ "$(health)" = "200" ] && break; done
fi
log "dashboard health=$(health)"

# 2) self-check the dashboard tool (cheap; does NOT fabricate runs)
if node --test tests/lib/dashboard/ >>"$LOG" 2>&1; then log "dashboard lib tests ok"; else log "dashboard lib tests FAILED"; fi

# 3) one bounded headless agent iteration (skippable)
if [ "${NO_AGENT:-0}" = "1" ]; then
  log "NO_AGENT=1 → skipping agent iteration"
elif command -v claude >/dev/null 2>&1 && [ -f "$CORE/scripts/dashboard-loop.prompt.txt" ]; then
  log "agent iteration start (timeout ${AGENT_TIMEOUT}s)"
  if timeout "$AGENT_TIMEOUT" claude -p "$(cat "$CORE/scripts/dashboard-loop.prompt.txt")" \
      --permission-mode bypassPermissions >>"$LOG" 2>&1; then
    log "agent iteration done"
  else
    log "agent iteration ended (rc=$?)"
  fi
else
  log "no claude CLI or prompt file → mechanical upkeep only"
fi

log "── iteration complete ──"
