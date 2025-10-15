@echo off
REM NWFTH Partial Picking System - Production Deployment Script
REM This script builds both frontend and backend, then starts the server

echo ========================================
echo  NWFTH Partial Picking System
echo  Production Deployment Script
echo ========================================
echo.

echo [1/3] Building Frontend for Production...
echo ========================================
cd /d "%~dp0frontend"

REM Check if npm is available
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm not found! Please install Node.js and npm.
    pause
    exit /b 1
)

REM Build frontend
echo Building React frontend with Vite...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    echo Make sure all dependencies are installed: npm install
    pause
    exit /b 1
)

echo Frontend build completed successfully!
echo.

echo [2/3] Building Backend for Production...
echo ========================================
cd /d "%~dp0backend"

REM Check if cargo is available
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: cargo not found! Please install Rust.
    pause
    exit /b 1
)

REM Build backend
echo Building Rust backend...
cargo build --release
if %errorlevel% neq 0 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)

echo Backend build completed successfully!
echo.

echo [3/3] Starting Production Server...
echo ========================================

REM Check if the executable exists (Windows .exe or Linux binary)
echo Checking for backend executable...
if exist "target\release\partial-picking-backend.exe" (
    set BACKEND_EXE=target\release\partial-picking-backend.exe
    echo Found Windows executable: %BACKEND_EXE%
) else if exist "target\release\partial-picking-backend" (
    set BACKEND_EXE=target\release\partial-picking-backend
    echo Found Linux executable: %BACKEND_EXE%
) else (
    echo ERROR: Backend executable not found!
    echo Checking current directory: %CD%
    echo Looking for:
    echo   - target\release\partial-picking-backend.exe
    echo   - target\release\partial-picking-backend
    dir target\release\ 2>nul || echo target\release\ directory does not exist
    echo Build may have failed.
    pause
    exit /b 1
)

echo Production deployment complete!
echo.
echo Server will be available at:
echo - Frontend Application: http://192.168.0.10:6060/
echo - API Base URL: http://192.168.0.10:7075/api
echo - API Health Check: http://192.168.0.10:7075/api/health
echo - Login Page: http://192.168.0.10:6060/login
echo - Picking Page: http://192.168.0.10:6060/picking
echo.
echo NOTE: Bridge service (WebSocket for weight scales) runs on WORKSTATIONS,
echo       not on this server. Each workstation should run the bridge locally.
echo.
echo Frontend: Built and ready to serve from dist/
echo Backend: Built and starting on port 7075...
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Check environment configuration
echo Checking environment configuration...
if exist ".env" (
    echo Found .env file
) else (
    echo WARNING: .env file not found! Server may fail to start.
    echo Make sure you have a .env file in the backend directory.
    echo Copy .env.example to .env and configure your database credentials.
)
echo.

REM Start both services in single window
set RUST_LOG=info,partial_picking_backend=debug

REM Set absolute paths for backend
set BACKEND_DIR=%~dp0backend
set BACKEND_EXE_FULL=%BACKEND_DIR%target\release\partial-picking-backend.exe
set LOG_FILE=%~dp0logs\backend.log

REM Create logs directory at project root
if not exist "%~dp0logs" mkdir "%~dp0logs"

echo Starting backend server in background (port 7075)...
echo Backend logs will be saved to: logs\backend.log
cd /d "%BACKEND_DIR%"
start "" /B "%BACKEND_EXE_FULL%" > "%LOG_FILE%" 2>&1

echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo Starting frontend server (port 6060)...
cd /d "%~dp0frontend"
echo.
echo ========================================
echo Both services running in this window:
echo - Backend:  http://192.168.0.10:7075/api (background)
echo - Frontend: http://192.168.0.10:6060/ (foreground)
echo ========================================
echo.
echo Backend logs: logs\backend.log
echo Frontend output shown below:
echo.
echo Press Ctrl+C to stop both services
echo ========================================
echo.

REM Run frontend in foreground (this will show output)
npm run preview
