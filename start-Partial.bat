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

REM Start the backend server with logging
set RUST_LOG=info,partial_picking_backend=debug
if not exist logs mkdir logs

echo Starting backend server on port 7075...
start "Partial Picking - Backend" powershell -NoExit -Command "cd '%~dp0backend'; $env:RUST_LOG='info,partial_picking_backend=debug'; .\target\release\partial-picking-backend.exe"

echo Waiting 3 seconds for backend to initialize...
timeout /t 3 /nobreak >nul

echo Starting frontend server on port 6060...
cd /d "%~dp0frontend"
start "Partial Picking - Frontend" powershell -NoExit -Command "cd '%~dp0frontend'; npm run preview"

echo.
echo ========================================
echo Both servers are starting in separate windows:
echo - Backend:  http://192.168.0.10:7075/api
echo - Frontend: http://192.168.0.10:6060/
echo ========================================
echo.
echo IMPORTANT:
echo - Two PowerShell windows will open (one for each service)
echo - Check each window for startup status
echo - To stop a service, close its respective window
echo - Or press Ctrl+C in the service window
echo.
echo Common issues:
echo - Missing .env file in backend directory
echo - Database connection problems (check TFCPILOT3 @ 192.168.0.86:49381)
echo - Port 7075 already in use (backend)
echo - Port 6060 already in use (frontend)
echo - LDAP connection issues (check 192.168.0.1)
echo.
echo You can close this window after verifying both servers started successfully.
echo The services will continue running in their own windows.
echo.
echo Press any key to close this launcher window...
pause >nul
