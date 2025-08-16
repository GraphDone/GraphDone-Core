#!/bin/bash

# GraphDone Test Runner Script

set -e

# Default options
COVERAGE=false
WATCH=false
PACKAGE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --watch|-w)
            WATCH=true
            shift
            ;;
        --package|-p)
            PACKAGE="$2"
            shift 2
            ;;
        --help|-h)
            echo "GraphDone Test Runner"
            echo ""
            echo "Usage: ./test.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --coverage, -c          Run tests with coverage report"
            echo "  --watch, -w             Run tests in watch mode"
            echo "  --package PKG, -p PKG   Run tests for specific package (core, server, web)"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./test.sh                    # Run all tests"
            echo "  ./test.sh --coverage         # Run with coverage"
            echo "  ./test.sh --package core     # Test only core package"
            echo "  ./test.sh --watch            # Run in watch mode"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🧪 Running GraphDone tests..."

# Build test command
if [ -n "$PACKAGE" ]; then
    echo "📦 Testing package: $PACKAGE"
    TEST_CMD="cd packages/$PACKAGE && npm run test"
else
    echo "📦 Testing all packages"
    TEST_CMD="npm run test"
fi

# Add coverage flag
if [ "$COVERAGE" = true ]; then
    echo "📊 Including coverage report"
    if [ -n "$PACKAGE" ]; then
        TEST_CMD="cd packages/$PACKAGE && npm run test:coverage"
    else
        TEST_CMD="turbo run test:coverage"
    fi
fi

# Add watch flag
if [ "$WATCH" = true ]; then
    echo "👀 Running in watch mode"
    if [ -n "$PACKAGE" ]; then
        TEST_CMD="cd packages/$PACKAGE && npm run test -- --watch"
    else
        TEST_CMD="turbo run test -- --watch"
    fi
fi

# Run linting first
echo "🔍 Running linter..."
npm run lint

# Run type checking
echo "🔧 Running type checker..."
npm run typecheck

# Run tests
echo "🧪 Running tests..."
eval $TEST_CMD

echo "✅ All tests completed!"

# Show coverage summary if coverage was run
if [ "$COVERAGE" = true ]; then
    echo ""
    echo "📊 Coverage reports generated:"
    if [ -n "$PACKAGE" ]; then
        echo "  packages/$PACKAGE/coverage/"
    else
        find packages -name "coverage" -type d | sed 's/^/  /'
    fi
fi