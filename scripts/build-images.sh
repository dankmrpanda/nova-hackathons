#!/bin/bash

# Build Docker images for the Codebase Onboarding Agent
# Usage: ./scripts/build-images.sh [version]

set -e

VERSION=${1:-latest}
REGISTRY=${DOCKER_REGISTRY:-""}
PREFIX=${REGISTRY:+$REGISTRY/}

echo "Building Docker images with version: $VERSION"

# Build frontend
echo "Building frontend image..."
docker build -t ${PREFIX}codebase-onboarding-frontend:${VERSION} \
  -f apps/frontend/Dockerfile .

# Build backend
echo "Building backend image..."
docker build -t ${PREFIX}codebase-onboarding-backend:${VERSION} \
  -f apps/backend/Dockerfile .

# Build worker
echo "Building worker image..."
docker build -t ${PREFIX}codebase-onboarding-worker:${VERSION} \
  -f apps/backend/Dockerfile.worker .

# Build migration
echo "Building migration image..."
docker build -t ${PREFIX}codebase-onboarding-migrate:${VERSION} \
  -f apps/backend/Dockerfile.migrate .

echo "All images built successfully!"
echo ""
echo "Images:"
echo "  - ${PREFIX}codebase-onboarding-frontend:${VERSION}"
echo "  - ${PREFIX}codebase-onboarding-backend:${VERSION}"
echo "  - ${PREFIX}codebase-onboarding-worker:${VERSION}"
echo "  - ${PREFIX}codebase-onboarding-migrate:${VERSION}"

# Tag as latest if version is not latest
if [ "$VERSION" != "latest" ]; then
  echo ""
  echo "Tagging images as latest..."
  docker tag ${PREFIX}codebase-onboarding-frontend:${VERSION} ${PREFIX}codebase-onboarding-frontend:latest
  docker tag ${PREFIX}codebase-onboarding-backend:${VERSION} ${PREFIX}codebase-onboarding-backend:latest
  docker tag ${PREFIX}codebase-onboarding-worker:${VERSION} ${PREFIX}codebase-onboarding-worker:latest
  docker tag ${PREFIX}codebase-onboarding-migrate:${VERSION} ${PREFIX}codebase-onboarding-migrate:latest
fi

echo ""
echo "Build complete!"
