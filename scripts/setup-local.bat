@echo off
REM Local development setup script for Windows
setlocal enabledelayedexpansion

echo 🚀 Setting up Codebase Onboarding Agent for local development...
echo.

REM Check prerequisites
echo 📋 Checking prerequisites...

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

where docker-compose >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

echo ✅ All prerequisites met!
echo.

REM Check if .env exists
if not exist .env (
    echo 📝 Creating .env file from .env.example...
    copy .env.example .env
    echo ✅ .env file created. Please edit it with your API keys if needed.
    echo.
) else (
    echo ✅ .env file already exists
    echo.
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install
echo ✅ Dependencies installed!
echo.

REM Start infrastructure services
echo 🐳 Starting infrastructure services (PostgreSQL, Redis, MinIO)...
docker-compose -f docker-compose.dev.yml up -d
echo ✅ Infrastructure services started!
echo.

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Check if services are healthy
echo 🔍 Checking service health...

docker ps | findstr "onboarding-postgres-dev" >nul
if %errorlevel% equ 0 (
    echo ✅ PostgreSQL is running
) else (
    echo ❌ PostgreSQL failed to start
    exit /b 1
)

docker ps | findstr "onboarding-redis-dev" >nul
if %errorlevel% equ 0 (
    echo ✅ Redis is running
) else (
    echo ❌ Redis failed to start
    exit /b 1
)

docker ps | findstr "onboarding-minio-dev" >nul
if %errorlevel% equ 0 (
    echo ✅ MinIO is running
) else (
    echo ❌ MinIO failed to start
    exit /b 1
)

echo.

REM Run database migrations
echo 🗄️  Running database migrations...
cd apps\backend
call npm run migrate
cd ..\..
echo ✅ Database setup complete!
echo.

REM Success message
echo 🎉 Setup complete!
echo.
echo 📍 Services running:
echo    - PostgreSQL: localhost:5432
echo    - Redis: localhost:6379
echo    - MinIO API: localhost:9000
echo    - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
echo.
echo 🚀 Next steps:
echo    1. Start backend: cd apps\backend ^&^& npm run dev
echo    2. Start frontend: cd apps\frontend ^&^& npm run dev
echo    3. Access app at: http://localhost:3000
echo.
echo 📚 For more info, see LOCAL_SETUP.md
echo.
echo 🛑 To stop services: npm run docker:dev:down
echo 🧹 To clean up: npm run docker:clean
