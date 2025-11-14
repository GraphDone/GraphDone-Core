#!/bin/bash

# Security testing script for certificate generation
# Tests various attack vectors, edge cases, and failure modes

set -e

CERT_SCRIPT="../scripts/generate-multi-host-certs.sh"
TEST_DIR="./test-certs-security"

echo "🔒 SECURITY TESTING: Certificate Generation"
echo "=========================================="
echo "Testing script: $CERT_SCRIPT"
echo ""

# Clean up previous tests
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"  # "pass" or "fail"
    
    ((test_count++))
    echo -e "\n📋 Test $test_count: $test_name"
    echo "   Command: $test_command"
    echo "   Expected: $expected_result"
    
    # Clean up before each test
    rm -rf certs/ *.pem *.conf 2>/dev/null || true
    
    if eval "$test_command" >/dev/null 2>&1; then
        if [[ "$expected_result" == "pass" ]]; then
            echo -e "   Result: ${GREEN}✅ PASS${NC}"
            ((pass_count++))
        else
            echo -e "   Result: ${RED}❌ FAIL - Expected failure but command succeeded${NC}"
            ((fail_count++))
        fi
    else
        if [[ "$expected_result" == "fail" ]]; then
            echo -e "   Result: ${GREEN}✅ PASS - Failed as expected${NC}"
            ((pass_count++))
        else
            echo -e "   Result: ${RED}❌ FAIL - Expected success but command failed${NC}"
            ((fail_count++))
        fi
    fi
}

verify_certificate_security() {
    local cert_file="$1"
    local expected_hosts="$2"
    
    if [[ ! -f "$cert_file" ]]; then
        echo "   Certificate file not found: $cert_file"
        return 1
    fi
    
    # Check certificate validity
    if ! openssl x509 -in "$cert_file" -noout 2>/dev/null; then
        echo "   Invalid certificate format"
        return 1
    fi
    
    # Check SAN entries
    local san_entries
    san_entries=$(openssl x509 -in "$cert_file" -text -noout | grep -A 10 "Subject Alternative Name" | tail -n +2 | head -n 10)
    
    echo "   SAN entries found: $san_entries"
    
    # Verify no dangerous entries
    if echo "$san_entries" | grep -q "0\.0\.0\.0\|127\.0\.0\.0\|255\.255\.255\.255"; then
        echo "   ⚠️  Potentially dangerous IP ranges found"
        return 1
    fi
    
    return 0
}

echo "🧪 Starting security tests..."

# Test 1: Basic functionality
run_test "Basic localhost certificate" \
    "$CERT_SCRIPT -h 'localhost,127.0.0.1'" \
    "pass"

if [[ -f "certs/graphdone-cert.pem" ]]; then
    verify_certificate_security "certs/graphdone-cert.pem" "localhost,127.0.0.1"
fi

# Test 2: Injection attempts
run_test "Command injection attempt in hostname" \
    "$CERT_SCRIPT -h 'localhost;rm -rf /tmp/test'" \
    "fail"

run_test "Command injection with backticks" \
    "$CERT_SCRIPT -h 'localhost\`whoami\`'" \
    "fail"

run_test "Command injection with dollar sign" \
    "$CERT_SCRIPT -h 'localhost\$(whoami)'" \
    "fail"

# Test 3: Path traversal attempts
run_test "Path traversal in certificate name" \
    "$CERT_SCRIPT -n '../../../etc/passwd'" \
    "fail"

run_test "Path traversal with null bytes" \
    "$CERT_SCRIPT -n 'test\x00../../../etc/passwd'" \
    "fail"

# Test 4: Extremely long inputs
run_test "Extremely long hostname (buffer overflow test)" \
    "$CERT_SCRIPT -h '$(python3 -c \"print('a' * 10000)\")'" \
    "fail"

run_test "Extremely long certificate name" \
    "$CERT_SCRIPT -n '$(python3 -c \"print('a' * 1000)\")'" \
    "fail"

