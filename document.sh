#!/bin/bash

# GraphDone Documentation Generator and Deployment Script

set -e

# Default options
BUILD_DOCS=true
DEPLOY_DOCS=false
FORMAT="all"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-build)
            BUILD_DOCS=false
            shift
            ;;
        --deploy)
            DEPLOY_DOCS=true
            shift
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --help|-h)
            echo "GraphDone Documentation Generator"
            echo ""
            echo "Usage: ./document.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-build              Skip documentation build"
            echo "  --deploy                Deploy documentation to GitHub Pages"
            echo "  --format FORMAT         Documentation format (all, html, pdf, markdown)"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./document.sh                    # Build all documentation"
            echo "  ./document.sh --deploy           # Build and deploy to GitHub Pages"
            echo "  ./document.sh --format html      # Build only HTML documentation"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "📚 GraphDone Documentation Generator"

# Validate format
if [[ "$FORMAT" != "all" && "$FORMAT" != "html" && "$FORMAT" != "pdf" && "$FORMAT" != "markdown" ]]; then
    echo "❌ Invalid format: $FORMAT"
    echo "Valid formats: all, html, pdf, markdown"
    exit 1
fi

# Create build directory
if [ "$BUILD_DOCS" = true ]; then
    echo "🏗️  Building documentation..."
    mkdir -p build/docs
    
    # Copy markdown files
    if [[ "$FORMAT" == "all" || "$FORMAT" == "markdown" ]]; then
        echo "📝 Processing Markdown documentation..."
        cp -r docs/* build/docs/
        cp README.md build/docs/
        cp philosophy.md build/docs/
        cp CLAUDE.md build/docs/
        echo "✅ Markdown documentation copied"
    fi
    
    # Generate HTML documentation
    if [[ "$FORMAT" == "all" || "$FORMAT" == "html" ]]; then
        echo "🌐 Generating HTML documentation..."
        
        # Check if we have a documentation generator installed
        if command -v mkdocs &> /dev/null; then
            echo "📖 Using MkDocs for HTML generation..."
            mkdocs build --site-dir build/docs/html
        elif command -v gitbook &> /dev/null; then
            echo "📖 Using GitBook for HTML generation..."
            gitbook build docs build/docs/html
        else
            echo "ℹ️  No documentation generator found. Using simple HTML generation..."
            
            # Simple HTML wrapper for markdown files
            cat > build/docs/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GraphDone Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .nav { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .nav ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 20px; }
        .nav a { text-decoration: none; color: #0066cc; font-weight: 500; }
        .nav a:hover { color: #004499; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="nav">
        <ul>
            <li><a href="README.html">Getting Started</a></li>
            <li><a href="guides/getting-started.html">Developer Guide</a></li>
            <li><a href="api/graphql.html">API Reference</a></li>
            <li><a href="deployment/README.html">Deployment</a></li>
            <li><a href="philosophy.html">Philosophy</a></li>
        </ul>
    </div>
    
    <h1>GraphDone Documentation</h1>
    
    <div class="warning">
        <strong>AI-Generated Content Warning:</strong> This documentation contains AI-generated content. Verify information before depending on it for decision making.
    </div>
    
    <p>Welcome to the GraphDone documentation! Choose a section from the navigation above to get started.</p>
    
    <h2>Quick Links</h2>
    <ul>
        <li><a href="guides/getting-started.html">🚀 Getting Started Guide</a></li>
        <li><a href="api/graphql.html">📡 GraphQL API Reference</a></li>
        <li><a href="deployment/README.html">🚢 Deployment Guide</a></li>
        <li><a href="philosophy.html">💭 Project Philosophy</a></li>
    </ul>
    
    <h2>Project Overview</h2>
    <p>GraphDone reimagines project management as a collaborative graph where work flows through natural dependencies rather than artificial hierarchies.</p>
    
    <h3>Key Features</h3>
    <ul>
        <li>🌐 Graph-native collaboration</li>
        <li>📱 Mobile-first design</li>
        <li>🤖 AI agent integration</li>
        <li>🗳️ Democratic prioritization</li>
        <li>🎯 Spherical priority model</li>
    </ul>
    
    <footer style="margin-top: 60px; padding: 30px 0; border-top: 1px solid #eee; text-align: center; color: #666;">
        <p>GraphDone v0.1.0-alpha - For teams who think differently</p>
    </footer>
</body>
</html>
EOF
            echo "✅ Basic HTML documentation generated"
        fi
    fi
    
    # Generate PDF documentation
    if [[ "$FORMAT" == "all" || "$FORMAT" == "pdf" ]]; then
        echo "📄 Generating PDF documentation..."
        
        if command -v pandoc &> /dev/null; then
            echo "📖 Using Pandoc for PDF generation..."
            
            # Combine all markdown files into one
            cat > build/docs/complete-guide.md << 'EOF'
# GraphDone Complete Documentation

**AI-Generated Content Warning: This documentation contains AI-generated content. Verify information before depending on it for decision making.**

---

EOF
            
            # Append all documentation files
            cat README.md >> build/docs/complete-guide.md
            echo -e "\n\n---\n\n" >> build/docs/complete-guide.md
            cat philosophy.md >> build/docs/complete-guide.md
            echo -e "\n\n---\n\n" >> build/docs/complete-guide.md
            cat docs/guides/getting-started.md >> build/docs/complete-guide.md
            echo -e "\n\n---\n\n" >> build/docs/complete-guide.md
            cat docs/api/graphql.md >> build/docs/complete-guide.md
            echo -e "\n\n---\n\n" >> build/docs/complete-guide.md
            cat docs/deployment/README.md >> build/docs/complete-guide.md
            
            # Generate PDF
            pandoc build/docs/complete-guide.md -o build/docs/graphdone-documentation.pdf \
                --pdf-engine=xelatex \
                --variable mainfont="DejaVu Sans" \
                --variable monofont="DejaVu Sans Mono" \
                --variable fontsize=11pt \
                --variable geometry="margin=1in" \
                --toc \
                --toc-depth=2 \
                --highlight-style=github
            
            echo "✅ PDF documentation generated: build/docs/graphdone-documentation.pdf"
        else
            echo "⚠️  Pandoc not found. Skipping PDF generation."
            echo "   Install pandoc to enable PDF generation: https://pandoc.org/installing.html"
        fi
    fi
    
    echo "✅ Documentation build completed!"
fi

# Deploy documentation
if [ "$DEPLOY_DOCS" = true ]; then
    echo "🚀 Deploying documentation to GitHub Pages..."
    
    # Check if gh-pages branch exists
    if git rev-parse --verify gh-pages >/dev/null 2>&1; then
        echo "📋 gh-pages branch exists"
    else
        echo "📋 Creating gh-pages branch..."
        git checkout --orphan gh-pages
        git rm -rf .
        git commit --allow-empty -m "Initial gh-pages commit"
        git checkout main
    fi
    
    # Deploy to gh-pages
    if [ -d "build/docs" ]; then
        echo "📤 Pushing documentation to gh-pages..."
        
        # Copy build files to temp directory
        cp -r build/docs/* /tmp/docs-deploy/
        
        # Switch to gh-pages and update
        git checkout gh-pages
        rm -rf *
        cp -r /tmp/docs-deploy/* .
        
        # Add CNAME file if custom domain is configured
        if [ -n "$DOCS_DOMAIN" ]; then
            echo "$DOCS_DOMAIN" > CNAME
        fi
        
        # Commit and push
        git add .
        git commit -m "Deploy documentation - $(date)"
        git push origin gh-pages
        
        # Switch back to main
        git checkout main
        
        # Cleanup
        rm -rf /tmp/docs-deploy
        
        echo "✅ Documentation deployed!"
        echo "🌐 Available at: https://$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/').github.io/"
    else
        echo "❌ No documentation build found. Run with --build first."
        exit 1
    fi
fi

# Generate documentation metrics
echo ""
echo "📊 Documentation Statistics:"
echo "  Markdown files: $(find docs -name "*.md" | wc -l)"
echo "  Total lines: $(find docs -name "*.md" -exec wc -l {} + | tail -1 | awk '{print $1}')"
echo "  API endpoints documented: $(grep -r "```graphql" docs | wc -l)"

if [ -d "build/docs" ]; then
    echo "  Build size: $(du -sh build/docs | cut -f1)"
fi

echo ""
echo "✅ Documentation generation completed!"

if [ "$BUILD_DOCS" = true ] && [ "$DEPLOY_DOCS" = false ]; then
    echo "💡 Tip: Add --deploy to publish to GitHub Pages"
fi