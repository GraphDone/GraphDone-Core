#!/bin/bash

set -e

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

ENV_FILE="packages/server/.env"

# Header
clear
echo -e "${PURPLE}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           🔐  GraphDone OAuth Setup Helper  🔐               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${CYAN}This wizard will help you set up OAuth social login for:${NC}"
echo -e "  ${GREEN}✓${NC} Google"
echo -e "  ${GREEN}✓${NC} GitHub"
echo -e "  ${GREEN}✓${NC} LinkedIn"
echo ""
echo -e "${YELLOW}⏱️  Total time: ~12 minutes (Google: 5min, GitHub: 2min, LinkedIn: 5min)${NC}"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: $ENV_FILE not found!${NC}"
    echo -e "${YELLOW}💡 Run this script from the GraphDone project root directory.${NC}"
    exit 1
fi

# Check current OAuth status
echo -e "${CYAN}Checking current OAuth configuration...${NC}"
if grep -q "GOOGLE_CLIENT_ID=" "$ENV_FILE" && ! grep -q "GOOGLE_CLIENT_ID=$" "$ENV_FILE" && ! grep -q 'GOOGLE_CLIENT_ID=""' "$ENV_FILE"; then
    echo -e "${GREEN}✓ OAuth credentials already configured${NC}"
    echo ""
    read -p "Do you want to update existing OAuth credentials? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}👋 Exiting. Your existing OAuth configuration is unchanged.${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}⚠️  OAuth not configured yet${NC}"
fi
echo ""

# Main menu
echo -e "${BOLD}What would you like to do?${NC}"
echo ""
echo "  1) 📖 View step-by-step setup instructions"
echo "  2) ✏️  Manually edit .env file"
echo "  3) 🧪 Add test credentials (OAuth buttons visible but non-functional)"
echo "  4) ❌ Exit"
echo ""
read -p "Choose an option (1-4): " choice

case $choice in
    1)
        # Detailed instructions
        clear
        echo -e "${PURPLE}${BOLD}📖 OAuth Setup Instructions${NC}"
        echo "══════════════════════════════════════════════════════════════"
        echo ""

        echo -e "${GREEN}${BOLD}1️⃣  Google OAuth (5 minutes)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo "  a) Visit: https://console.cloud.google.com/"
        echo "  b) Create a new project or select existing"
        echo "  c) Click ☰ → 'APIs & Services' → 'Credentials'"
        echo "  d) Click '+ CREATE CREDENTIALS' → 'OAuth client ID'"
        echo "  e) If prompted, configure OAuth consent screen:"
        echo "     • User Type: External"
        echo "     • App name: GraphDone Local"
        echo "     • User support email: your email"
        echo "  f) Application type: 'Web application'"
        echo "  g) Name: GraphDone Local Dev"
        echo "  h) Authorized redirect URIs → Add:"
        echo -e "     ${YELLOW}https://localhost:4128/auth/google/callback${NC}"
        echo "  i) Click CREATE and copy Client ID & Secret"
        echo ""

        echo -e "${GREEN}${BOLD}2️⃣  GitHub OAuth (2 minutes)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo "  a) Visit: https://github.com/settings/developers"
        echo "  b) Click 'OAuth Apps' → 'New OAuth App'"
        echo "  c) Fill in:"
        echo "     • Application name: GraphDone Local"
        echo "     • Homepage URL: http://localhost:3127"
        echo "     • Authorization callback URL:"
        echo -e "       ${YELLOW}https://localhost:4128/auth/github/callback${NC}"
        echo "  d) Click 'Register application'"
        echo "  e) Copy Client ID"
        echo "  f) Click 'Generate a new client secret' and copy it"
        echo ""

        echo -e "${GREEN}${BOLD}3️⃣  LinkedIn OAuth (5 minutes)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo "  a) Visit: https://www.linkedin.com/developers/apps"
        echo "  b) Click 'Create app'"
        echo "  c) Fill in:"
        echo "     • App name: GraphDone Local"
        echo "     • LinkedIn Page: Select or create"
        echo "     • Check 'I have read and agree to these terms'"
        echo "  d) Click 'Create app'"
        echo "  e) Go to 'Auth' tab"
        echo "  f) Under 'Authorized redirect URLs' → Add redirect URL:"
        echo -e "     ${YELLOW}https://localhost:4128/auth/linkedin/callback${NC}"
        echo "  g) Click 'Update'"
        echo "  h) Go to 'Products' tab → Find 'Sign In with LinkedIn'"
        echo "  i) Click 'Request access' (usually auto-approved)"
        echo "  j) Return to 'Auth' tab and copy Client ID & Secret"
        echo ""

        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${BOLD}📝 Add these to ${YELLOW}packages/server/.env${NC}${BOLD}:${NC}"
        echo ""
        cat << 'ENVEXAMPLE'
# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://localhost:4128/auth/google/callback

# OAuth - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=https://localhost:4128/auth/github/callback

# OAuth - LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_CALLBACK_URL=https://localhost:4128/auth/linkedin/callback
ENVEXAMPLE
        echo ""
        echo -e "${YELLOW}⚡ Quick tip: You can start with just Google OAuth to test!${NC}"
        echo ""
        echo -e "${GREEN}🔄 After adding credentials, restart: ${BOLD}./start${NC}"
        echo ""

        read -p "Would you like to edit the .env file now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${CYAN}Opening $ENV_FILE...${NC}"
            sleep 1
            ${EDITOR:-nano} "$ENV_FILE"
            echo ""
            echo -e "${GREEN}✅ File saved! Restart GraphDone with: ${BOLD}./start${NC}"
        fi
        ;;

    2)
        # Direct edit
        echo ""
        echo -e "${CYAN}Opening $ENV_FILE for editing...${NC}"
        echo -e "${YELLOW}💡 Refer to docs/oauth-setup-guide.md for detailed setup steps${NC}"
        sleep 2
        ${EDITOR:-nano} "$ENV_FILE"
        echo ""
        echo -e "${GREEN}✅ File saved! Restart GraphDone with: ${BOLD}./start${NC}"
        ;;

    3)
        # Test credentials
        echo ""
        echo -e "${YELLOW}${BOLD}⚠️  Warning: Test Credentials${NC}"
        echo ""
        echo "This will add placeholder OAuth credentials that:"
        echo -e "  ${GREEN}✓${NC} Make OAuth buttons visible in the UI"
        echo -e "  ${RED}✗${NC} Won't actually authenticate users"
        echo ""
        echo "Use this only for:"
        echo "  • UI testing and development"
        echo "  • Screenshots and demos"
        echo "  • Verifying button placement"
        echo ""
        read -p "Continue? (y/n) " -n 1 -r
        echo

        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${CYAN}Cancelled. No changes made.${NC}"
            exit 0
        fi

        # Backup existing .env
        cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${GREEN}✓ Created backup of .env${NC}"

        # Add test credentials if not present
        if ! grep -q "GOOGLE_CLIENT_ID=" "$ENV_FILE"; then
            cat >> "$ENV_FILE" << 'EOF'

# OAuth Test Credentials (UI testing only - won't authenticate)
GOOGLE_CLIENT_ID=test-google-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=test-google-secret
GOOGLE_CALLBACK_URL=https://localhost:4128/auth/google/callback

GITHUB_CLIENT_ID=test-github-id
GITHUB_CLIENT_SECRET=test-github-secret
GITHUB_CALLBACK_URL=https://localhost:4128/auth/github/callback

LINKEDIN_CLIENT_ID=test-linkedin-id
LINKEDIN_CLIENT_SECRET=test-linkedin-secret
LINKEDIN_CALLBACK_URL=https://localhost:4128/auth/linkedin/callback
EOF
            echo -e "${GREEN}✓ Test credentials added to $ENV_FILE${NC}"
        else
            echo -e "${YELLOW}ℹ️  OAuth credentials already present in $ENV_FILE${NC}"
        fi

        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}Next steps:${NC}"
        echo -e "  1. Restart GraphDone: ${GREEN}./start${NC}"
        echo -e "  2. Visit: ${CYAN}https://localhost:3128${NC}"
        echo -e "  3. OAuth buttons should now be visible"
        echo -e "  4. Replace with real credentials when ready"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        ;;

    4)
        echo -e "${CYAN}👋 Exiting. No changes made.${NC}"
        exit 0
        ;;

    *)
        echo -e "${RED}❌ Invalid option. Exiting.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}${BOLD}✅ Setup complete!${NC}"
echo ""
echo -e "${CYAN}📚 For more details, see: ${YELLOW}docs/oauth-setup-guide.md${NC}"
echo ""
