#!/bin/bash
# macOS-specific test for GraphDone installation script
# Tests the installation on the current macOS system

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_SCRIPT="$PROJECT_ROOT/public/install.sh"
REPORT_DIR="$PROJECT_ROOT/test-results/macos-installation"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# Generate unique test run ID
TEST_RUN_UUID=$(uuidgen 2>/dev/null || echo "$(date +%s)-$$-$RANDOM")
GIT_COMMIT_SHORT=$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Create report directory
mkdir -p "$REPORT_DIR"

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_LOG="$REPORT_DIR/macos_test_${TIMESTAMP}.log"

# Helper functions
log() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$TEST_LOG"
}

success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$TEST_LOG"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

failure() {
    echo -e "${RED}✗${NC} $1: $2" | tee -a "$TEST_LOG"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "$TEST_LOG"
}

# Check if running on macOS
check_macos() {
    if [ "$(uname)" != "Darwin" ]; then
        echo -e "${RED}Error: This script must be run on macOS${NC}"
        exit 1
    fi
}

# Get macOS version information
get_macos_info() {
    local version=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
    local build=$(sw_vers -buildVersion 2>/dev/null || echo "unknown")
    local name=""
    
    # Determine macOS name
    case "${version%%.*}" in
        15) name="Sequoia" ;;
        14) name="Sonoma" ;;
        13) name="Ventura" ;;
        12) name="Monterey" ;;
        11) name="Big Sur" ;;
        10)
            case "${version#*.}" in
                15*) name="Catalina" ;;
                14*) name="Mojave" ;;
                13*) name="High Sierra" ;;
            esac
            ;;
    esac
    
    echo "macOS $version $name (Build $build)"
}

# Test platform detection in install script
test_platform_detection() {
    log "Testing platform detection..."
    
    # Extract platform detection logic from install script
    if grep -q "PLATFORM=\"macos\"" "$INSTALL_SCRIPT"; then
        success "Platform detection code found"
    else
        failure "Platform detection" "No macOS detection in script"
        return
    fi
    
    # Test if script has macOS detection logic
    if grep -q 'case "$(uname)" in' "$INSTALL_SCRIPT" && grep -q 'Darwin' "$INSTALL_SCRIPT"; then
        success "Script has macOS detection logic"
    else
        failure "Platform detection" "Missing macOS detection logic"
    fi
}

# Test macOS version compatibility check
test_macos_compatibility() {
    log "Testing macOS version compatibility..."
    
    local version=$(sw_vers -productVersion 2>/dev/null)
    local major="${version%%.*}"
    local minor="${version#*.}"
    minor="${minor%%.*}"
    
    # Check if current version meets requirements (10.15+)
    if [ "$major" -ge 11 ] || ([ "$major" -eq 10 ] && [ "$minor" -ge 15 ]); then
        success "macOS $version meets minimum requirements (10.15+)"
    else
        warning "macOS $version below recommended version (10.15+)"
    fi
    
    # Check if install script has macOS version checks
    if grep -q "macOS 10.15" "$INSTALL_SCRIPT" || grep -q "Catalina" "$INSTALL_SCRIPT"; then
        success "Installation script includes version compatibility checks"
    else
        warning "Installation script may not check macOS version compatibility"
    fi
}

# Test Homebrew detection
test_homebrew_detection() {
    log "Testing Homebrew detection..."
    
    if command -v brew >/dev/null 2>&1; then
        local brew_version=$(brew --version | head -1)
        success "Homebrew installed: $brew_version"
        
        # Check if install script uses Homebrew
        if grep -q "brew install" "$INSTALL_SCRIPT" || grep -q "Homebrew" "$INSTALL_SCRIPT"; then
            success "Installation script uses Homebrew for macOS"
        else
            failure "Homebrew usage" "Script doesn't appear to use Homebrew"
        fi
    else
        warning "Homebrew not installed (installation script should handle this)"
    fi
}

