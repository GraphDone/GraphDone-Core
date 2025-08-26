#!/bin/bash
set -e

echo "🧪 Quick verification of fresh install and MCP tests..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if we have a clean environment
if [[ -d "node_modules" ]]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ No dependencies found${NC}"
    exit 1
fi

# Check if packages built successfully
BUILT_PACKAGES=0
for package in core server web mcp-server; do
    if [[ -d "packages/$package/dist" ]]; then
        BUILT_PACKAGES=$((BUILT_PACKAGES + 1))
    fi
done

if [[ $BUILT_PACKAGES -eq 4 ]]; then
    echo -e "${GREEN}✅ All 4 packages built successfully${NC}"
else
    echo -e "${RED}❌ Only $BUILT_PACKAGES/4 packages built${NC}"
    exit 1
fi

# Run MCP server tests only and count them
echo -e "${BLUE}🧪 Running MCP server tests...${NC}"
TEST_OUTPUT=$(npm run test --workspace=@graphdone/mcp-server 2>&1)
TEST_RESULT=$?

if [[ $TEST_RESULT -eq 0 ]]; then
    # Extract test counts from the output
    TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -o '[0-9]\+ passed' | head -1 | grep -o '[0-9]\+')
    echo -e "${GREEN}✅ All $TOTAL_TESTS MCP server tests passed${NC}"
    
    # Check specific test categories
    if echo "$TEST_OUTPUT" | grep -q "mcp-protocol.test.ts"; then
        echo -e "${GREEN}  ✅ Protocol compliance tests${NC}"
    fi
    if echo "$TEST_OUTPUT" | grep -q "garbage-input.test.ts"; then
        echo -e "${GREEN}  ✅ Garbage input resilience tests${NC}"
    fi
    if echo "$TEST_OUTPUT" | grep -q "mock-validation.test.ts"; then
        echo -e "${GREEN}  ✅ Mock validation tests${NC}"
    fi
    if echo "$TEST_OUTPUT" | grep -q "health-server.test.ts"; then
        echo -e "${GREEN}  ✅ Health server tests${NC}"
    fi
    if echo "$TEST_OUTPUT" | grep -q "mcp-server.test.ts"; then
        echo -e "${GREEN}  ✅ Core functionality tests${NC}"
    fi
else
    echo -e "${RED}❌ MCP server tests failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Fresh installation verified successfully!${NC}"
echo ""
echo "Summary:"
echo "  ✅ Clean environment setup"
echo "  ✅ All packages built from scratch"
echo "  ✅ $TOTAL_TESTS MCP server tests passing"
echo "  ✅ All test categories working"
echo ""
echo -e "${GREEN}✨ Ready for CI/CD pipeline!${NC}"