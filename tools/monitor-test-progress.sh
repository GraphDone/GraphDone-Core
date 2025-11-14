#!/bin/bash

# GraphDone Test Progress Monitor
# Provides continuous status updates for long-running E2E tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
VM_NAME="${1:-graphdone-vm-silver-manatee-8197}"
UPDATE_INTERVAL="${2:-10}"  # Seconds between updates

# Helper functions
log_info() {
    echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} ✅ $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} ⚠️  $1"
}

log_error() {
    echo -e "${RED}[$(date +%H:%M:%S)]${NC} ❌ $1"
}

log_section() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${BLUE}$1${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Get VM status
get_vm_status() {
    multipass info "$VM_NAME" --format json 2>/dev/null | jq -r '.info[].state' 2>/dev/null || echo "Unknown"
}

# Check if tests are running
check_test_processes() {
    local playwright_count=$(multipass exec "$VM_NAME" -- bash -c 'pgrep -af "playwright" | wc -l' 2>/dev/null || echo "0")
    local npm_test_count=$(multipass exec "$VM_NAME" -- bash -c 'pgrep -af "npm.*test" | wc -l' 2>/dev/null || echo "0")
    local vitest_count=$(multipass exec "$VM_NAME" -- bash -c 'pgrep -af "vitest" | wc -l' 2>/dev/null || echo "0")

    echo "$playwright_count:$npm_test_count:$vitest_count"
}

# Get test output tail
get_test_output() {
    local log_file="$1"
    multipass exec "$VM_NAME" -- bash -c "tail -20 '$log_file' 2>/dev/null" || echo "No log file found"
}

# Parse Playwright progress
parse_playwright_progress() {
    local output="$1"

    # Look for "Running X tests using Y workers"
    local running=$(echo "$output" | grep -oP 'Running \K\d+(?= tests)' | tail -1)

    # Look for test completion indicators
    local passed=$(echo "$output" | grep -oP '\K\d+(?= passed)' | tail -1)
    local failed=$(echo "$output" | grep -oP '\K\d+(?= failed)' | tail -1)
    local skipped=$(echo "$output" | grep -oP '\K\d+(?= skipped)' | tail -1)

    echo "total:${running:-0}|passed:${passed:-0}|failed:${failed:-0}|skipped:${skipped:-0}"
}

# Parse Vitest progress
parse_vitest_progress() {
    local output="$1"

    # Look for "Test Files  X passed | Y failed | Z total"
    local passed=$(echo "$output" | grep -oP 'Test Files\s+\K\d+(?= passed)' | tail -1)
    local failed=$(echo "$output" | grep -oP '\K\d+(?= failed)' | tail -1)
    local total=$(echo "$output" | grep -oP '\K\d+(?= total)' | tail -1)

    echo "passed:${passed:-0}|failed:${failed:-0}|total:${total:-0}"
}

# Display process status
display_process_status() {
    local counts="$1"
    local playwright=$(echo "$counts" | cut -d: -f1)
    local npm=$(echo "$counts" | cut -d: -f2)
    local vitest=$(echo "$counts" | cut -d: -f3)

    if [ "$playwright" -gt 0 ]; then
        log_info "Playwright: ${GREEN}${playwright} processes running${NC}"
    fi

    if [ "$npm" -gt 0 ]; then
        log_info "npm test: ${GREEN}${npm} processes running${NC}"
    fi

    if [ "$vitest" -gt 0 ]; then
        log_info "Vitest: ${GREEN}${vitest} processes running${NC}"
    fi

    if [ "$playwright" -eq 0 ] && [ "$npm" -eq 0 ] && [ "$vitest" -eq 0 ]; then
        log_warning "No test processes detected"
        return 1
    fi

    return 0
}

# Main monitoring loop
monitor_tests() {
    log_section "GraphDone Test Progress Monitor"
    log_info "Monitoring VM: $VM_NAME"
    log_info "Update interval: ${UPDATE_INTERVAL}s"
    log_info "Press Ctrl+C to stop monitoring"
    echo ""

    local iteration=0
    local start_time=$(date +%s)

    while true; do
        ((iteration++))
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        local elapsed_min=$((elapsed / 60))
        local elapsed_sec=$((elapsed % 60))

        clear
        log_section "Test Progress Monitor - ${elapsed_min}m ${elapsed_sec}s elapsed"

        # Check VM status
        local vm_status=$(get_vm_status)
        if [ "$vm_status" != "Running" ]; then
            log_error "VM is not running (status: $vm_status)"
            exit 1
        fi
        log_success "VM Status: $vm_status"

        # Check test processes
        local process_counts=$(check_test_processes)
        echo ""
        if ! display_process_status "$process_counts"; then
            log_warning "Tests may have completed or not started"
            echo ""
            log_info "Checking for recent test output..."

            # Check for Playwright HTML report
            if multipass exec "$VM_NAME" -- bash -c 'test -f ~/graphdone/playwright-report/index.html' 2>/dev/null; then
                log_success "Playwright report available"
            fi

            # Check for recent test completions
            local last_log=$(multipass exec "$VM_NAME" -- bash -c 'ls -t /tmp/*.log 2>/dev/null | head -1' || echo "")
            if [ -n "$last_log" ]; then
                log_info "Latest log: $last_log"
            fi

            sleep $UPDATE_INTERVAL
            continue
        fi

        # Try to get test progress from various sources
        echo ""
        log_section "Test Progress Details"

        # Check npm test output
        local npm_output=$(multipass exec "$VM_NAME" -- bash -c 'ps aux | grep -E "npm.*test|vitest" | grep -v grep' 2>/dev/null || echo "")
        if [ -n "$npm_output" ]; then
            log_info "Active test commands:"
            echo "$npm_output" | while read -r line; do
                echo "  ${CYAN}→${NC} $(echo "$line" | awk '{for(i=11;i<=NF;i++) printf $i" "; print ""}')"
            done
        fi

        echo ""

        # Try to find and tail relevant log files
        log_info "Recent test output:"
        local found_output=false

        # Check for Playwright output
        if multipass exec "$VM_NAME" -- bash -c 'pgrep -af playwright' >/dev/null 2>&1; then
            local pw_output=$(multipass exec "$VM_NAME" -- bash -c 'ps aux | grep playwright | grep -v grep | head -5' 2>/dev/null)
            if [ -n "$pw_output" ]; then
                echo -e "${CYAN}Playwright processes:${NC}"
                echo "$pw_output" | sed 's/^/  /'
                found_output=true
            fi
        fi

        # Check graphdone working directory for test artifacts
        local test_files=$(multipass exec "$VM_NAME" -- bash -c 'ls -t ~/graphdone/test-results/*.xml 2>/dev/null | head -3' || echo "")
        if [ -n "$test_files" ]; then
            echo ""
            echo -e "${CYAN}Recent test result files:${NC}"
            echo "$test_files" | while read -r file; do
                local mtime=$(multipass exec "$VM_NAME" -- bash -c "stat -c %y '$file' 2>/dev/null" || echo "unknown")
                echo "  ${GREEN}→${NC} $(basename "$file") - $mtime"
            done
            found_output=true
        fi

        if ! $found_output; then
            echo -e "${YELLOW}No detailed progress available yet${NC}"
        fi

        # Footer
        echo ""
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}Next update in ${UPDATE_INTERVAL}s... (Iteration $iteration)${NC}"

        sleep $UPDATE_INTERVAL
    done
}

# Handle signals
trap 'echo ""; log_info "Monitoring stopped"; exit 0' SIGINT SIGTERM

# Run monitor
monitor_tests
