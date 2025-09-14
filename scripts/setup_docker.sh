#!/bin/bash

# GraphDone Docker Auto-Installation Script
# Installs Docker using platform-specific methods and sets up proper permissions
#
# Installation methods by platform:
# Linux: Snap, Official repository
# macOS: Docker Desktop, Homebrew
# Windows: Docker Desktop (WSL)

set -e

USER=$(whoami)
DOCKER_SOCK="/var/snap/docker/common/var-lib-docker.sock"
DOCKER_SOCK_ALT="/var/run/docker.sock"

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi
}

detect_os

echo "🐳 GraphDone Docker Setup ($OS)"
echo "================================="

# Function to check if Docker is installed
check_docker_installed() {
    if command -v docker &> /dev/null; then
        echo "✅ Docker is already installed: $(docker --version 2>/dev/null || echo 'version unknown')"
        return 0
    else
        echo "❌ Docker is not installed"
        return 1
    fi
}

# Function to install Docker with platform-specific methods
install_docker() {
    echo ""
    echo "🚀 Installing Docker automatically..."

    case $OS in
        "macos")
            install_docker_macos
            ;;
        "linux")
            install_docker_linux
            ;;
        "windows")
            install_docker_windows
            ;;
        *)
            echo "❌ Unsupported operating system: $OSTYPE"
            echo "Please install Docker manually from: https://docs.docker.com/get-docker/"
            return 1
            ;;
    esac
}

# macOS Docker installation
install_docker_macos() {
    echo "🍎 Installing Docker Desktop for macOS..."
    
    # Check if Homebrew is available
    if command -v brew &> /dev/null; then
        echo "🔧 Method 1: Installing Docker Desktop via Homebrew..."
        # Set environment to avoid prompts and timeouts
        export HOMEBREW_NO_AUTO_UPDATE=1
        export HOMEBREW_NO_ENV_HINTS=1
        
        # Check if Docker.app actually exists, even if Homebrew thinks it's installed
        if [ ! -d "/Applications/Docker.app" ]; then
            echo "🔧 Homebrew registry issue detected - forcing reinstall..."
            echo "📥 Docker Desktop will be downloaded (~500MB)"
            echo "🔑 You will be prompted for your password to install system components"
            echo "⚠️  You may see a Gatekeeper warning - this is normal for automated installation"
            echo ""
            
            # Run brew command directly (not in background) so it can handle password prompt
            echo "⏳ Starting installation..."
            echo "🔐 Please enter your password when prompted:"
            echo ""
            
            # Run the actual installation - this will handle password prompt properly
            if brew reinstall --cask docker-desktop --no-quarantine --force || \
               brew install --cask docker-desktop --no-quarantine --force; then
                echo ""
                echo "✅ Homebrew installation completed! 🎉"
                echo ""
                echo "⚠️  Note: The Gatekeeper warning above is normal for automated installation"
                echo ""
            else
                echo "⚠️  Homebrew installation encountered issues"
                # Check if Docker.app was still installed despite the failure
                if [ ! -d "/Applications/Docker.app" ]; then
                    echo "❌ Installation failed - falling back to manual method"
                    return 1
                else
                    echo "✅ Docker.app found - installation appears successful 📦"
                fi
            fi
        else
            echo "📥 Installing Docker Desktop..."
            brew install --cask docker-desktop --no-quarantine --force
        fi
        
        if [ -d "/Applications/Docker.app" ]; then
            echo "✅ Docker Desktop installed successfully"
            echo ""
            echo "🔄 Starting Docker Desktop for the first time..."
            open -a Docker
            echo "🚀 This can take 2-3 minutes on first launch..."
            echo ""
            
            # Wait for Docker daemon to be ready with smooth Braille spinner
            local attempts=0
            local max_attempts=90  # 3 minutes max
            local spinner=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
            local docker_stages=("Initializing Docker" "Loading components" "Starting engine" "Preparing runtime" "Almost ready")
            
            while [ $attempts -lt $max_attempts ]; do
                # Check if docker command is available
                if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
                    printf "\r✅ Docker Desktop is running! 🐳                                          \n"
                    echo ""
                    docker --version
                    return 0
                fi
                
                # Calculate stage and spinner position
                local spinner_idx=$((attempts % 10))
                local stage_idx=$((attempts / 18))  # Change stage every 36 seconds
                if [ $stage_idx -gt 4 ]; then
                    stage_idx=4
                fi
                local elapsed=$((attempts * 2))
                
                # Show smooth Braille spinner with stage message
                printf "\r${spinner[$spinner_idx]} Docker Desktop: ${docker_stages[$stage_idx]}... (${elapsed}s) "
                
                sleep 2
                attempts=$((attempts + 1))
            done
            
            echo "⚠️  Docker Desktop is taking longer than expected to start"
            echo ""
            echo "✅ Docker Desktop is installed successfully! 🎉"
            echo "📋 Next steps:"
            echo "   1. Look for the Docker whale icon 🐳 in your menu bar"
            echo "   2. If you don't see it, open Docker from Applications 📱"
            echo "   3. Wait for Docker to show 'Docker Desktop is running' ✅"
            echo "   4. Then run: ./start 🚀"
            echo ""
            echo "💡 Tip: First startup can take 3-5 minutes depending on your Mac ⏰"
            return 0
        else
            echo "⚠️  Homebrew installation failed, trying manual download..."
        fi
    fi
    
    # Method 2: Direct download
    echo "🔧 Method 2: Manual Docker Desktop installation..."
    echo ""
    echo "📥 Please install Docker Desktop manually:"
    echo "  1. Visit: https://docs.docker.com/desktop/install/mac/ 🌐"
    echo "  2. Download Docker Desktop for Mac ⬇️"
    echo "  3. Install the .dmg file 💾"
    echo "  4. Start Docker Desktop from Applications 🚀"
    echo "  5. Wait for Docker to finish starting ⏳"
    echo "  6. Run: ./start 🎯"
    echo ""
    
    read -p "Have you installed Docker Desktop? (Y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Docker Desktop installation confirmed"
        return 0
    else
        echo "❌ Please install Docker Desktop and run ./start again"
        return 1
    fi
}

