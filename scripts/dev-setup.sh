#!/bin/bash

echo "🚀 Starting Token Indexer Development Environment"
echo "================================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "🐳 Starting required services with Docker Compose..."

# Create docker-compose.yml if it doesn't exist
if [ ! -f docker-compose.yml ]; then
    cat > docker-compose.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: token_indexer
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
EOF
    echo "✅ Docker Compose file created."
fi

# Start services
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
    echo ""
    echo "📊 Service Status:"
    docker-compose ps
    echo ""
    echo "🎯 You can now start the application with:"
    echo "   npm run start:dev"
    echo ""
    echo "📚 API Endpoints:"
    echo "   POST /indexing/start/:contractAddress - Start indexing a contract"
    echo "   GET  /indexing/status/:contractAddress - Get indexing status"
    echo "   GET  /indexing/transfers/:contractAddress - Get transfer history"
    echo "   GET  /indexing/health - Health check"
else
    echo "❌ Failed to start services. Check docker-compose logs:"
    docker-compose logs
fi
