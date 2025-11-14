#!/bin/bash
# Create a base GraphDone VM image for faster E2E testing

set -e

BRANCH="${1:-main}"
BASE_NAME="graphdone-base-${BRANCH}"
SNAPSHOT_NAME="graphdone-snapshot-${BRANCH}"

echo "=== Creating base image for branch: $BRANCH ==="

# Launch VM without Tailscale, without auto-start
./tools/multipass.sh launch \
  --name "$BASE_NAME" \
  --branch "$BRANCH" \
  --no-tailscale \
  --no-run-on-boot

echo "Waiting for setup to complete..."
sleep 60

# Verify setup
multipass exec "$BASE_NAME" -- bash -c 'cd ~/graphdone && node --version && npm --version'

# Stop the VM cleanly
echo "Stopping VM for snapshot..."
multipass stop "$BASE_NAME"

# Create snapshot (if multipass supports it)
# Note: Multipass doesn't have native snapshots, but we can use stop/start as a cache
echo "Base image ready: $BASE_NAME"
echo "To use: multipass start $BASE_NAME && multipass exec $BASE_NAME ..."

# Alternative: Export to image
# multipass list --format json # Check if we can export

echo "=== Base image creation complete ==="
echo "VM Name: $BASE_NAME"
echo "Branch: $BRANCH"
