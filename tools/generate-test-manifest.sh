#!/bin/bash

# GraphDone Test Manifest Generator
# Creates structured JSON manifest for GraphDone-DevOps integration

set -e

REPORT_DIR="${1:-test-reports}"
ARTIFACTS_DIR="${2}"

if [ -z "$ARTIFACTS_DIR" ]; then
    # Find most recent artifacts directory
    ARTIFACTS_DIR=$(find "$REPORT_DIR" -maxdepth 1 -type d -name "artifacts-*" | sort -r | head -1)
fi

if [ ! -d "$ARTIFACTS_DIR" ]; then
    echo "Error: Artifacts directory not found: $ARTIFACTS_DIR"
    exit 1
fi

TIMESTAMP=$(basename "$ARTIFACTS_DIR" | sed 's/artifacts-//')
MANIFEST_FILE="$ARTIFACTS_DIR/test-manifest.json"

echo "Generating test manifest for: $ARTIFACTS_DIR"

# Get Git context
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_AUTHOR=$(git log -1 --format='%an' 2>/dev/null || echo "unknown")
GIT_MESSAGE=$(git log -1 --format='%s' 2>/dev/null || echo "unknown")

# Count artifacts
VISUAL_SCREENSHOTS=$(find "$ARTIFACTS_DIR/visual-regression" -name "*.png" 2>/dev/null | wc -l || echo "0")
VISUAL_DEVICES=$(find "$ARTIFACTS_DIR/visual-regression" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l || echo "0")

PLAYWRIGHT_REPORT_EXISTS=$([ -d "$ARTIFACTS_DIR/playwright-report" ] && echo "true" || echo "false")
COVERAGE_EXISTS=$([ -d "$ARTIFACTS_DIR/coverage" ] && echo "true" || echo "false")
TEST_RESULTS_EXISTS=$([ -d "$ARTIFACTS_DIR/test-results" ] && echo "true" || echo "false")

# Parse test summary from logs
E2E_PASSED=0
E2E_FAILED=0
E2E_DURATION="0s"

if [ -f "$REPORT_DIR/e2e-tests.log" ]; then
    E2E_PASSED=$(grep -oP '\K\d+(?= passed)' "$REPORT_DIR/e2e-tests.log" | tail -1 || echo "0")
    E2E_FAILED=$(grep -oP '\K\d+(?= failed)' "$REPORT_DIR/e2e-tests.log" | tail -1 || echo "0")
    E2E_DURATION=$(grep -oP '\(\K[\d.]+s(?=\))' "$REPORT_DIR/e2e-tests.log" | tail -1 || echo "0s")
fi

UNIT_PASSED=0
UNIT_FAILED=0
UNIT_DURATION="0s"

if [ -f "$REPORT_DIR/unit-tests.log" ]; then
    UNIT_PASSED=$(grep -oP 'Test Files.*\K\d+(?= passed)' "$REPORT_DIR/unit-tests.log" | tail -1 || echo "0")
    UNIT_FAILED=$(grep -oP 'Test Files.*\K\d+(?= failed)' "$REPORT_DIR/unit-tests.log" | tail -1 || echo "0")
    UNIT_DURATION=$(grep -oP 'Duration.*\K[\d.]+s' "$REPORT_DIR/unit-tests.log" | tail -1 || echo "0s")
fi

