#!/bin/bash

# GraphDone Node.js Auto-Setup Script
# Sets up Node.js using multiple methods for GraphDone development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 GraphDone Node.js Auto-Setup${NC}"
echo "================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Node.js is already available
if command_exists node && command_exists npm; then
    echo -e "${GREEN}✅ Node.js is already installed: $(node --version)${NC}"
    echo -e "${GREEN}✅ npm is available: $(npm --version)${NC}"
    exit 0
fi

echo -e "${YELLOW}⚠️  Node.js not found, installing automatically...${NC}"

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        SHELL_PROFILE="$HOME/.zshrc"  # macOS default shell
        if [ ! -f "$SHELL_PROFILE" ]; then
            SHELL_PROFILE="$HOME/.bash_profile"  # Fallback for older macOS
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        SHELL_PROFILE="$HOME/.bashrc"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OS" == "Windows_NT" ]]; then
        OS="windows"
        # Windows shell profile detection
        if [ -n "$USERPROFILE" ]; then
            # PowerShell profile (preferred)
            SHELL_PROFILE="$USERPROFILE/Documents/PowerShell/Microsoft.PowerShell_profile.ps1"
            # Git Bash profile (fallback)
            if [ ! -f "$SHELL_PROFILE" ]; then
                SHELL_PROFILE="$HOME/.bashrc"
            fi
        else
            SHELL_PROFILE="$HOME/.bashrc"  # Git Bash fallback
        fi
    else
        OS="unknown"
        SHELL_PROFILE="$HOME/.bashrc"
    fi
}

detect_os
echo -e "${CYAN}🖥️  Detected platform: $OS${NC}"

# Platform-specific installation methods
if [ "$OS" = "macos" ]; then
    # macOS Method 1: Try Homebrew
    echo "🔧 Attempting Homebrew installation..."
    if command_exists brew; then
        echo -e "${CYAN}📦 Homebrew found, installing Node.js...${NC}"
        if brew install node; then
            echo -e "${GREEN}✅ Node.js installed via Homebrew successfully${NC}"
            # Verify installation
            if command_exists node; then
                echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                exit 0
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Homebrew not found. Installing Homebrew first...${NC}"
        echo "🔧 Installing Homebrew (this may take a few minutes)..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for current session
        if [[ -x "/opt/homebrew/bin/brew" ]]; then
            # Apple Silicon Mac
            export PATH="/opt/homebrew/bin:$PATH"
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -x "/usr/local/bin/brew" ]]; then
            # Intel Mac
            export PATH="/usr/local/bin:$PATH"
            eval "$(/usr/local/bin/brew shellenv)"
        fi
        
        # Try installing Node.js via newly installed Homebrew
        if command_exists brew && brew install node; then
            echo -e "${GREEN}✅ Node.js installed via Homebrew successfully${NC}"
            if command_exists node; then
                echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                exit 0
            fi
        fi
    fi
    
    # macOS Method 2: Direct download (if Homebrew fails)
    echo -e "${YELLOW}📥 Homebrew installation failed, trying direct download...${NC}"
    echo "🔧 Installing Node.js via official installer..."
    echo "  1. Visit: https://nodejs.org/en/download/"
    echo "  2. Download the macOS installer (.pkg)"
    echo "  3. Run the installer"
    echo "  4. Restart your terminal"
    echo "  5. Run: ./start"
    echo ""
    read -p "Have you installed Node.js? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] && command_exists node; then
        echo -e "${GREEN}✅ Node.js installation confirmed${NC}"
        exit 0
    fi

elif [ "$OS" = "windows" ]; then
    # Windows Method 1: Try Chocolatey
    echo "🔧 Attempting Chocolatey installation..."
    if command_exists choco; then
        echo -e "${CYAN}🍫 Chocolatey found, installing Node.js...${NC}"
        if choco install nodejs -y; then
            # Refresh environment to update PATH
            if command_exists refreshenv; then
                refreshenv
            fi
            # Verify installation
            if command_exists node && command_exists npm; then
                echo -e "${GREEN}✅ Node.js installed via Chocolatey successfully${NC}"
                echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                exit 0
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Chocolatey not found. Installing Chocolatey first...${NC}"
        echo "🔧 Installing Chocolatey (Windows package manager)..."
        echo "This requires Administrator privileges."
        echo ""
        echo "Please run PowerShell as Administrator and execute:"
        echo 'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))'
        echo ""
        read -p "Have you installed Chocolatey? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Try installing Node.js via newly installed Chocolatey
            if command_exists choco && choco install nodejs -y; then
                if command_exists refreshenv; then
                    refreshenv
                fi
                if command_exists node && command_exists npm; then
                    echo -e "${GREEN}✅ Node.js installed via Chocolatey successfully${NC}"
                    echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                    echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                    echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                    exit 0
                fi
            fi
        fi
    fi

    # Windows Method 2: Try Scoop (alternative package manager)
    echo -e "${YELLOW}📦 Chocolatey installation failed, trying Scoop...${NC}"
    if command_exists scoop; then
        echo -e "${CYAN}🪣 Scoop found, installing Node.js...${NC}"
        if scoop install nodejs; then
            # Verify installation
            if command_exists node && command_exists npm; then
                echo -e "${GREEN}✅ Node.js installed via Scoop successfully${NC}"
                echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                exit 0
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Scoop not found. You can install Scoop by running:${NC}"
        echo 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser; irm get.scoop.sh | iex'
        echo ""
        read -p "Try Scoop installation? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Please install Scoop first, then run this script again."
        fi
    fi

    # Windows Method 3: Manual installer download
    echo -e "${YELLOW}📥 Package managers failed, trying manual download...${NC}"
    echo "🔧 Installing Node.js via official Windows installer..."
    echo ""
    echo "Please follow these steps:"
    echo "  1. Visit: https://nodejs.org/en/download/"
    echo "  2. Download the Windows Installer (.msi) - LTS version recommended"
    echo "  3. Run the installer as Administrator"
    echo "  4. Follow the installation wizard (accept defaults)"
    echo "  5. Restart your terminal/command prompt"
    echo "  6. Run: ./start"
    echo ""
    
    # Try to open the download page automatically
    if command_exists powershell; then
        read -p "Open Node.js download page automatically? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            powershell -Command "Start-Process 'https://nodejs.org/en/download/'"
        fi
    fi
    
    read -p "Have you installed Node.js? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] && command_exists node; then
        echo -e "${GREEN}✅ Node.js installation confirmed${NC}"
        exit 0
    fi

