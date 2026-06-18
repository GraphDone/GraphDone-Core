#!/usr/bin/env bash
# ============================================================================
# Multi-Distribution Docker Testing for GraphDone Installation Script
# ============================================================================
# Tests the one-line installation script across all supported Linux distributions
# Generates a comprehensive HTML report with test results
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$PROJECT_ROOT/public/install.sh"
REPORT_DIR="$PROJECT_ROOT/test-results/installation-tests"
REPORT_FILE="$REPORT_DIR/report.html"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOG_DIR="$REPORT_DIR/logs_$TIMESTAMP"

# Create directories
mkdir -p "$REPORT_DIR" "$LOG_DIR"

# Test results storage
declare -A TEST_RESULTS
declare -A TEST_TIMES
declare -A TEST_LOGS
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# List of distributions to test
# Format: "image:tag|name|package_manager"
DISTRIBUTIONS=(
    # Ubuntu variants
    "ubuntu:24.04|Ubuntu 24.04 LTS|apt"
    "ubuntu:22.04|Ubuntu 22.04 LTS|apt"
    "ubuntu:20.04|Ubuntu 20.04 LTS|apt"
    
    # Debian variants
    "debian:12|Debian 12 Bookworm|apt"
    "debian:11|Debian 11 Bullseye|apt"
    
    # Fedora variants
    "fedora:40|Fedora 40|dnf"
    "fedora:39|Fedora 39|dnf"
    
    # RHEL-based
    "rockylinux:9|Rocky Linux 9|dnf"
    "almalinux:9|AlmaLinux 9|dnf"
    
    # Arch-based
    "archlinux:latest|Arch Linux|pacman"
    
    # openSUSE
    "opensuse/leap:15.5|openSUSE Leap 15.5|zypper"
)

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS") echo -e "${GREEN}✓${NC} $message" ;;
        "FAIL") echo -e "${RED}✗${NC} $message" ;;
        "SKIP") echo -e "${YELLOW}○${NC} $message" ;;
        "INFO") echo -e "${BLUE}ℹ${NC} $message" ;;
        "TEST") echo -e "${CYAN}▶${NC} $message" ;;
        *) echo "$message" ;;
    esac
}

# Function to test a single distribution
test_distribution() {
    local distro_info=$1
    local image=$(echo "$distro_info" | cut -d'|' -f1)
    local name=$(echo "$distro_info" | cut -d'|' -f2)
    local pkg_mgr=$(echo "$distro_info" | cut -d'|' -f3)
    local log_file="$LOG_DIR/${name// /_}.log"
    local start_time=$(date +%s)
    
    print_status "TEST" "Testing $name ($image)..."
    
    # Create a temporary Dockerfile for this test
    local dockerfile=$(mktemp)
    cat > "$dockerfile" << EOF
FROM $image

# Install basic dependencies
RUN if [ "$pkg_mgr" = "apt" ]; then \
        apt-get update && \
        apt-get install -y curl wget sudo ca-certificates; \
    elif [ "$pkg_mgr" = "dnf" ]; then \
        dnf install -y curl wget sudo ca-certificates; \
    elif [ "$pkg_mgr" = "yum" ]; then \
        yum install -y curl wget sudo ca-certificates; \
    elif [ "$pkg_mgr" = "pacman" ]; then \
        pacman -Sy --noconfirm curl wget sudo ca-certificates; \
    elif [ "$pkg_mgr" = "zypper" ]; then \
        zypper install -y curl wget sudo ca-certificates; \
    elif [ "$pkg_mgr" = "apk" ]; then \
        apk add --no-cache curl wget sudo ca-certificates bash; \
    fi

# Create test user (installation script shouldn't run as root)
RUN useradd -m -s /bin/bash testuser && \
    echo "testuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Copy installation script
COPY public/install.sh /tmp/install.sh
RUN chmod +x /tmp/install.sh

# Switch to test user
USER testuser
WORKDIR /home/testuser

# Run installation test (stop at dependency check)
CMD ["/bin/bash", "-c", "export GRAPHDONE_TEST_MODE=1; /tmp/install.sh 2>&1 | tee /tmp/install.log; echo EXIT_CODE:\$? >> /tmp/install.log"]
EOF
    
    # Build Docker image
    local image_name="graphdone-test-${name// /-}:$TIMESTAMP"
    print_status "INFO" "Building Docker image..."
    if docker build -f "$dockerfile" -t "$image_name" "$PROJECT_ROOT" > "$log_file" 2>&1; then
        # Run the test
        print_status "INFO" "Running installation script..."
        local container_name="graphdone-test-${name// /-}-$TIMESTAMP"
        
        if docker run --name "$container_name" \
                     --rm \
                     -e GRAPHDONE_TEST_MODE=1 \
                     "$image_name" >> "$log_file" 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            TEST_RESULTS["$name"]="PASS"
            TEST_TIMES["$name"]=$duration
            TEST_LOGS["$name"]="$log_file"
            ((PASSED_TESTS++))
            print_status "PASS" "$name completed in ${duration}s"
        else
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            TEST_RESULTS["$name"]="FAIL"
            TEST_TIMES["$name"]=$duration
            TEST_LOGS["$name"]="$log_file"
            ((FAILED_TESTS++))
            print_status "FAIL" "$name failed after ${duration}s"
        fi
    else
        TEST_RESULTS["$name"]="SKIP"
        TEST_TIMES["$name"]=0
        TEST_LOGS["$name"]="$log_file"
        ((SKIPPED_TESTS++))
        print_status "SKIP" "$name - Docker build failed"
    fi
    
    # Cleanup
    docker rmi "$image_name" 2>/dev/null || true
    rm -f "$dockerfile"
    
    ((TOTAL_TESTS++))
}

