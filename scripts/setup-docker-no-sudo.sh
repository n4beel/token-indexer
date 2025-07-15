#!/bin/bash

echo "🐳 Setting up Docker to run without sudo"
echo "======================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
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

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "📋 Important Notes:"
echo "   1. You need to log out and log back in (or restart) for changes to take effect"
echo "   2. Alternatively, you can run: newgrp docker"
echo "   3. After that, you should be able to run 'docker' commands without sudo"
echo ""
echo "🧪 Testing Docker access..."
echo ""

# Test if docker can be run without sudo
if groups $USER | grep -q '\bdocker\b'; then
    echo "✅ User is now in docker group"
    echo ""
    echo "🔄 To apply changes immediately without logout, run:"
    echo "   newgrp docker"
    echo ""
    echo "🧪 Then test with:"
    echo "   docker --version"
    echo "   docker ps"
else
    echo "⚠️  User added to group, but changes not yet applied"
    echo "   Please log out and log back in, or run 'newgrp docker'"
fi

echo ""
echo "🚀 Once active, you can run docker commands like:"
echo "   docker-compose up -d"
echo "   docker ps"
echo "   docker logs container_name"
