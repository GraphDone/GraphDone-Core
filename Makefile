# GraphDone Makefile for Test Automation
# Run all tests and generate HTML report with: make test-all

.PHONY: help test test-all test-https test-e2e test-unit test-report deploy clean

# Default target - show help
help:
	@echo "GraphDone Test Automation"
	@echo ""
	@echo "Available commands:"
	@echo "  make test-all        - Run all comprehensive tests and generate HTML report"
	@echo "  make test-https      - Run HTTPS/SSL compatibility tests only"
	@echo "  make test-e2e        - Run E2E Playwright tests"
	@echo "  make test-unit       - Run unit tests"
	@echo "  make test-report     - Open the latest HTML test report"
	@echo "  make deploy          - Start production deployment"
	@echo "  make clean           - Clean test results and artifacts"
	@echo ""
	@echo "Quick start:"
	@echo "  1. make deploy       # Start production server"
	@echo "  2. make test-all     # Run all tests"
	@echo "  3. make test-report  # View HTML report"

# Run all comprehensive tests
test-all: check-deploy
	@echo "🧪 Running comprehensive test suite..."
	@npm run test:comprehensive
	@echo "✅ Tests complete! Opening HTML report..."
	@open test-results/reports/index.html

# Run HTTPS/SSL tests only
test-https: check-deploy
	@echo "🔒 Running HTTPS compatibility tests..."
	@npm run test:https
	@echo "✅ HTTPS tests complete!"

# Run E2E tests
test-e2e: check-deploy
	@echo "🧪 Running E2E tests..."
	@npm run test:e2e
	@echo "✅ E2E tests complete!"

# Run unit tests
test-unit:
	@echo "🧪 Running unit tests..."
	@npm run test:unit
	@echo "✅ Unit tests complete!"

# Open test report
test-report:
	@if [ -f test-results/reports/index.html ]; then \
		open test-results/reports/index.html; \
		echo "📊 Opening test report in browser..."; \
	else \
		echo "❌ No test report found. Run 'make test-all' first."; \
	fi

# Start production deployment
deploy:
	@echo "🚀 Starting production deployment..."
	@./start deploy

# Check if deployment is running
check-deploy:
	@echo "🔍 Checking if production server is running..."
	@curl -s -o /dev/null -w "%{http_code}" https://localhost:3128/health -k | grep -q "200" || \
		(echo "❌ Production server not running. Run 'make deploy' first." && exit 1)
	@echo "✅ Production server is running"

# Clean test results
clean:
	@echo "🧹 Cleaning test results..."
	@rm -rf test-results/
	@rm -f *.png
	@rm -f https-test-*.png
	@rm -f mobile-https-*.png
	@rm -f ssl-test-*.png
	@rm -f login-*.png
	@rm -f auth-test-*.png
	@rm -f realtime-test-*.png
	@rm -f graph-ops-test-*.png
	@rm -f prod-*.png
	@rm -f resize-*.png
	@rm -f workspace-*.png
	@echo "✅ Clean complete!"

# Shorthand aliases
test: test-all
report: test-report