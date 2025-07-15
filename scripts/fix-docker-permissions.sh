#!/bin/bash

echo "🐳 Complete Docker Setup (No Sudo Required)"
echo "==========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "✅ Docker is installed: $(docker --version)"

# Check if Docker daemon is running
if ! systemctl is-active --quiet docker; then
    echo "🔄 Starting Docker daemon..."
    sudo systemctl start docker
    sudo systemctl enable docker
else
    echo "✅ Docker daemon is running"
fi

# Check if docker group exists
if ! getent group docker > /dev/null 2>&1; then
    echo "📝 Creating docker group..."
    sudo groupadd docker
else
    echo "✅ Docker group already exists"
fi

# Add current user to docker group
echo "👤 Adding user '$USER' to docker group..."
sudo usermod -aG docker $USER

# Fix socket permissions if needed
echo "🔧 Checking Docker socket permissions..."
if [ -S /var/run/docker.sock ]; then
    sudo chmod 666 /var/run/docker.sock
    echo "✅ Docker socket permissions updated"
else
    echo "⚠️  Docker socket not found at /var/run/docker.sock"
fi

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Testing Docker access..."

# Test Docker without sudo
if docker ps > /dev/null 2>&1; then
    echo "🎉 SUCCESS! Docker is working without sudo"
    echo ""
    echo "📊 Current Docker status:"
    docker ps
    echo ""
    echo "🚀 You can now run these commands without sudo:"
    echo "   docker ps"
    echo "   docker-compose up -d"
    echo "   docker logs container_name"
    echo "   docker exec -it container_name bash"
else
    echo "⚠️  Docker still requires authentication. Possible solutions:"
    echo ""
    echo "1. Log out and log back in to refresh group membership"
    echo "2. Or restart your computer"
    echo "3. Or run: newgrp docker (then test again)"
    echo ""
    echo "🧪 Manual test after logout/restart:"
    echo "   docker ps"
fi

echo ""
echo "📁 For your token indexer project, you can now run:"
echo "   cd /home/n4beel/Desktop/Projects/token-indexer"
echo "   docker-compose up -d"
