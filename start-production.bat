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
echo Starting server: %BACKEND_EXE%
echo Current directory: %CD%
echo.
echo If you see this message and the window closes immediately,
echo the server may have crashed or failed to start.
echo Common issues:
echo - Missing .env file
echo - Database connection problems (check TFCPILOT3 @ 192.168.0.86:49381)
echo - Port 7075 already in use
echo - LDAP connection issues (check 192.168.0.1)
echo.
echo Starting server with real-time logs...
echo Logs will be saved to: logs\server.log
if not exist logs mkdir logs
set RUST_LOG=info,partial_picking_backend=debug
echo.
echo ======== SERVER OUTPUT ========
%BACKEND_EXE%
echo.
echo ======== SERVER STOPPED ========
echo Exit code: %errorlevel%

REM If the server exits, show a message
echo.
echo ========================================
echo Server has stopped or failed to start.
echo Check the error message above.
echo ========================================
echo.
if %errorlevel% neq 0 (
    echo ERROR: Server failed with exit code %errorlevel%
    echo Common solutions:
    echo 1. Check if .env file exists in backend directory
    echo 2. Verify database connection: 192.168.0.86:49381 (TFCPILOT3)
    echo 3. Check if port 7075 is available: netstat -ano ^| findstr :7075
    echo 4. Verify LDAP connection: 192.168.0.1
    echo 5. Check database credentials: NSW / B3sp0k3
    echo 6. Run: cargo check in backend directory for compilation errors
    echo.
)
echo Press any key to close this window...
pause >nul