# Linux Docker installation (existing logic)
install_docker_linux() {
    # Method 1: Try snap without sudo first
    echo "🔧 Method 1: Attempting snap installation (no sudo)..."
    if snap install docker 2>/dev/null; then
        echo "✅ Docker installed via snap successfully"
        export PATH="/snap/bin:$PATH"
        return 0
    fi

    # Method 2: Snap with sudo (ask permission)
    echo "⚠️  Standard snap installation failed"
    echo "Docker installation requires administrator privileges."
    read -p "Install Docker with sudo via snap? (Y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔧 Method 2: Installing Docker via snap with sudo..."
        if sudo snap install docker; then
            echo "✅ Docker installed via snap with sudo"
            export PATH="/snap/bin:$PATH"
            return 0
        fi
    fi

    # Method 3: Try package manager installation (APT/YUM/DNF)
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu systems
        echo "🔧 Method 3: Trying APT package manager (docker.io)..."
        echo "This installs the distribution's Docker package."
        read -p "Install Docker via APT? (Y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "📦 Installing Docker via APT..."
            if sudo apt-get update && sudo apt-get install -y docker.io docker-compose; then
                # Start Docker service
                sudo systemctl start docker 2>/dev/null || sudo service docker start
                sudo systemctl enable docker 2>/dev/null || true
                echo "✅ Docker installed via APT successfully"
                return 0
            else
                echo "⚠️  APT installation failed, trying official repository..."
            fi
        fi
    elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then
        # RedHat/Fedora/CentOS systems
        echo "🔧 Method 3: Trying YUM/DNF package manager..."
        echo "This installs the distribution's Docker package."
        read -p "Install Docker via YUM/DNF? (Y/N): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            PKG_MGR="yum"
            if command -v dnf &> /dev/null; then
                PKG_MGR="dnf"
            fi
            
            echo "📦 Installing Docker via $PKG_MGR..."
            if sudo $PKG_MGR install -y docker docker-compose; then
                # Start Docker service
                sudo systemctl start docker
                sudo systemctl enable docker
                echo "✅ Docker installed via $PKG_MGR successfully"
                return 0
            else
                echo "⚠️  $PKG_MGR installation failed, trying official repository..."
            fi
        fi
    fi

    # Method 4: Official Docker repository (latest version)
    echo "🔧 Method 4: Installing Docker from official repository (recommended)..."
    echo "This installs the latest Docker version."
    read -p "Install Docker from official repository? (Y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Update package list
        sudo apt-get update

        # Install prerequisites
        sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common

        # Add Docker's official GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

        # Add Docker repository
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        # Update package list again
        sudo apt-get update

        # Install Docker
        if sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
            echo "✅ Docker installed from official repository"
            return 0
        fi
    fi

    # All methods failed
    echo "❌ All Docker installation methods failed"
    echo "Please install Docker manually:"
    echo "  1. Visit: https://docs.docker.com/get-docker/"
    echo "  2. Or run: curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    return 1
}