# Test dependency checks
test_dependency_checks() {
    log "Testing dependency detection..."
    
    # Test Git detection
    if command -v git >/dev/null 2>&1; then
        local git_version=$(git --version | cut -d' ' -f3)
        success "Git installed: $git_version"
        
        # Check if it's Apple Git
        if git --version | grep -q "Apple Git"; then
            warning "Using Apple Git (script should upgrade to Homebrew Git)"
        fi
    else
        warning "Git not installed (script should install it)"
    fi
    
    # Test Node.js detection
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        success "Node.js installed: $node_version"
        
        # Check version requirement (18+)
        local major="${node_version#v}"
        major="${major%%.*}"
        if [ "$major" -ge 18 ]; then
            success "Node.js meets requirements (v18+)"
        else
            warning "Node.js $node_version below required version (v18+)"
        fi
    else
        warning "Node.js not installed (script should install it)"
    fi
    
    # Test Docker detection
    if command -v docker >/dev/null 2>&1; then
        local docker_version=$(docker --version | cut -d' ' -f3 | tr -d ',')
        success "Docker installed: $docker_version"
        
        # Check if Docker daemon is running
        if docker info >/dev/null 2>&1; then
            success "Docker daemon is running"
        else
            warning "Docker installed but daemon not running"
        fi
    else
        warning "Docker not installed (script should install Docker Desktop or OrbStack)"
    fi
}

# Test OrbStack support
test_orbstack_support() {
    log "Testing OrbStack support..."
    
    # Check if script mentions OrbStack (Docker Desktop alternative)
    if grep -q "orbstack\|OrbStack" "$INSTALL_SCRIPT"; then
        success "Installation script supports OrbStack"
        
        # Check if OrbStack is installed
        if [ -d "/Applications/OrbStack.app" ] || command -v orbstack >/dev/null 2>&1; then
            success "OrbStack is installed"
        else
            warning "OrbStack not installed (alternative to Docker Desktop)"
        fi
    else
        warning "Installation script may not support OrbStack"
    fi
}

# Test architecture detection
test_architecture_detection() {
    log "Testing architecture detection..."
    
    local arch=$(uname -m)
    success "System architecture: $arch"
    
    if [ "$arch" = "arm64" ]; then
        success "Apple Silicon (M1/M2/M3) detected"
        
        # Check if script handles ARM64
        if grep -q "arm64\|aarch64" "$INSTALL_SCRIPT"; then
            success "Installation script handles ARM64 architecture"
        else
            warning "Installation script may not handle ARM64 properly"
        fi
    elif [ "$arch" = "x86_64" ]; then
        success "Intel Mac detected"
    else
        warning "Unknown architecture: $arch"
    fi
}

# Test script syntax
test_script_syntax() {
    log "Testing installation script syntax..."
    
    # Check for POSIX compliance
    if sh -n "$INSTALL_SCRIPT" 2>/dev/null; then
        success "Installation script has valid shell syntax"
    else
        failure "Script syntax" "Installation script has syntax errors"
    fi
    
    # Check script size and structure
    local script_size=$(wc -c < "$INSTALL_SCRIPT")
    if [ "$script_size" -gt 1000 ]; then
        success "Installation script is substantial ($script_size bytes)"
    else
        warning "Installation script seems too small ($script_size bytes)"
    fi
}

# Test help functionality
test_help_command() {
    log "Testing help command..."
    
    # Try running with --help
    local help_output=$("$INSTALL_SCRIPT" --help 2>&1 || true)
    
    if echo "$help_output" | grep -q "GraphDone\|Usage\|Options" >/dev/null 2>&1; then
        success "Installation script provides help information"
    else
        warning "Installation script may not support --help flag"
    fi
}

