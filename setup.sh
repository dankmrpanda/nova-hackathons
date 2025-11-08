#!/bin/bash

echo "============================================"
echo "CodeMap - Codebase Onboarding Agent Setup"
echo "============================================"
echo

echo "Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: Failed to install dependencies"
    exit 1
fi

echo
echo "Step 2: Starting Docker services..."
docker compose up -d
if [ $? -ne 0 ]; then
    echo "Error: Failed to start Docker services"
    echo "Make sure Docker is running"
    exit 1
fi

echo
echo "Step 3: Waiting for services to be ready..."
sleep 10

echo
echo "Step 4: Running database migrations..."
cd apps/backend
npm run migrate
if [ $? -ne 0 ]; then
    echo "Warning: Migration may have failed, but continuing..."
fi
cd ../..

echo
echo "============================================"
echo "Setup complete!"
echo "============================================"
echo
echo "Next steps:"
echo "1. Copy apps/backend/.env.example to apps/backend/.env"
echo "2. Add your GitHub OAuth credentials"
echo "3. Add your OpenRouter API key"
echo "4. Run: npm run dev"
echo
echo "Then open http://localhost:3000 in your browser"
echo