# Windows Docker installation
install_docker_windows() {
    echo "🪟 Installing Docker Desktop for Windows..."
    echo ""
    echo "📥 Please install Docker Desktop manually:"
    echo "  1. Visit: https://docs.docker.com/desktop/install/windows/"
    echo "  2. Download Docker Desktop for Windows"
    echo "  3. Install the .exe file"
    echo "  4. Restart your computer if prompted"
    echo "  5. Start Docker Desktop"
    echo "  6. Enable WSL 2 integration if using WSL"
    echo "  7. Run: ./start"
    echo ""
    
    read -p "Have you installed Docker Desktop? (Y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "✅ Docker Desktop installation confirmed"
        return 0
    else
        echo "❌ Please install Docker Desktop and run ./start again"
        return 1
    fi
}

# Function to check if Docker daemon is running
check_docker_running() {
    # Try without sudo first (macOS/Docker Desktop doesn't need sudo)
    if docker info &> /dev/null; then
        echo "✅ Docker daemon is running"
        return 0
    # Try with sudo for Linux systems
    elif [ "$OS" = "linux" ] && sudo docker info &> /dev/null; then
        echo "✅ Docker daemon is running"
        return 0
    else
        echo "❌ Docker daemon is not running"
        return 1
    fi
}

# Function to start Docker daemon
start_docker() {
    case $OS in
        "macos")
            echo "🔧 Starting Docker Desktop..."
            open -a Docker
            echo "⏳ Waiting for Docker Desktop to start..."
            
            local attempts=0
            local max_attempts=60
            while [ $attempts -lt $max_attempts ]; do
                if docker info &> /dev/null; then
                    echo "✅ Docker Desktop started successfully"
                    return 0
                fi
                sleep 2
                attempts=$((attempts + 1))
                if [ $((attempts % 15)) -eq 0 ]; then
                    echo "⏳ Still waiting for Docker Desktop..."
                fi
            done
            
            echo "⚠️  Docker Desktop is taking longer than expected to start"
            echo "   Please wait for Docker Desktop to finish starting"
            echo "   You can check the Docker Desktop app in your Applications"
            return 1
            ;;
        "linux")
            echo "🔧 Starting Docker snap service..."
            sudo snap start docker
            sleep 3

            if check_docker_running; then
                echo "✅ Docker daemon started successfully"
            else
                echo "❌ Failed to start Docker daemon"
                exit 1
            fi
            ;;
        *)
            echo "❌ Cannot start Docker automatically on $OS"
            echo "Please start Docker manually"
            return 1
            ;;
    esac
}