# Generate manifest
cat > "$MANIFEST_FILE" << EOF
{
  "version": "1.0.0",
  "generated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "timestamp": "$TIMESTAMP",
  "git": {
    "branch": "$GIT_BRANCH",
    "commit": "$GIT_COMMIT",
    "commitShort": "$GIT_COMMIT_SHORT",
    "author": "$GIT_AUTHOR",
    "message": "$GIT_MESSAGE"
  },
  "summary": {
    "e2e": {
      "passed": $E2E_PASSED,
      "failed": $E2E_FAILED,
      "duration": "$E2E_DURATION",
      "status": "$([ "$E2E_FAILED" -eq 0 ] && echo "passed" || echo "failed")"
    },
    "unit": {
      "passed": $UNIT_PASSED,
      "failed": $UNIT_FAILED,
      "duration": "$UNIT_DURATION",
      "status": "$([ "$UNIT_FAILED" -eq 0 ] && echo "passed" || echo "failed")"
    }
  },
  "artifacts": {
    "visualRegression": {
      "enabled": $([ "$VISUAL_SCREENSHOTS" -gt 0 ] && echo "true" || echo "false"),
      "screenshots": $VISUAL_SCREENSHOTS,
      "devices": $VISUAL_DEVICES,
      "path": "visual-regression"
    },
    "playwrightReport": {
      "enabled": $PLAYWRIGHT_REPORT_EXISTS,
      "path": "playwright-report"
    },
    "coverage": {
      "enabled": $COVERAGE_EXISTS,
      "path": "coverage"
    },
    "testResults": {
      "enabled": $TEST_RESULTS_EXISTS,
      "path": "test-results"
    }
  },
  "logs": {
    "main": "../e2e-report-$TIMESTAMP.md",
    "build": "../build.log",
    "unitTests": "../unit-tests.log",
    "e2eTests": "../e2e-tests.log",
    "visualRegression": "../visual-regression.log",
    "lint": "../lint.log",
    "typecheck": "../typecheck.log"
  },
  "paths": {
    "artifactsDir": "$(basename "$ARTIFACTS_DIR")",
    "absolutePath": "$ARTIFACTS_DIR"
  }
}
EOF

# Generate visual regression index
if [ -d "$ARTIFACTS_DIR/visual-regression" ]; then
    VR_INDEX="$ARTIFACTS_DIR/visual-regression/index.json"

    echo "{" > "$VR_INDEX"
    echo "  \"generated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$VR_INDEX"
    echo "  \"totalScreenshots\": $VISUAL_SCREENSHOTS," >> "$VR_INDEX"
    echo "  \"devices\": [" >> "$VR_INDEX"

    FIRST=true
    for device_dir in "$ARTIFACTS_DIR/visual-regression"/*; do
        if [ -d "$device_dir" ]; then
            DEVICE_NAME=$(basename "$device_dir")
            SCREENSHOT_COUNT=$(find "$device_dir" -name "*.png" | wc -l)

            if [ "$FIRST" = true ]; then
                FIRST=false
            else
                echo "," >> "$VR_INDEX"
            fi

            echo "    {" >> "$VR_INDEX"
            echo "      \"name\": \"$DEVICE_NAME\"," >> "$VR_INDEX"
            echo "      \"screenshots\": $SCREENSHOT_COUNT," >> "$VR_INDEX"
            echo "      \"path\": \"$DEVICE_NAME\"," >> "$VR_INDEX"
            echo "      \"files\": [" >> "$VR_INDEX"

            FIRST_FILE=true
            for screenshot in "$device_dir"/*.png; do
                if [ -f "$screenshot" ]; then
                    FILENAME=$(basename "$screenshot")
                    FILESIZE=$(stat -f%z "$screenshot" 2>/dev/null || stat -c%s "$screenshot" 2>/dev/null || echo "0")

                    if [ "$FIRST_FILE" = true ]; then
                        FIRST_FILE=false
                    else
                        echo "," >> "$VR_INDEX"
                    fi

                    echo -n "        {\"name\": \"$FILENAME\", \"size\": $FILESIZE}" >> "$VR_INDEX"
                fi
            done

            echo "" >> "$VR_INDEX"
            echo "      ]" >> "$VR_INDEX"
            echo -n "    }" >> "$VR_INDEX"
        fi
    done

    echo "" >> "$VR_INDEX"
    echo "  ]" >> "$VR_INDEX"
    echo "}" >> "$VR_INDEX"

    echo "Generated visual regression index: $VR_INDEX"
fi

echo "Generated test manifest: $MANIFEST_FILE"
echo ""
echo "Manifest Summary:"
jq '.' "$MANIFEST_FILE" 2>/dev/null || cat "$MANIFEST_FILE"
