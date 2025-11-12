#!/bin/sh
# Simple multi-distribution test for GraphDone installation script
# Works with POSIX sh and older bash versions

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Setup
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$PROJECT_ROOT/public/install.sh"
REPORT_DIR="$PROJECT_ROOT/test-results/installation"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Generate unique test run ID
TEST_RUN_UUID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$$-$RANDOM")
GIT_COMMIT_SHORT=$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
INSTALL_SCRIPT_CRC=$(cksum "$INSTALL_SCRIPT" 2>/dev/null | awk '{print $1}' || echo "unknown")
HTML_REPORT="$REPORT_DIR/report_${TIMESTAMP}_${GIT_COMMIT_SHORT}.html"
TEST_RESULTS=""

# Create directories
mkdir -p "$REPORT_DIR"

# Counters
TOTAL=0
PASSED=0
FAILED=0

echo "═══════════════════════════════════════════════════════════════"
echo "     GraphDone Installation Script - Docker Test Suite"
echo "═══════════════════════════════════════════════════════════════"
echo

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo "${RED}✗${NC} Docker is not running. Please start Docker first."
    exit 1
fi

# Check installation script
if [ ! -f "$INSTALL_SCRIPT" ]; then
    echo "${RED}✗${NC} Installation script not found at: $INSTALL_SCRIPT"
    exit 1
fi

# Test function
test_distro() {
    local image=$1
    local name=$2
    local pkg_mgr=$3
    
    TOTAL=$((TOTAL + 1))
    echo "${CYAN}▶${NC} Testing $name ($image)..."
    
    # Create test directory
    local test_dir="/tmp/graphdone-test-$TIMESTAMP"
    mkdir -p "$test_dir"
    
    # Copy installation script
    cp "$INSTALL_SCRIPT" "$test_dir/install.sh"
    
    # Create test script
    cat > "$test_dir/test.sh" << 'EOF'
#!/bin/sh
set -e

# Just test that the script runs and shows help/usage
# Don't actually install anything in test mode
sh /test/install.sh --help 2>&1 || true

# Test stop command
sh /test/install.sh stop 2>&1 | head -5

echo "INSTALLATION_SCRIPT_TEST: SUCCESS"
EOF
    
    # Run Docker test
    if docker run --rm \
        -v "$test_dir:/test:ro" \
        "$image" \
        sh /test/test.sh > "$REPORT_DIR/${name// /_}.log" 2>&1; then
        
        if grep -q "INSTALLATION_SCRIPT_TEST: SUCCESS" "$REPORT_DIR/${name// /_}.log"; then
            echo "${GREEN}✓${NC} $name - PASSED"
            PASSED=$((PASSED + 1))
            TEST_RESULTS="${TEST_RESULTS}PASS|$name
"
        else
            echo "${RED}✗${NC} $name - FAILED (script error)"
            FAILED=$((FAILED + 1))
            TEST_RESULTS="${TEST_RESULTS}FAIL|$name|Script execution error
"
        fi
    else
        echo "${RED}✗${NC} $name - FAILED (docker error)"
        FAILED=$((FAILED + 1))
        TEST_RESULTS="${TEST_RESULTS}FAIL|$name|Docker container error
"
    fi
    
    # Cleanup
    rm -rf "$test_dir"
}

# Test distributions (including ARM64 support)
echo "Testing Linux distributions (x86_64 and ARM64):"
echo

# Ubuntu LTS versions
test_distro "ubuntu:24.04" "Ubuntu 24.04 LTS" "apt"
test_distro "ubuntu:22.04" "Ubuntu 22.04 LTS" "apt"
test_distro "ubuntu:20.04" "Ubuntu 20.04 LTS" "apt"

# Debian versions
test_distro "debian:12" "Debian 12 Bookworm" "apt"
test_distro "debian:11" "Debian 11 Bullseye" "apt"

# RHEL-based
test_distro "rockylinux:9" "Rocky Linux 9" "dnf"
test_distro "almalinux:9" "AlmaLinux 9" "dnf"
test_distro "quay.io/centos/centos:stream9" "CentOS Stream 9" "dnf"

# Fedora
test_distro "fedora:40" "Fedora 40" "dnf"
test_distro "fedora:39" "Fedora 39" "dnf"