# Function to fix Docker permissions (Linux only)
fix_docker_permissions() {
    case $OS in
        "macos")
            echo "✅ Docker Desktop handles permissions automatically on macOS"
            return 0
            ;;
        "linux")
            echo ""
            echo "🔧 Setting up Docker permissions for user: $USER"

            # Create docker group if it doesn't exist (needed for snap Docker)
            if ! getent group docker >/dev/null; then
                echo "🔧 Creating docker group..."
                sudo groupadd docker
            fi

            # Add user to docker group
            echo "📝 Adding $USER to docker group..."
            sudo usermod -aG docker $USER

            # Fix snap docker socket permissions (more permissive for snap)
            if [ -S "$DOCKER_SOCK" ]; then
                echo "🔧 Setting permissions on snap docker socket..."
                sudo chmod 666 "$DOCKER_SOCK"
            fi

            # Fix standard docker socket permissions with proper group ownership
            if [ -S "$DOCKER_SOCK_ALT" ]; then
                echo "🔧 Setting permissions on standard docker socket..."
                sudo chown root:docker "$DOCKER_SOCK_ALT"
                sudo chmod 660 "$DOCKER_SOCK_ALT"
            fi

            # Restart snap docker service to refresh permissions
            echo "🔄 Restarting snap Docker service..."
            sudo snap restart docker

            # Wait for socket to be recreated
            sleep 2

            # Re-fix socket permissions after restart (critical for snap Docker)
            if [ -S "$DOCKER_SOCK_ALT" ]; then
                echo "🔧 Fixing socket ownership after restart..."
                sudo chown root:docker "$DOCKER_SOCK_ALT"
                sudo chmod 660 "$DOCKER_SOCK_ALT"
            fi

            # Also fix snap socket again if it was recreated
            if [ -S "$DOCKER_SOCK" ]; then
                echo "🔧 Re-fixing snap socket after restart..."
                sudo chmod 666 "$DOCKER_SOCK"
            fi

            echo "✅ Docker permissions configured"
            ;;
        *)
            echo "⚠️  Unable to configure Docker permissions on $OS"
            return 0
            ;;
    esac
}

# Function to test Docker access
test_docker_access() {
    echo ""
    echo "🧪 Testing Docker access..."

    if docker ps &> /dev/null; then
        echo "✅ Docker is working!"
        return 0
    fi

    case $OS in
        "macos")
            echo "⚠️  Docker Desktop may still be starting up"
            echo "   Please wait for Docker Desktop to finish starting"
            echo "   You can check the Docker Desktop app in your Applications"
            echo "   Then run: ./start"
            return 1
            ;;
        "linux")
            echo "🔄 Testing group changes..."
            # Check if user is in docker group
            if id -nG "$USER" | grep -qw docker; then
                echo "✅ User successfully added to docker group"

                # Try docker test (might work immediately after group add)
                if docker ps &> /dev/null; then
                    echo "✅ Docker is working immediately!"
                    return 0
                fi

                echo "⚠️  Docker group membership set but socket access blocked"
                echo "🔧 Applying direct socket permissions..."

                # Apply direct socket permissions as immediate fix
                if [ -S "/var/run/docker.sock" ]; then
                    sudo chmod 666 /var/run/docker.sock
                    echo "✅ Applied direct socket permissions"

                    # Test if this fixed the issue
                    if docker ps &> /dev/null; then
                        echo "✅ Docker is working with direct permissions!"
                        return 0
                    fi
                fi

                echo "⚠️  Docker permissions still require a new terminal session"
                echo ""
                echo "To complete setup:"
                echo "  1. Close this terminal"
                echo "  2. Open a new terminal"
                echo "  3. Run: ./start"
                echo "  4. Test with: docker ps"
                return 0  # Success - user was added to group
            else
                echo "❌ User not found in docker group - attempting to fix..."

                # Try to fix the issue automatically
                echo "🔧 Attempting to recreate docker group and add user..."

                # Ensure docker group exists and add user (with error handling)
                if sudo groupadd docker 2>/dev/null || true; then
                    echo "✅ Docker group created/verified"
                fi

                if sudo usermod -aG docker "$USER"; then
                    echo "✅ User added to docker group successfully"

                    # Verify the fix worked
                    if id -nG "$USER" | grep -qw docker; then
                        echo "✅ Group membership verified"
                        echo "⚠️  Docker permissions require a new terminal session"
                    else
                        echo "❌ Group add still failed - trying alternative method..."

                        # Alternative method: direct socket permissions
                        echo "🔧 Using alternative permission method..."
                        if [ -S "/var/run/docker.sock" ]; then
                            sudo chmod 666 /var/run/docker.sock
                            echo "✅ Applied direct socket permissions"

                            # Test if this worked
                            if docker ps &> /dev/null; then
                                echo "✅ Docker is working with direct permissions!"
                                return 0
                            fi
                        fi

                        echo "❌ All automatic fixes failed"
                        echo "Manual steps required:"
                        echo "  1. sudo groupadd docker"
                        echo "  2. sudo usermod -aG docker $USER"
                        echo "  3. sudo chmod 666 /var/run/docker.sock"
                        echo "  4. Open new terminal and run: ./start"
                        return 1
                    fi
                else
                    echo "❌ Failed to add user to docker group"
                    return 1
                fi
            fi
            echo ""
            echo "To complete setup:"
            echo "  1. Close this terminal"
            echo "  2. Open a new terminal"
            echo "  3. Run: ./start"
            echo "  4. Test with: docker ps"
            return 1
            ;;
        *)
            echo "❌ Unable to test Docker access on $OS"
            return 1
            ;;
    esac
}

