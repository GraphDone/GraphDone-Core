#!/bin/bash

# GraphDone Docker Setup Script
# Installs Docker via snap and sets up proper permissions

set -e

USER=$(whoami)
DOCKER_SOCK="/var/snap/docker/common/var-lib-docker.sock"
DOCKER_SOCK_ALT="/var/run/docker.sock"

echo "🐳 GraphDone Docker Setup (Snap)"
echo "================================="

# Function to check if Docker is installed
check_docker_installed() {
    if command -v docker &> /dev/null; then
        echo "✅ Docker is already installed"
        return 0
    else
        echo "❌ Docker is not installed"
        return 1
    fi
}

# Function to install Docker via snap
install_docker() {
    echo ""
    echo "🚀 Installing Docker via snap..."
    echo "This may take a few minutes..."

    sudo snap install docker

    echo "✅ Docker installed via snap"
    sleep 2
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

    echo "🔄 Applying group changes with newgrp..."
    if newgrp docker -c 'docker ps' &> /dev/null; then
        echo "✅ Docker is working after group refresh!"
        return 0
    fi

    echo "⚠️  Docker permissions require a new terminal session"
    echo "Please open a new terminal and test: docker ps"
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