#!/bin/bash
# Demonstration of enhanced test tracking for GraphDone installation
# Shows UUID, commit ID, CRC, and unique filenames

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$PROJECT_ROOT/public/install.sh"
REPORT_DIR="$PROJECT_ROOT/test-results/installation-demo"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Generate unique test run ID
TEST_RUN_UUID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$$-$RANDOM")

# Get git information
GIT_COMMIT=$(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT_SHORT=$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(cd "$PROJECT_ROOT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_AUTHOR=$(cd "$PROJECT_ROOT" && git log -1 --pretty=format:'%an' 2>/dev/null || echo "unknown")
GIT_DATE=$(cd "$PROJECT_ROOT" && git log -1 --pretty=format:'%ai' 2>/dev/null || echo "unknown")

# Calculate CRC for installation script
if command -v cksum > /dev/null 2>&1; then
    INSTALL_SCRIPT_CRC=$(cksum "$INSTALL_SCRIPT" 2>/dev/null | awk '{print $1}' || echo "unknown")
elif command -v md5sum > /dev/null 2>&1; then
    INSTALL_SCRIPT_CRC=$(md5sum "$INSTALL_SCRIPT" 2>/dev/null | cut -d' ' -f1 | head -c 8 || echo "unknown")
else
    INSTALL_SCRIPT_CRC="unknown"
fi

# System information
SYSTEM_INFO="$(uname -s) $(uname -r) $(uname -m)"
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")

# Create report directory
mkdir -p "$REPORT_DIR"

# Unique report filename with all details
DEMO_REPORT="$REPORT_DIR/demo_${TIMESTAMP}_${GIT_COMMIT_SHORT}_${TEST_RUN_UUID:0:8}.txt"

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}     GraphDone Installation Test - Tracking Demo${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo
echo -e "${GREEN}Test Run UUID:${NC} $TEST_RUN_UUID"
echo -e "${GREEN}Timestamp:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${GREEN}Epoch Time:${NC} $(date +%s)"
echo
echo -e "${BOLD}Git Information:${NC}"
echo -e "  Commit ID (Full): $GIT_COMMIT"
echo -e "  Commit ID (Short): $GIT_COMMIT_SHORT"
echo -e "  Branch: $GIT_BRANCH"
echo -e "  Author: $GIT_AUTHOR"
echo -e "  Commit Date: $GIT_DATE"
echo
echo -e "${BOLD}Checksums:${NC}"
echo -e "  Install Script CRC: $INSTALL_SCRIPT_CRC"
if [ -f "$INSTALL_SCRIPT" ]; then
    echo -e "  Install Script Size: $(stat -f%z "$INSTALL_SCRIPT" 2>/dev/null || stat -c%s "$INSTALL_SCRIPT" 2>/dev/null || echo "unknown") bytes"
    echo -e "  Install Script Modified: $(stat -f"%Sm" -t "%Y-%m-%d %H:%M:%S" "$INSTALL_SCRIPT" 2>/dev/null || stat -c"%y" "$INSTALL_SCRIPT" 2>/dev/null | cut -d. -f1 || echo "unknown")"
fi
echo
echo -e "${BOLD}System Information:${NC}"
echo -e "  Hostname: $HOSTNAME"
echo -e "  Platform: $SYSTEM_INFO"
echo -e "  Docker Version: $(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ',' || echo "not available")"
echo
echo -e "${BOLD}Generated Files:${NC}"
echo -e "  Report: $DEMO_REPORT"
echo -e "  Unique Filename Pattern: demo_${TIMESTAMP}_${GIT_COMMIT_SHORT}_${TEST_RUN_UUID:0:8}"
echo

# Generate demo report
cat > "$DEMO_REPORT" << EOF
GraphDone Installation Test - Tracking Demonstration
====================================================

TEST RUN IDENTIFICATION
-----------------------
UUID: $TEST_RUN_UUID
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')
Epoch: $(date +%s)

GIT REPOSITORY STATE
--------------------
Commit ID: $GIT_COMMIT
Short ID: $GIT_COMMIT_SHORT
Branch: $GIT_BRANCH
Author: $GIT_AUTHOR
Date: $GIT_DATE

FILE CHECKSUMS
--------------
Install Script CRC32: $INSTALL_SCRIPT_CRC
Install Script Size: $(stat -f%z "$INSTALL_SCRIPT" 2>/dev/null || stat -c%s "$INSTALL_SCRIPT" 2>/dev/null || echo "0") bytes
Last Modified: $(stat -f"%Sm" -t "%Y-%m-%d %H:%M:%S" "$INSTALL_SCRIPT" 2>/dev/null || stat -c"%y" "$INSTALL_SCRIPT" 2>/dev/null | cut -d. -f1 || echo "unknown")

SYSTEM ENVIRONMENT
------------------
Hostname: $HOSTNAME
Platform: $SYSTEM_INFO
Docker: $(docker --version 2>/dev/null || echo "not available")
User: $(whoami)
Working Directory: $(pwd)

UNIQUE FILENAME GENERATION
--------------------------
Pattern: {type}_{timestamp}_{git_short}_{uuid_prefix}.{ext}
Example: demo_${TIMESTAMP}_${GIT_COMMIT_SHORT}_${TEST_RUN_UUID:0:8}.txt

This ensures every test run generates uniquely identifiable files that can be
traced back to the exact code version, time, and test execution instance.
EOF

echo -e "${GREEN}✓${NC} Demo report generated successfully!"
echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "This demonstration shows how PR #24's installation tests track:"
echo -e "  • Unique test run UUID for each execution"
echo -e "  • Git commit ID and branch information"
echo -e "  • CRC checksums for file integrity verification"
echo -e "  • Timestamp with both human-readable and epoch formats"
echo -e "  • System environment details"
echo -e "  • Unique filename pattern preventing collisions"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"