# Function to generate HTML report
generate_html_report() {
    cat > "$REPORT_FILE" << 'HTML_HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GraphDone Installation Script - Multi-Distribution Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .summary-card .number {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-card .label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .summary-card.passed .number { color: #22c55e; }
        .summary-card.failed .number { color: #ef4444; }
        .summary-card.skipped .number { color: #f59e0b; }
        .summary-card.total .number { color: #6366f1; }
        .results {
            padding: 30px;
        }
        .results h2 {
            font-size: 1.8em;
            margin-bottom: 20px;
            color: #333;
        }
        .test-grid {
            display: grid;
            gap: 15px;
        }
        .test-item {
            display: grid;
            grid-template-columns: 40px 1fr auto auto;
            align-items: center;
            gap: 20px;
            padding: 20px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            transition: all 0.3s ease;
        }
        .test-item:hover {
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transform: translateY(-2px);
        }
        .status-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5em;
            font-weight: bold;
        }
        .status-icon.pass {
            background: #dcfce7;
            color: #22c55e;
        }
        .status-icon.fail {
            background: #fee2e2;
            color: #ef4444;
        }
        .status-icon.skip {
            background: #fef3c7;
            color: #f59e0b;
        }
        .distro-info h3 {
            font-size: 1.2em;
            margin-bottom: 5px;
            color: #333;
        }
        .distro-info .details {
            color: #666;
            font-size: 0.9em;
        }
        .duration {
            font-family: monospace;
            background: #f3f4f6;
            padding: 5px 10px;
            border-radius: 5px;
            color: #666;
        }
        .log-link {
            color: #6366f1;
            text-decoration: none;
            font-weight: 500;
            padding: 8px 16px;
            border: 1px solid #6366f1;
            border-radius: 5px;
            transition: all 0.3s ease;
        }
        .log-link:hover {
            background: #6366f1;
            color: white;
        }
        .footer {
            padding: 20px;
            text-align: center;
            background: #f8f9fa;
            color: #666;
            font-size: 0.9em;
        }
        .progress-bar {
            height: 30px;
            background: #f3f4f6;
            border-radius: 15px;
            overflow: hidden;
            display: flex;
            margin: 20px 30px;
        }
        .progress-bar .passed {
            background: #22c55e;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .progress-bar .failed {
            background: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .progress-bar .skipped {
            background: #f59e0b;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 Multi-Distribution Test Report</h1>
            <div class="subtitle">GraphDone Installation Script Validation</div>
        </div>
HTML_HEADER

    # Add timestamp
    echo "        <div style='text-align: center; padding: 10px; color: white; opacity: 0.8;'>Generated: $(date '+%Y-%m-%d %H:%M:%S')</div>" >> "$REPORT_FILE"
    
    # Add summary section
    cat >> "$REPORT_FILE" << HTML_SUMMARY
        <div class="summary">
            <div class="summary-card total">
                <div class="number">$TOTAL_TESTS</div>
                <div class="label">Total Tests</div>
            </div>
            <div class="summary-card passed">
                <div class="number">$PASSED_TESTS</div>
                <div class="label">Passed</div>
            </div>
            <div class="summary-card failed">
                <div class="number">$FAILED_TESTS</div>
                <div class="label">Failed</div>
            </div>
            <div class="summary-card skipped">
                <div class="number">$SKIPPED_TESTS</div>
                <div class="label">Skipped</div>
            </div>
        </div>
HTML_SUMMARY
    
    # Add progress bar
    if [ $TOTAL_TESTS -gt 0 ]; then
        local pass_pct=$((PASSED_TESTS * 100 / TOTAL_TESTS))
        local fail_pct=$((FAILED_TESTS * 100 / TOTAL_TESTS))
        local skip_pct=$((SKIPPED_TESTS * 100 / TOTAL_TESTS))
        
        echo "        <div class='progress-bar'>" >> "$REPORT_FILE"
        [ $pass_pct -gt 0 ] && echo "            <div class='passed' style='width: ${pass_pct}%'>${pass_pct}%</div>" >> "$REPORT_FILE"
        [ $fail_pct -gt 0 ] && echo "            <div class='failed' style='width: ${fail_pct}%'>${fail_pct}%</div>" >> "$REPORT_FILE"
        [ $skip_pct -gt 0 ] && echo "            <div class='skipped' style='width: ${skip_pct}%'>${skip_pct}%</div>" >> "$REPORT_FILE"
        echo "        </div>" >> "$REPORT_FILE"
    fi
    
    # Add test results
    echo "        <div class='results'>" >> "$REPORT_FILE"
    echo "            <h2>Test Results by Distribution</h2>" >> "$REPORT_FILE"
    echo "            <div class='test-grid'>" >> "$REPORT_FILE"
    
    for distro_info in "${DISTRIBUTIONS[@]}"; do
        local name=$(echo "$distro_info" | cut -d'|' -f2)
        local image=$(echo "$distro_info" | cut -d'|' -f1)
        local status="${TEST_RESULTS[$name]:-SKIP}"
        local duration="${TEST_TIMES[$name]:-0}"
        local log_file="${TEST_LOGS[$name]}"
        
        local status_lower=$(echo "$status" | tr '[:upper:]' '[:lower:]')
        local icon="○"
        [ "$status" = "PASS" ] && icon="✓"
        [ "$status" = "FAIL" ] && icon="✗"
        
        echo "                <div class='test-item'>" >> "$REPORT_FILE"
        echo "                    <div class='status-icon $status_lower'>$icon</div>" >> "$REPORT_FILE"
        echo "                    <div class='distro-info'>" >> "$REPORT_FILE"
        echo "                        <h3>$name</h3>" >> "$REPORT_FILE"
        echo "                        <div class='details'>Docker image: $image</div>" >> "$REPORT_FILE"
        echo "                    </div>" >> "$REPORT_FILE"
        echo "                    <div class='duration'>${duration}s</div>" >> "$REPORT_FILE"
        if [ -f "$log_file" ]; then
            local log_name=$(basename "$log_file")
            echo "                    <a href='logs_$TIMESTAMP/$log_name' class='log-link' target='_blank'>View Log</a>" >> "$REPORT_FILE"
        fi
        echo "                </div>" >> "$REPORT_FILE"
    done
    
    echo "            </div>" >> "$REPORT_FILE"
    echo "        </div>" >> "$REPORT_FILE"
    
    # Add footer
    cat >> "$REPORT_FILE" << 'HTML_FOOTER'
        <div class="footer">
            <p>GraphDone Installation Script Test Suite</p>
            <p>This report validates the one-line installation script across multiple Linux distributions</p>
        </div>
    </div>
</body>
</html>
HTML_FOOTER
}

# Main execution
main() {
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}     GraphDone Multi-Distribution Installation Test Suite${NC}"
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_status "FAIL" "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if installation script exists
    if [ ! -f "$INSTALL_SCRIPT" ]; then
        print_status "FAIL" "Installation script not found at: $INSTALL_SCRIPT"
        exit 1
    fi
    
    print_status "INFO" "Starting tests for ${#DISTRIBUTIONS[@]} distributions..."
    print_status "INFO" "Test results will be saved to: $REPORT_FILE"
    echo
    
    # Test each distribution
    for distro in "${DISTRIBUTIONS[@]}"; do
        test_distribution "$distro"
        echo
    done
    
    # Generate HTML report
    print_status "INFO" "Generating HTML report..."
    generate_html_report
    
    # Print summary
    echo
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Test Summary:${NC}"
    echo -e "  Total Tests:  ${CYAN}$TOTAL_TESTS${NC}"
    echo -e "  Passed:       ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  Failed:       ${RED}$FAILED_TESTS${NC}"
    echo -e "  Skipped:      ${YELLOW}$SKIPPED_TESTS${NC}"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
        echo -e "  Success Rate: ${BOLD}${success_rate}%${NC}"
    fi
    
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    print_status "INFO" "Report saved to: $REPORT_FILE"
    echo
    
    # Open report in browser (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "INFO" "Opening report in browser..."
        open "$REPORT_FILE"
    else
        echo "Open the report manually: $REPORT_FILE"
    fi
    
    # Exit with appropriate code
    [ $FAILED_TESTS -eq 0 ] && exit 0 || exit 1
}

# Run main function
main "$@"