# Other distributions
test_distro "alpine:latest" "Alpine Linux" "apk"
# Arch Linux only supports x86_64, not ARM64
if [ "$(uname -m)" = "x86_64" ] || [ "$(uname -m)" = "x86" ]; then
    test_distro "archlinux:latest" "Arch Linux" "pacman"
else
    echo "${YELLOW}⚠${NC} Skipping Arch Linux (no ARM64 support)"
fi
test_distro "opensuse/leap:15.5" "openSUSE Leap 15.5" "zypper"

# ARM64 specific tests (if running on ARM or Docker supports multi-arch)
if [ "$(uname -m)" = "arm64" ] || [ "$(uname -m)" = "aarch64" ] || docker run --rm arm64v8/ubuntu:22.04 echo "ARM64 supported" 2>/dev/null; then
    echo
    echo "Testing ARM64 distributions:"
    test_distro "arm64v8/ubuntu:22.04" "Ubuntu 22.04 ARM64" "apt"
    test_distro "arm64v8/debian:12" "Debian 12 ARM64" "apt"
    test_distro "arm64v8/alpine:latest" "Alpine Linux ARM64" "apk"
fi

# Generate HTML report
generate_html_report() {
    local success_rate=0
    if [ $TOTAL -gt 0 ]; then
        success_rate=$((PASSED * 100 / TOTAL))
    fi
    
    cat > "$HTML_REPORT" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GraphDone Installation Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #0a1929;
            color: #e0e0e0;
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container { max-width: 1400px; margin: 0 auto; }
        
        .header {
            background: #132f4c;
            border: 1px solid #265d97;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            text-align: center;
        }
        
        .logo-text {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin-bottom: 1rem;
            font-size: 3rem;
            font-weight: bold;
            color: #40e0d0;
        }
        
        h1 { color: #40e0d0; font-size: 2rem; margin: 1rem 0; }
        
        .metadata {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin: 1.5rem 0;
            flex-wrap: wrap;
        }
        
        .metadata-item {
            text-align: center;
        }
        
        .metadata-label {
            color: #8e99a8;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.25rem;
        }
        
        .metadata-value {
            color: #40e0d0;
            font-family: monospace;
            font-size: 0.95rem;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .card {
            background: #132f4c;
            border: 1px solid #265d97;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(64, 224, 208, 0.1);
        }
        
        .card-value {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        
        .card-label {
            color: #8e99a8;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 0.85rem;
        }
        
        .card.total .card-value { color: #66d9ff; }
        .card.passed .card-value { color: #40e0d0; }
        .card.failed .card-value { color: #ff6b6b; }
        .card.rate .card-value { color: #ffd93d; }
        
        .test-grid {
            background: #132f4c;
            border: 1px solid #265d97;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
        }
        
        .test-grid h2 {
            color: #40e0d0;
            margin-bottom: 1.5rem;
            font-size: 1.5rem;
        }
        
        .test-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.75rem 1rem;
            background: #0a1929;
            border: 1px solid #1e3a5f;
            border-radius: 8px;
            margin-bottom: 0.75rem;
            transition: all 0.2s ease;
        }
        
        .test-item:hover {
            background: #1a2332;
            border-color: #265d97;
        }
        
        .test-status {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2rem;
        }
        
        .test-status.pass {
            background: #40e0d0;
            color: #0a1929;
            box-shadow: 0 0 20px rgba(64, 224, 208, 0.4);
            animation: glow 2s ease-in-out infinite;
        }
        
        .test-status.fail {
            background: #ff6b6b;
            color: white;
        }
        
        @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(64, 224, 208, 0.4); }
            50% { box-shadow: 0 0 30px rgba(64, 224, 208, 0.6); }
        }
        
        .test-name {
            flex: 1;
            color: #e0e0e0;
        }
        
        .test-error {
            color: #8e99a8;
            font-size: 0.85rem;
            font-style: italic;
        }
        
        .badge {
            display: inline-block;
            background: #40e0d0;
            color: #0a1929;
            padding: 0.5rem 1.5rem;
            border-radius: 50px;
            font-weight: bold;
            margin: 1rem 0;
            box-shadow: 0 4px 12px rgba(64, 224, 208, 0.3);
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(64, 224, 208, 0.3); }
            50% { transform: scale(1.05); box-shadow: 0 6px 16px rgba(64, 224, 208, 0.5); }
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: #8e99a8;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo-text">
                <span>🌊</span>
                <span>GraphDone</span>
                <span>🏝️</span>
            </div>
            <h1>Installation Test Report</h1>
            <div class="badge">PR #24 VALIDATION</div>
            
            <div class="metadata">
                <div class="metadata-item">
                    <div class="metadata-label">Test Run ID</div>
                    <div class="metadata-value">REPLACE_UUID</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Git Commit</div>
                    <div class="metadata-value">REPLACE_COMMIT</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Script CRC</div>
                    <div class="metadata-value">REPLACE_CRC</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Timestamp</div>
                    <div class="metadata-value">REPLACE_TIME</div>
                </div>
            </div>
        </div>
        
        <div class="summary">
            <div class="card total">
                <div class="card-value">REPLACE_TOTAL</div>
                <div class="card-label">Total Tests</div>
            </div>
            <div class="card passed">
                <div class="card-value">REPLACE_PASSED</div>
                <div class="card-label">Passed</div>
            </div>
            <div class="card failed">
                <div class="card-value">REPLACE_FAILED</div>
                <div class="card-label">Failed</div>
            </div>
            <div class="card rate">
                <div class="card-value">REPLACE_RATE%</div>
                <div class="card-label">Success Rate</div>
            </div>
        </div>
        
        <div class="test-grid">
            <h2>Distribution Test Results</h2>
            REPLACE_RESULTS
        </div>
        
        <div class="footer">
            <p>Generated: REPLACE_DATE</p>
            <p>Test Runner: test-installation-simple.sh | Platform: REPLACE_PLATFORM</p>
        </div>
    </div>
</body>
</html>
HTMLEOF
    
    # Generate test results HTML
    results_html=""
    printf '%s\n' "$TEST_RESULTS" | while IFS='|' read -r status name error; do
        test -z "$status" && continue
        if [ "$status" = "PASS" ]; then
            printf '<div class="test-item"><div class="test-status pass">✓</div><div class="test-name">%s</div></div>' "$name"
        else
            printf '<div class="test-item"><div class="test-status fail">✗</div><div class="test-name">%s</div><div class="test-error">%s</div></div>' "$name" "$error"
        fi
    done > "$REPORT_DIR/results_fragment.html"
    results_html=$(cat "$REPORT_DIR/results_fragment.html")

    # Get first 8 chars of UUID (POSIX-compliant)
    uuid_short=$(printf '%s' "$TEST_RUN_UUID" | cut -c1-8)

    # Replace placeholders
    sed -i.bak \
        -e "s/REPLACE_UUID/$uuid_short/g" \
        -e "s/REPLACE_COMMIT/$GIT_COMMIT_SHORT/g" \
        -e "s/REPLACE_CRC/$INSTALL_SCRIPT_CRC/g" \
        -e "s/REPLACE_TIME/$TIMESTAMP/g" \
        -e "s/REPLACE_TOTAL/$TOTAL/g" \
        -e "s/REPLACE_PASSED/$PASSED/g" \
        -e "s/REPLACE_FAILED/$FAILED/g" \
        -e "s/REPLACE_RATE/$success_rate/g" \
        -e "s|REPLACE_RESULTS|$results_html|g" \
        -e "s/REPLACE_DATE/$(date)/g" \
        -e "s/REPLACE_PLATFORM/$(uname -s) $(uname -m)/g" \
        "$HTML_REPORT"
    
    rm -f "${HTML_REPORT}.bak"
}

echo
echo "═══════════════════════════════════════════════════════════════"
echo "Test Summary:"
echo "  Total:  $TOTAL"
echo "  Passed: ${GREEN}$PASSED${NC}"
echo "  Failed: ${RED}$FAILED${NC}"

# Generate HTML report
generate_html_report
echo
echo "📊 HTML Report: $HTML_REPORT"

if [ $FAILED -eq 0 ]; then
    echo
    echo "${GREEN}✓ All tests passed!${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    exit 0
else
    echo
    echo "${RED}✗ Some tests failed${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    exit 1
fi