# Test 5: Invalid characters
run_test "Special characters in hostname" \
    "$CERT_SCRIPT -h 'localhost,host@name,host#name'" \
    "fail"

run_test "Unicode characters in hostname" \
    "$CERT_SCRIPT -h 'localhost,测试.com'" \
    "pass"  # This should actually work

# Test 6: Wildcard abuse
run_test "Wildcard certificate for entire TLD" \
    "$CERT_SCRIPT -h '*.com'" \
    "pass"  # Technically valid but dangerous

run_test "Multiple wildcards" \
    "$CERT_SCRIPT -h '*.*.example.com'" \
    "pass"  # OpenSSL should handle this

# Test 7: IP address validation
run_test "Invalid IP address format" \
    "$CERT_SCRIPT -h 'localhost,999.999.999.999'" \
    "pass"  # Script doesn't validate, OpenSSL might accept

run_test "IPv6 address" \
    "$CERT_SCRIPT -h 'localhost,::1,2001:db8::1'" \
    "pass"

# Test 8: Empty and null inputs
run_test "Empty hostname list" \
    "$CERT_SCRIPT -h ''" \
    "fail"

run_test "Null hostname argument" \
    "$CERT_SCRIPT -h" \
    "fail"

run_test "Only commas" \
    "$CERT_SCRIPT -h ',,,'" \
    "fail"

# Test 9: File system attacks
run_test "Certificate name with directory separator" \
    "$CERT_SCRIPT -n 'subdir/cert'" \
    "pass"  # Should create subdirectory

run_test "Write to system directories" \
    "CERT_DIR=/etc $CERT_SCRIPT" \
    "fail"

# Test 10: Resource exhaustion
run_test "Many hosts (DoS test)" \
    "$CERT_SCRIPT -h '$(python3 -c \"print(','.join([f'host{i}.com' for i in range(1000)]))\")'" \
    "fail"

# Test 11: Real-world scenarios
run_test "Tailscale hostname" \
    "$CERT_SCRIPT -h 'localhost,my-server.ts.net,127.0.0.1'" \
    "pass"

run_test "Production domain with subdomains" \
    "$CERT_SCRIPT -h 'graphdone.com,*.graphdone.com,api.graphdone.com'" \
    "pass"

run_test "Mixed IP and domain names" \
    "$CERT_SCRIPT -h 'localhost,192.168.1.100,example.com,10.0.0.50'" \
    "pass"

echo ""
echo "🔍 CERTIFICATE VALIDATION TESTS"
echo "================================"

# Test certificates that were created successfully
for cert_file in certs/*-cert.pem 2>/dev/null; do
    if [[ -f "$cert_file" ]]; then
        echo ""
        echo "Analyzing: $cert_file"
        
        # Check certificate structure
        echo "Certificate info:"
        openssl x509 -in "$cert_file" -text -noout | grep -E "(Subject|Issuer|Not Before|Not After|Subject Alternative Name)" || echo "   Failed to parse certificate"
        
        # Check for weak keys
        key_file="${cert_file/-cert.pem/-key.pem}"
        if [[ -f "$key_file" ]]; then
            key_size=$(openssl rsa -in "$key_file" -text -noout 2>/dev/null | grep "Private-Key:" | grep -o "[0-9]\+" || echo "unknown")
            if [[ "$key_size" -lt 2048 ]]; then
                echo -e "   ${RED}⚠️  WEAK KEY: Only $key_size bits${NC}"
            else
                echo -e "   ${GREEN}✅ Strong key: $key_size bits${NC}"
            fi
        fi
    fi
done

echo ""
echo "📊 TEST SUMMARY"
echo "==============="
echo "Total tests: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"

if [[ $fail_count -gt 0 ]]; then
    echo -e "\n${RED}⚠️  SECURITY ISSUES FOUND!${NC}"
    echo "Review failed tests and fix security vulnerabilities."
    exit 1
else
    echo -e "\n${GREEN}✅ All security tests passed!${NC}"
    echo "Certificate generation script appears secure for intended use cases."
fi

# Clean up
cd ..
rm -rf "$TEST_DIR"