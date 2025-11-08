@echo off
echo ============================================
echo CodeMap - Codebase Onboarding Agent Setup
echo ============================================
echo.

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Starting Docker services...
call docker compose up -d
if errorlevel 1 (
    echo Error: Failed to start Docker services
    echo Make sure Docker Desktop is running
    pause
    exit /b 1
)

echo.
echo Step 3: Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Step 4: Running database migrations...
cd apps\backend
call npm run migrate
if errorlevel 1 (
    echo Warning: Migration may have failed, but continuing...
)
cd ..\..

echo.
echo ============================================
echo Setup complete!
echo ============================================
echo.
echo Next steps:
echo 1. Copy apps\backend\.env.example to apps\backend\.env
echo 2. Add your GitHub OAuth credentials
echo 3. Add your OpenRouter API key
echo 4. Run: npm run dev
echo.
echo Then open http://localhost:3000 in your browser
echo.
pause