# Function to check if we can run sudo commands
check_sudo_access() {
    # Check if we have sudo privileges without prompting
    if sudo -n true 2>/dev/null; then
        return 0  # We can sudo without password
    else
        return 1  # Need password for sudo
    fi
}

# Function to request sudo access upfront
request_sudo() {
    echo ""
    echo "🔐 Docker setup requires administrator privileges"
    echo "Please enter your password to proceed with Docker setup:"

    # Request sudo access and cache credentials
    if sudo -v; then
        echo "✅ Administrator access granted"
        return 0
    else
        echo "❌ Administrator access denied"
        return 1
    fi
}

# Main execution
main() {
    echo "🔍 Checking Docker installation..."

    if ! check_docker_installed; then
        # For macOS with Homebrew, we might not need sudo
        if [ "$OS" != "macos" ] || ! command -v brew &> /dev/null; then
            if ! check_sudo_access; then
                if ! request_sudo; then
                    echo "❌ Cannot proceed without administrator privileges"
                    exit 1
                fi
            fi
        fi
        install_docker
    fi

    echo ""
    echo "🔍 Checking Docker daemon..."

    if ! check_docker_running; then
        # For macOS, we don't need sudo to start Docker Desktop
        if [ "$OS" != "macos" ]; then
            if ! check_sudo_access; then
                if ! request_sudo; then
                    echo "❌ Cannot start Docker without administrator privileges"
                    exit 1
                fi
            fi
        fi
        start_docker
    fi

    echo ""
    echo "🔍 Checking Docker permissions..."

    if ! docker ps &> /dev/null 2>&1; then
        if [ "$OS" = "macos" ]; then
            echo "⚠️  Docker Desktop may still be starting up or needs manual launch"
        else
            echo "❌ Docker requires permission setup"
            # Need sudo for permission fixes on Linux
            if ! check_sudo_access; then
                if ! request_sudo; then
                    echo "❌ Cannot fix Docker permissions without administrator privileges"
                    exit 1
                fi
            fi
        fi

        fix_docker_permissions
        test_docker_access
    else
        echo "✅ Docker permissions are already configured"
    fi

    echo ""
    echo "🎉 Docker setup complete!"
    echo ""
    if docker ps &> /dev/null; then
        echo "✅ Docker is ready to use!"
        docker --version
    else
        case $OS in
            "macos")
                echo "⚠️  Please start Docker Desktop from your Applications folder"
                echo "   Then run: ./start"
                ;;
            "linux")
                echo "⚠️  Open a new terminal to use Docker without sudo"
                ;;
            *)
                echo "⚠️  Please ensure Docker is running and try again"
                ;;
        esac
    fi
}

main "$@"