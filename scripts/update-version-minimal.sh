#!/bin/bash

# Minimal version update script
# Only updates what absolutely cannot read from root package.json

set -e

NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.3.2-alpha"
    exit 1
fi

echo "Updating version to $NEW_VERSION..."

# 1. Update root package.json (THE single source of truth)
echo "✓ Updating root package.json..."
sed -i.bak "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*-alpha\"/\"version\": \"$NEW_VERSION\"/" package.json
rm package.json.bak

# 2. Update Docker image tags (cannot read package.json at build time)
echo "✓ Updating Docker image tags..."
for compose in deployment/docker-compose*.yml; do
    if [ -f "$compose" ]; then
        sed -i.bak "s/gd-core-[^:]*:[0-9]*\.[0-9]*\.[0-9]*-alpha/&/g; s/:[0-9]*\.[0-9]*\.[0-9]*-alpha/:$NEW_VERSION/g" "$compose"
        rm "$compose.bak"
    fi
done

# 3. Update web version utility
echo "✓ Updating web version utility..."
sed -i.bak "s/APP_VERSION = '[0-9]*\.[0-9]*\.[0-9]*-alpha'/APP_VERSION = '$NEW_VERSION'/g" packages/web/src/utils/version.ts
rm packages/web/src/utils/version.ts.bak

# 4. Update README badge
echo "✓ Updating README version badge..."
sed -i.bak "s/version-[0-9]*\.[0-9]*\.[0-9]*--alpha/version-${NEW_VERSION//./-}/g" README.md
rm README.md.bak

# 5. Update MCP server hardcoded versions
echo "✓ Updating MCP server versions..."
sed -i.bak "s/version: '[0-9]*\.[0-9]*\.[0-9]*-alpha'/version: '$NEW_VERSION'/g" packages/mcp-server/src/index.ts
sed -i.bak "s/version: '[0-9]*\.[0-9]*\.[0-9]*-alpha'/version: '$NEW_VERSION'/g" packages/mcp-server/src/health-server.ts
sed -i.bak "s/toBe('[0-9]*\.[0-9]*\.[0-9]*-alpha')/toBe('$NEW_VERSION')/g" packages/mcp-server/tests/health-server.test.ts
rm packages/mcp-server/src/index.ts.bak packages/mcp-server/src/health-server.ts.bak packages/mcp-server/tests/health-server.test.ts.bak


echo
echo "🎉 Version updated to $NEW_VERSION"
echo
echo "📝 What was updated:"
echo "   • Root package.json (source of truth)"
echo "   • Docker image tags (can't import from package.json)"  
echo "   • README.md version badge"
echo "   • MCP server hardcoded versions"
echo "   • Web version utility constant"
echo
echo "📦 Everything else imports automatically from root package.json!"
echo
echo "🚀 Next: npm install && git add . && git commit -m \"Update version to v$NEW_VERSION\""