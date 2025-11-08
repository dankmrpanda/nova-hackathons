#!/bin/bash

# Push Docker images to registry
# Usage: ./scripts/push-images.sh [version]

set -e

VERSION=${1:-latest}
REGISTRY=${DOCKER_REGISTRY}

if [ -z "$REGISTRY" ]; then
  echo "Error: DOCKER_REGISTRY environment variable is not set"
  echo "Usage: DOCKER_REGISTRY=your-registry.com ./scripts/push-images.sh [version]"
  exit 1
fi

echo "Pushing Docker images to $REGISTRY with version: $VERSION"

# Push images
echo "Pushing frontend image..."
docker push ${REGISTRY}/codebase-onboarding-frontend:${VERSION}

echo "Pushing backend image..."
docker push ${REGISTRY}/codebase-onboarding-backend:${VERSION}

echo "Pushing worker image..."
docker push ${REGISTRY}/codebase-onboarding-worker:${VERSION}

echo "Pushing migration image..."
docker push ${REGISTRY}/codebase-onboarding-migrate:${VERSION}

# Push latest tags if version is not latest
if [ "$VERSION" != "latest" ]; then
  echo ""
  echo "Pushing latest tags..."
  docker push ${REGISTRY}/codebase-onboarding-frontend:latest
  docker push ${REGISTRY}/codebase-onboarding-backend:latest
  docker push ${REGISTRY}/codebase-onboarding-worker:latest
  docker push ${REGISTRY}/codebase-onboarding-migrate:latest
fi

echo ""
echo "Push complete!"
