#!/bin/bash

# GraphDone Test Timing Analyzer
# Analyzes test report logs and generates detailed timing breakdowns

set -e

REPORT_FILE="$1"

if [ -z "$REPORT_FILE" ] || [ ! -f "$REPORT_FILE" ]; then
    echo "Usage: $0 <test-report-file>"
    exit 1
fi

echo "# Test Timing Analysis"
echo ""
echo "Analyzing: $REPORT_FILE"
echo ""

# Extract timestamps from log files
REPORT_DIR=$(dirname "$REPORT_FILE")

declare -A STEP_TIMES

# Parse build log for duration
if [ -f "$REPORT_DIR/build.log" ]; then
    BUILD_TIME=$(grep -oP 'Done in \K[\d.]+s' "$REPORT_DIR/build.log" | tail -1 || echo "N/A")
    echo "Build Duration: $BUILD_TIME"
fi

# Parse unit test log for duration
if [ -f "$REPORT_DIR/unit-tests.log" ]; then
    TEST_TIME=$(grep -oP 'Test Files.*\(\K[\d.]+s' "$REPORT_DIR/unit-tests.log" | tail -1 || echo "N/A")
    echo "Unit Tests Duration: $TEST_TIME"
fi

# Parse E2E test log for duration
if [ -f "$REPORT_DIR/e2e-tests.log" ]; then
    E2E_TIME=$(grep -oP '\d+ passed.*\(\K[\d.]+s' "$REPORT_DIR/e2e-tests.log" | tail -1 || echo "N/A")
    echo "E2E Tests Duration: $E2E_TIME"
fi

# Parse visual regression log for duration
if [ -f "$REPORT_DIR/visual-regression.log" ]; then
    VR_TIME=$(grep -oP '\d+ passed.*\(\K[\d.]+s' "$REPORT_DIR/visual-regression.log" | tail -1 || echo "N/A")
    echo "Visual Regression Duration: $VR_TIME"
fi

echo ""
echo "## Detailed Breakdown"
echo ""

# Analyze file modification times to estimate step durations
cd "$REPORT_DIR"

if [ -f "vm-launch.log" ]; then
    VM_LAUNCH_START=$(stat -c %Y vm-launch.log 2>/dev/null || echo "0")
fi

if [ -f "cloud-init.log" ]; then
    CLOUD_INIT_START=$(stat -c %Y cloud-init.log 2>/dev/null || echo "0")
fi

if [ -f "lint.log" ]; then
    LINT_START=$(stat -c %Y lint.log 2>/dev/null || echo "0")
fi

if [ -f "typecheck.log" ]; then
    TYPECHECK_START=$(stat -c %Y typecheck.log 2>/dev/null || echo "0")
fi

if [ -f "build.log" ]; then
    BUILD_START=$(stat -c %Y build.log 2>/dev/null || echo "0")
fi

if [ -f "unit-tests.log" ]; then
    UNIT_START=$(stat -c %Y unit-tests.log 2>/dev/null || echo "0")
fi

if [ -f "e2e-tests.log" ]; then
    E2E_START=$(stat -c %Y e2e-tests.log 2>/dev/null || echo "0")
fi

# Calculate durations from file timestamps
if [ "$VM_LAUNCH_START" != "0" ] && [ "$CLOUD_INIT_START" != "0" ]; then
    LAUNCH_DURATION=$((CLOUD_INIT_START - VM_LAUNCH_START))
    echo "VM Launch: ${LAUNCH_DURATION}s"
fi

if [ "$LINT_START" != "0" ] && [ "$TYPECHECK_START" != "0" ]; then
    LINT_DURATION=$((TYPECHECK_START - LINT_START))
    echo "Linting: ${LINT_DURATION}s"
fi

if [ "$TYPECHECK_START" != "0" ] && [ "$BUILD_START" != "0" ]; then
    TYPECHECK_DURATION=$((BUILD_START - TYPECHECK_START))
    echo "Type Checking: ${TYPECHECK_DURATION}s"
fi

if [ "$BUILD_START" != "0" ] && [ "$UNIT_START" != "0" ]; then
    BUILD_DURATION=$((UNIT_START - BUILD_START))
    echo "Build: ${BUILD_DURATION}s"
fi

if [ "$UNIT_START" != "0" ] && [ "$E2E_START" != "0" ]; then
    UNIT_DURATION=$((E2E_START - UNIT_START))
    echo "Unit Tests: ${UNIT_DURATION}s"
fi

echo ""
echo "## Recommendations"
echo ""

# Add intelligent recommendations based on timing
if [ "$BUILD_DURATION" -gt 180 ] 2>/dev/null; then
    echo "- Build took >${BUILD_DURATION}s: Consider build caching or Turbo optimization"
fi

if [ "$UNIT_DURATION" -gt 300 ] 2>/dev/null; then
    echo "- Unit tests took >${UNIT_DURATION}s: Consider test parallelization or filtering"
fi

if [ -n "$E2E_TIME" ] && [ "$E2E_TIME" != "N/A" ]; then
    E2E_SECONDS=$(echo "$E2E_TIME" | sed 's/s//')
    if [ "$(echo "$E2E_SECONDS > 900" | bc)" -eq 1 ] 2>/dev/null; then
        echo "- E2E tests took >${E2E_SECONDS}s (15+ min): Consider parallelization or reducing scope"
    fi
fi
