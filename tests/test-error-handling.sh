#!/bin/bash

# GraphDone Error Handler Test Suite
# Tests error detection and guidance for various Docker error types

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions (from start script)
log_info() {
    echo -e "${CYAN}$1${NC}"
}

log_warning() {
    echo -e "${YELLOW}$1${NC}"
}

log_error() {
    echo -e "${RED}$1${NC}"
}

# Extract the error handler function from start script
handle_docker_error() {
    local error_output="$1"
    local command="$2"

    echo ""
    log_error "╔════════════════════════════════════════════════════════════════╗"
    log_error "║                                                                ║"
    log_error "║                    ❌ Docker Error Detected ❌                  ║"
    log_error "║                                                                ║"
    log_error "╚════════════════════════════════════════════════════════════════╝"
    echo ""

    # Detect specific error types and provide targeted solutions
    # Check most specific patterns first, then more general ones
    if echo "$error_output" | grep -qi "Cannot connect to the Docker daemon\|docker.*not running\|Is the docker daemon running"; then
        log_warning "🔍 Issue: Docker is not running"
        echo ""
        echo "Docker daemon is not started."
        echo ""
        log_info "${BOLD}Solution:${NC}"
        echo "  • Start Docker Desktop"
        echo "  • Wait for it to fully start (check system tray)"
        echo "  • Then run: ${GREEN}./start${NC}"
        echo ""

    elif echo "$error_output" | grep -qi "ContainerConfig\|container.*config\|image.*config"; then
        log_warning "🔍 Issue: Corrupted container state detected"
        echo ""
        echo "This happens when Docker containers are in an inconsistent state."
        echo ""
        log_info "${BOLD}Quick Fix (Recommended):${NC}"
        echo "  ${GREEN}./start stop${NC}    # Stop all services"
        echo "  ${GREEN}./start${NC}         # Start fresh"
        echo ""
        log_info "${BOLD}If that doesn't work, try a complete cleanup:${NC}"
        echo "  ${GREEN}./start remove${NC}  # Remove all containers and data"
        echo "  ${GREEN}./start setup${NC}   # Fresh installation"
        echo ""

    elif echo "$error_output" | grep -qi "permission denied\|Got permission denied"; then
        log_warning "🔍 Issue: Docker permission problem"
        echo ""
        echo "Docker requires proper permissions to run."
        echo ""
        log_info "${BOLD}Solution:${NC}"
        echo "  ${GREEN}./scripts/setup_docker.sh${NC}  # Fix Docker permissions"
        echo "  Then restart your terminal and run: ${GREEN}./start${NC}"
        echo ""

    elif echo "$error_output" | grep -qi "no such container\|container.*not found"; then
        log_warning "🔍 Issue: Container not found"
        echo ""
        echo "Expected containers are missing."
        echo ""
        log_info "${BOLD}Solution:${NC}"
        echo "  ${GREEN}./start stop${NC}    # Clean up"
        echo "  ${GREEN}./start${NC}         # Recreate containers"
        echo ""

    elif echo "$error_output" | grep -qi "port.*already allocated\|address already in use"; then
        log_warning "🔍 Issue: Port conflict detected"
        echo ""
        echo "Another service is using GraphDone's ports (3127, 3128, 4127, 4128, 7474, 7687)."
        echo ""
        log_info "${BOLD}Solution:${NC}"
        echo "  ${GREEN}./start stop${NC}                    # Stop GraphDone services"
        echo "  ${GREEN}lsof -ti:3127 | xargs kill -9${NC}  # Kill specific port (example)"
        echo ""

    elif echo "$error_output" | grep -qi "no space left\|disk.*full"; then
        log_warning "🔍 Issue: Disk space problem"
        echo ""
        echo "Not enough disk space for Docker operations."
        echo ""
        log_info "${BOLD}Solution:${NC}"
        echo "  ${GREEN}docker system prune -a${NC}  # Clean up Docker resources"
        echo "  Then run: ${GREEN}./start${NC}"
        echo ""

    elif echo "$error_output" | grep -qi "network.*not found\|network.*error"; then
        log_warning "🔍 Issue: Docker network problem"
        echo ""
        echo "Docker network configuration is corrupted."
        echo ""
        log_info "${BOLD}Solution:${NC}"
        echo "  ${GREEN}./start stop${NC}    # Stop services"
        echo "  ${GREEN}docker network prune${NC}  # Clean up networks"
        echo "  ${GREEN}./start${NC}         # Restart"
        echo ""

    elif echo "$error_output" | grep -qi "timeout\|timed out"; then
        log_warning "🔍 Issue: Docker operation timeout"
        echo ""
        echo "Docker operations are taking too long (usually means Docker Desktop is slow)."
        echo ""
        log_info "${BOLD}Solution:${NC}"
        echo "  1. Restart Docker Desktop"
        echo "  2. Wait 30 seconds for Docker to fully start"
        echo "  3. Try again: ${GREEN}./start${NC}"
        echo ""

    else
        log_warning "🔍 Issue: Unknown Docker error"
        echo ""
        echo "An unexpected Docker error occurred."
        echo ""
        log_info "${BOLD}General Solutions (try in order):${NC}"
        echo "  1. ${GREEN}./start stop${NC}     # Stop services"
        echo "  2. ${GREEN}./start${NC}          # Restart"
        echo "  3. ${GREEN}./start remove${NC}   # Complete cleanup"
        echo "  4. ${GREEN}./start setup${NC}    # Fresh installation"
        echo ""
    fi

    log_info "${BOLD}Error Details:${NC}"
    echo "$error_output" | head -20
    echo ""

    return 1
}

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║           GraphDone Error Handler Test Suite                  ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Test function
test_error_handler() {
    local test_name="$1"
    local error_input="$2"
    local expected_pattern="$3"

    echo -e "${CYAN}Testing: ${test_name}${NC}"

    # Capture output
    local output
    output=$(handle_docker_error "$error_input" "test" 2>&1 || true)

    # Check if expected pattern is found
    if echo "$output" | grep -qi "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS${NC} - Found expected pattern: '$expected_pattern'"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Expected pattern not found: '$expected_pattern'"
        echo "Output was:"
        echo "$output" | head -10
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test 1: ContainerConfig Error
test_error_handler \
    "ContainerConfig Error" \
    "KeyError: 'ContainerConfig'
File \"/usr/lib/python3/dist-packages/compose/service.py\", line 330
container.image_config['ContainerConfig'].get('Volumes')" \
    "Corrupted container state"

# Test 2: Network Error
test_error_handler \
    "Network Error" \
    "ERROR: Network graphdone_default not found
network error occurred during startup" \
    "Docker network problem"

# Test 3: Permission Denied
test_error_handler \
    "Permission Denied Error" \
    "Got permission denied while trying to connect to the Docker daemon socket
ERROR: Couldn't connect to Docker daemon" \
    "Docker permission problem"

# Test 4: Port Already Allocated
test_error_handler \
    "Port Conflict Error" \
    "ERROR: for graphdone-api  Cannot start service: driver failed
Bind for 0.0.0.0:4127 failed: port is already allocated" \
    "Port conflict detected"

# Test 5: Disk Space Error
test_error_handler \
    "Disk Space Error" \
    "ERROR: no space left on device
disk is full, cannot create container" \
    "Disk space problem"

# Test 6: Timeout Error
test_error_handler \
    "Timeout Error" \
    "ERROR: Connection timeout
operation timed out after 60 seconds" \
    "Docker operation timeout"

# Test 7: Docker Not Running
test_error_handler \
    "Docker Not Running Error" \
    "ERROR: Cannot connect to the Docker daemon at unix:///var/run/docker.sock
Is the docker daemon running?" \
    "Docker is not running"

# Test 8: Container Not Found
test_error_handler \
    "Container Not Found Error" \
    "ERROR: No such container: graphdone-neo4j
container not found in Docker" \
    "Container not found"

# Test 9: Unknown Error (Fallback)
test_error_handler \
    "Unknown Error Fallback" \
    "ERROR: Something completely unexpected happened
This is a totally random error message" \
    "Unknown Docker error"

# Test 10: Image Config Error
test_error_handler \
    "Image Config Error" \
    "ERROR: image config is corrupted
container image config has invalid data" \
    "Corrupted container state"

# Print summary
echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}                        Test Summary                            ${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "  ${RED}Failed: ${TESTS_FAILED}${NC}"
echo -e "  ${CYAN}Total:  $((TESTS_PASSED + TESTS_FAILED))${NC}"
echo ""

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ All tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}${BOLD}❌ Some tests failed!${NC}"
    echo ""
    exit 1
fi