# Generate HTML report
generate_html_report() {
    local report_file="$REPORT_DIR/macos_report_${TIMESTAMP}.html"
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GraphDone macOS Installation Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 3rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
        }
        .logo {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        h1 {
            font-size: 2.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: #666;
            font-size: 1.2rem;
        }
        .system-info {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            border: 2px solid #f0f0f0;
        }
        .stat-value {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .stat-label {
            color: #666;
            text-transform: uppercase;
            font-size: 0.85rem;
            letter-spacing: 1px;
        }
        .passed { color: #10b981; }
        .failed { color: #ef4444; }
        .total { color: #6366f1; }
        .rate { color: #f59e0b; }
        .test-results {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.5rem;
        }
        .test-item {
            display: flex;
            align-items: center;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            background: white;
            border-radius: 8px;
        }
        .test-status {
            width: 24px;
            height: 24px;
            margin-right: 1rem;
            font-weight: bold;
        }
        .test-pass { color: #10b981; }
        .test-fail { color: #ef4444; }
        .test-warn { color: #f59e0b; }
        .footer {
            text-align: center;
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #e5e5e5;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🍎 🌊 🏝️</div>
            <h1>macOS Installation Test Report</h1>
            <div class="subtitle">GraphDone PR #24 Validation</div>
        </div>
        
        <div class="system-info">
            <h3 style="margin-bottom: 1rem;">System Information</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                <div><strong>OS:</strong> $(get_macos_info)</div>
                <div><strong>Architecture:</strong> $(uname -m)</div>
                <div><strong>Hostname:</strong> $(hostname)</div>
                <div><strong>Test ID:</strong> ${TEST_RUN_UUID:0:8}</div>
                <div><strong>Git Commit:</strong> $GIT_COMMIT_SHORT</div>
                <div><strong>Timestamp:</strong> $(date)</div>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value total">$TOTAL_TESTS</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value passed">$PASSED_TESTS</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value failed">$FAILED_TESTS</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value rate">${success_rate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        </div>
        
        <div class="test-results">
            <h3 style="margin-bottom: 1rem;">Test Results</h3>
            $(cat "$TEST_LOG" | sed -n 's/^.*\[\([0-9:]*\)\].*$/<!-- timestamp: \1 -->/p; s/^.*✓ \(.*\)$/<div class="test-item"><span class="test-status test-pass">✓<\/span>\1<\/div>/p; s/^.*✗ \([^:]*\): \(.*\)$/<div class="test-item"><span class="test-status test-fail">✗<\/span>\1: \2<\/div>/p; s/^.*⚠ \(.*\)$/<div class="test-item"><span class="test-status test-warn">⚠<\/span>\1<\/div>/p')
        </div>
        
        <div class="footer">
            <p>Generated on $(date) | Test Runner: test-installation-macos.sh</p>
            <p>GraphDone v0.3.1-alpha | macOS Installation Validation</p>
        </div>
    </div>
</body>
</html>
EOF
    
    echo -e "\n${GREEN}HTML Report generated: $report_file${NC}"
}

# Main execution
main() {
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}     GraphDone macOS Installation Test Suite${NC}"
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    
    # Check if running on macOS
    check_macos
    
    echo -e "${CYAN}System:${NC} $(get_macos_info)"
    echo -e "${CYAN}Architecture:${NC} $(uname -m)"
    echo -e "${CYAN}Test ID:${NC} $TEST_RUN_UUID"
    echo
    
    # Check if installation script exists
    if [ ! -f "$INSTALL_SCRIPT" ]; then
        echo -e "${RED}✗${NC} Installation script not found at: $INSTALL_SCRIPT"
        exit 1
    fi
    
    log "Starting macOS-specific tests..."
    echo
    
    # Run tests
    test_platform_detection
    test_macos_compatibility
    test_homebrew_detection
    test_dependency_checks
    test_orbstack_support
    test_architecture_detection
    test_script_syntax
    test_help_command
    
    # Generate reports
    generate_html_report
    
    # Print summary
    echo
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Test Summary:${NC}"
    echo -e "  Total Tests:  ${CYAN}$TOTAL_TESTS${NC}"
    echo -e "  Passed:       ${GREEN}$PASSED_TESTS${NC}"
    echo -e "  Failed:       ${RED}$FAILED_TESTS${NC}"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
        echo -e "  Success Rate: ${BOLD}${success_rate}%${NC}"
    fi
    
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    echo -e "📊 Test log saved to: $TEST_LOG"
    echo
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✅ All macOS tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}${BOLD}❌ Some macOS tests failed.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"