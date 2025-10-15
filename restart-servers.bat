@echo off
REM NWFTH Partial Picking System - Quick Restart Script
REM This script stops existing servers and restarts them

echo ========================================
echo  NWFTH Partial Picking System
echo  Quick Restart Script
echo ========================================
echo.

echo Stopping existing servers...
echo Searching for "Partial Picking" server windows...

REM Kill backend server window
taskkill /FI "WindowTitle eq Partial Picking - Backend*" /F 2>nul
if %errorlevel% equ 0 (
    echo - Backend server stopped
) else (
    echo - Backend server was not running
)

REM Kill frontend server window
taskkill /FI "WindowTitle eq Partial Picking - Frontend*" /F 2>nul
if %errorlevel% equ 0 (
    echo - Frontend server stopped
) else (
    echo - Frontend server was not running
)

echo.
echo Waiting 2 seconds for processes to terminate...
timeout /t 2 /nobreak >nul

echo.
echo Starting servers...
cd /d "%~dp0"
call start-Partial.bat