elif [ "$OS" = "linux" ]; then
    # Linux Method 1: Try snap without sudo
    echo "🔧 Attempting snap installation (no sudo)..."
    if snap install node --classic 2>/dev/null; then
        echo -e "${GREEN}✅ Node.js installed via snap successfully${NC}"
        export PATH="/snap/bin:$PATH"
        
        # Verify installation
        if command_exists node; then
            echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
            echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
            
            # Update shell profile
            if [ -f "$SHELL_PROFILE" ] && ! grep -q "/snap/bin" "$SHELL_PROFILE"; then
                echo 'export PATH="/snap/bin:$PATH"' >> "$SHELL_PROFILE"
                echo -e "${CYAN}📝 Added /snap/bin to $SHELL_PROFILE${NC}"
            fi
            
            echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
            exit 0
        fi
    fi
    
    # Linux Method 2: Try snap with sudo
    echo -e "${YELLOW}⚠️  Standard snap installation failed${NC}"
    echo "Snap installation requires administrator privileges."
    read -p "Install Node.js via snap with sudo? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔧 Installing Node.js via snap with sudo..."
        if sudo snap install node --classic; then
            echo -e "${GREEN}✅ Node.js installed via snap with sudo${NC}"
            export PATH="/snap/bin:$PATH"
            
            # Verify installation
            if command_exists node; then
                echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                
                # Update shell profile
                if [ -f "$SHELL_PROFILE" ] && ! grep -q "/snap/bin" "$SHELL_PROFILE"; then
                    echo 'export PATH="/snap/bin:$PATH"' >> "$SHELL_PROFILE"
                    echo -e "${CYAN}📝 Added /snap/bin to $SHELL_PROFILE${NC}"
                fi
                
                echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                exit 0
            fi
        fi
    fi

    # Linux Method 3: Try package managers (APT, YUM, DNF)
    if command_exists apt-get; then
        # Debian/Ubuntu systems
        echo -e "${YELLOW}⚠️  Snap installation failed, trying APT package manager...${NC}"
        echo "Node.js installation via APT requires administrator privileges."
        read -p "Install Node.js with APT? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🔧 Installing Node.js via APT..."
            
            # Update package index and install Node.js from NodeSource repository
            echo "📦 Adding NodeSource repository for Node.js 18.x..."
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            
            echo "📦 Installing Node.js and npm..."
            if sudo apt-get install -y nodejs; then
                # Verify installation
                if command_exists node && command_exists npm; then
                    echo -e "${GREEN}✅ Node.js installed via APT successfully${NC}"
                    echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                    echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                    echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                    exit 0
                fi
            else
                echo -e "${YELLOW}⚠️  APT installation failed, trying alternative methods...${NC}"
            fi
        fi
    elif command_exists yum || command_exists dnf; then
        # RedHat/Fedora/CentOS systems
        echo -e "${YELLOW}⚠️  Snap installation failed, trying YUM/DNF package manager...${NC}"
        echo "Node.js installation via YUM/DNF requires administrator privileges."
        read -p "Install Node.js with YUM/DNF? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🔧 Installing Node.js via YUM/DNF..."
            
            # Determine package manager
            PKG_MGR="yum"
            if command_exists dnf; then
                PKG_MGR="dnf"
            fi
            
            # Add NodeSource repository and install
            echo "📦 Adding NodeSource repository for Node.js 18.x..."
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            
            echo "📦 Installing Node.js and npm..."
            if sudo $PKG_MGR install -y nodejs; then
                # Verify installation
                if command_exists node && command_exists npm; then
                    echo -e "${GREEN}✅ Node.js installed via $PKG_MGR successfully${NC}"
                    echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
                    echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
                    echo -e "${GREEN}🎉 Node.js installation completed successfully!${NC}"
                    exit 0
                fi
            else
                echo -e "${YELLOW}⚠️  $PKG_MGR installation failed, trying alternative methods...${NC}"
            fi
        fi
    fi
    
fi  # End of Linux-specific methods

# Universal Method: Fallback to nvm (works on all platforms, no sudo needed)
echo -e "${YELLOW}📦 Falling back to nvm installation (no sudo required)...${NC}"

# Install nvm
if ! command_exists nvm; then
    echo "🔧 Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.4/install.sh | bash

    # Load nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Install Node.js via nvm
if command_exists nvm; then
    echo "🔧 Installing Node.js 18 via nvm..."
    nvm install 18
    nvm use 18
    nvm alias default 18

    if command_exists node; then
        echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"
        echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
        echo -e "${GREEN}🎉 Node.js installation completed via nvm!${NC}"
        exit 0
    fi
fi

# If all methods failed
echo -e "${RED}❌ All installation methods failed${NC}"
echo "Please install Node.js manually:"
echo "  1. Visit: https://nodejs.org/"
echo "  2. Or run: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
exit 1