#!/bin/bash

echo "🔐 GraphDone - Installing Trusted Certificates (No More Warnings!)"
echo "================================================================"
echo ""
echo "This script will install mkcert's root CA to trust local certificates."
echo "You'll be prompted for your password once to add it to the system keychain."
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert is not installed. Installing via Homebrew..."
    brew install mkcert
fi

# Install the root CA
echo "📦 Installing mkcert root certificate authority..."
echo "   (This requires your system password once)"
echo ""
mkcert -install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Trusted certificates installed!"
    echo ""
    echo "🎉 Now you can access GraphDone at https://localhost:8443"
    echo "   with NO certificate warnings in ANY browser!"
    echo ""
    echo "Supported browsers:"
    echo "  ✓ Chrome"
    echo "  ✓ Firefox" 
    echo "  ✓ Safari"
    echo "  ✓ Edge"
    echo ""
else
    echo ""
    echo "⚠️  Installation may have been cancelled or failed."
    echo "   To manually install, run: mkcert -install"
fi