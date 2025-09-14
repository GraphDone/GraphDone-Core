#!/bin/bash

# GraphDone Docker Auto-Installation Script
# Installs Docker using multiple methods and sets up proper permissions
#
# Installation methods (tried in order):
# 1. Snap (no sudo) - fastest, safest
# 2. Snap (with sudo) - requires password
# 3. Official Docker repository - most reliable, requires sudo

set -e

USER=$(whoami)
DOCKER_SOCK="/var/snap/docker/common/var-lib-docker.sock"
DOCKER_SOCK_ALT="/var/run/docker.sock"

echo "🐳 GraphDone Docker Setup (Snap)"
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

# Function to install Docker with multiple methods
install_docker() {
    echo ""
    echo "🚀 Installing Docker automatically..."

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
    read -p "Install Docker with sudo via snap? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔧 Method 2: Installing Docker via snap with sudo..."
        if sudo snap install docker; then
            echo "✅ Docker installed via snap with sudo"
            export PATH="/snap/bin:$PATH"
            return 0
        fi
    fi

    # Method 3: Official Docker repository
    echo "🔧 Method 3: Installing Docker from official repository..."
    echo "This requires sudo privileges..."
    read -p "Install Docker from official repository? (y/N): " -n 1 -r
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

# Function to check if Docker daemon is running
check_docker_running() {
    if sudo docker info &> /dev/null; then
        echo "✅ Docker daemon is running"
        return 0
    else
        echo "❌ Docker daemon is not running"
        return 1
    fi
}

# Function to start Docker daemon
start_docker() {
    echo "🔧 Starting Docker snap service..."
    sudo snap start docker
    sleep 3

    if check_docker_running; then
        echo "✅ Docker daemon started successfully"
    else
        echo "❌ Failed to start Docker daemon"
        exit 1
    fi
}

# Function to fix Docker permissions for snap
fix_docker_permissions() {
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

    # Fix snap docker socket permissions if it exists
    if [ -S "$DOCKER_SOCK" ]; then
        echo "🔧 Setting permissions on snap docker socket..."
        sudo chmod 666 "$DOCKER_SOCK"
    fi

    # Fix standard docker socket permissions if it exists
    if [ -S "$DOCKER_SOCK_ALT" ]; then
        echo "🔧 Setting permissions on standard docker socket..."
        sudo chown root:docker "$DOCKER_SOCK_ALT"
        sudo chmod 660 "$DOCKER_SOCK_ALT"
    fi

    # Restart snap docker service
    echo "🔄 Restarting snap Docker service..."
    sudo snap restart docker
    sleep 3

    # Re-fix socket permissions after restart (critical for snap)
    if [ -S "$DOCKER_SOCK_ALT" ]; then
        echo "🔧 Fixing socket ownership after restart..."
        sudo chown root:docker "$DOCKER_SOCK_ALT"
        sudo chmod 660 "$DOCKER_SOCK_ALT"
    fi

    echo "✅ Docker permissions configured"
}

# Function to test Docker access
test_docker_access() {
    echo ""
    echo "🧪 Testing Docker access..."

    if docker ps &> /dev/null; then
        echo "✅ Docker is working without sudo!"
        return 0
    fi

    echo "🔄 Testing group changes..."
    # Check if user is in docker group
    if id -nG "$USER" | grep -qw docker; then
        echo "✅ User successfully added to docker group"

        # Try docker test (might work immediately after group add)
        if docker ps &> /dev/null; then
            echo "✅ Docker is working immediately!"
            return 0
        fi

        echo "⚠️  Docker permissions require a new terminal session"
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
        # Need sudo for installation
        if ! check_sudo_access; then
            if ! request_sudo; then
                echo "❌ Cannot proceed without administrator privileges"
                exit 1
            fi
        fi
        install_docker
    fi

    echo ""
    echo "🔍 Checking Docker daemon..."

    if ! check_docker_running; then
        # Need sudo to start Docker
        if ! check_sudo_access; then
            if ! request_sudo; then
                echo "❌ Cannot start Docker without administrator privileges"
                exit 1
            fi
        fi
        start_docker
    fi

    echo ""
    echo "🔍 Checking Docker permissions..."

    if ! docker ps &> /dev/null 2>&1; then
        echo "❌ Docker requires permission setup"

        # Need sudo for permission fixes
        if ! check_sudo_access; then
            if ! request_sudo; then
                echo "❌ Cannot fix Docker permissions without administrator privileges"
                exit 1
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
        echo "⚠️  Open a new terminal to use Docker without sudo"
    fi
}

main "$@"