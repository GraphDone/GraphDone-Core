#!/bin/sh
# Setup script for GraphDone git hooks
# Ensures all developers have the required pre-commit hooks installed

echo "════════════════════════════════════════════════════════════════════"
echo "              Setting up GraphDone Git Hooks                       "
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository root"
    echo "   Please run this script from the GraphDone-Core directory"
    exit 1
fi

# Create hooks directory if it doesn't exist
if [ ! -d .githooks ]; then
    echo "📁 Creating .githooks directory..."
    mkdir -p .githooks
fi

# Ensure hooks are executable
echo "🔧 Setting executable permissions on hooks..."
chmod +x .githooks/pre-commit 2>/dev/null || true
chmod +x .githooks/commit-msg 2>/dev/null || true

# Configure git to use our hooks directory
echo "⚙️  Configuring git to use .githooks directory..."
git config core.hooksPath .githooks

# Verify configuration
HOOKS_PATH=$(git config core.hooksPath)
if [ "$HOOKS_PATH" = ".githooks" ]; then
    echo "✅ Git hooks configured successfully!"
else
    echo "⚠️  Warning: Git hooks path not set correctly"
    echo "   Current path: $HOOKS_PATH"
    echo "   Expected: .githooks"
fi

echo ""
echo "📋 Installed hooks:"
echo "  • pre-commit  - Warns about Co-Authored-By in files"
echo "  • commit-msg  - Blocks commits with Co-Authored-By"
echo ""
echo "🚫 The following will be blocked:"
echo "  • Co-Authored-By: <name> <email>"
echo "  • Co-Author: ..."
echo "  • Pair programming references"
echo "  • AI assistant attributions (Claude, etc.)"
echo "  • Bot/automation co-authors"
echo ""
echo "📖 Policy: GraphDone maintains single-author commits for:"
echo "  • Clear accountability"
echo "  • Clean git history"
echo "  • Accurate contribution tracking"
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "                    Setup Complete! ✅                              "
echo "════════════════════════════════════════════════════════════════════"