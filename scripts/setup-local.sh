#!/bin/bash

# Local development setup script
set -e

echo "🚀 Setting up Codebase Onboarding Agent for local development..."
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ All prerequisites met!"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your API keys if needed."
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed!"
echo ""

# Start infrastructure services
echo "🐳 Starting infrastructure services (PostgreSQL, Redis, MinIO)..."
docker-compose -f docker-compose.dev.yml up -d
echo "✅ Infrastructure services started!"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are healthy
echo "🔍 Checking service health..."

if docker ps | grep -q "onboarding-postgres-dev"; then
    echo "✅ PostgreSQL is running"
else
    echo "❌ PostgreSQL failed to start"
    exit 1
fi

if docker ps | grep -q "onboarding-redis-dev"; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
    exit 1
fi

if docker ps | grep -q "onboarding-minio-dev"; then
    echo "✅ MinIO is running"
else
    echo "❌ MinIO failed to start"
    exit 1
fi

echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
cd apps/backend
npm run migrate || echo "⚠️  Migrations failed or already applied"
cd ../..
echo "✅ Database setup complete!"
echo ""

# Success message
echo "🎉 Setup complete!"
echo ""
echo "📍 Services running:"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo "   - MinIO API: localhost:9000"
echo "   - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "🚀 Next steps:"
echo "   1. Start backend: cd apps/backend && npm run dev"
echo "   2. Start frontend: cd apps/frontend && npm run dev"
echo "   3. Access app at: http://localhost:3000"
echo ""
echo "📚 For more info, see LOCAL_SETUP.md"
echo ""
echo "🛑 To stop services: npm run docker:dev:down"
echo "🧹 To clean up: npm run docker:clean"
