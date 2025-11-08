.PHONY: help setup start stop restart logs clean test build

# Default target
help:
	@echo "Codebase Onboarding Agent - Local Development"
	@echo ""
	@echo "Available commands:"
	@echo "  make setup      - Initial setup (install deps, start services, run migrations)"
	@echo "  make start      - Start infrastructure services"
	@echo "  make stop       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo "  make logs       - View service logs"
	@echo "  make clean      - Stop services and remove volumes"
	@echo "  make test       - Run tests"
	@echo "  make build      - Build all applications"
	@echo "  make dev        - Start development servers"
	@echo ""

# Initial setup
setup:
	@echo "🚀 Setting up local development environment..."
	@cp -n .env.example .env || true
	@npm install
	@docker-compose -f docker-compose.dev.yml up -d
	@echo "⏳ Waiting for services to start..."
	@sleep 10
	@cd apps/backend && npm run migrate
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Run 'make dev' to start development servers"

# Start infrastructure services
start:
	@echo "🐳 Starting infrastructure services..."
	@docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Services started!"

# Stop all services
stop:
	@echo "🛑 Stopping services..."
	@docker-compose -f docker-compose.dev.yml down
	@echo "✅ Services stopped!"

# Restart services
restart: stop start

# View logs
logs:
	@docker-compose -f docker-compose.dev.yml logs -f

# Clean up (remove volumes)
clean:
	@echo "🧹 Cleaning up..."
	@docker-compose -f docker-compose.dev.yml down -v
	@echo "✅ Cleanup complete!"

# Run tests
test:
	@npm test

# Build applications
build:
	@npm run build

# Start development servers
dev:
	@echo "🚀 Starting development servers..."
	@echo "Backend will run on http://localhost:3000"
	@echo "Frontend will run on http://localhost:5173"
	@echo ""
	@echo "Press Ctrl+C to stop"
	@npm run dev

# Database migrations
migrate:
	@cd apps/backend && npm run migrate

# Docker full stack
docker-up:
	@docker-compose up -d

docker-down:
	@docker-compose down

docker-logs:
	@docker-compose logs -f

# Lint and format
lint:
	@npm run lint

format:
	@npm run format

# Health check
health:
	@echo "Checking service health..."
	@curl -s http://localhost:3000/health || echo "Backend not responding"
	@curl -s http://localhost:9000/minio/health/live || echo "MinIO not responding"
	@docker exec onboarding-postgres-dev pg_isready -U postgres || echo "PostgreSQL not responding"
	@docker exec onboarding-redis-dev redis-cli ping || echo "Redis not responding"
