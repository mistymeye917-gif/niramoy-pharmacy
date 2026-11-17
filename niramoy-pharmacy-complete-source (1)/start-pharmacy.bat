@echo off
setlocal enabledelayedexpansion
title Niramoy Pharmacy Management System
color 0A

echo ======================================================================
echo             NIRAMOY PHARMACY MANAGEMENT SYSTEM
echo ======================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not found on your Windows computer!
    echo.
    echo Please download and install the LTS version from:
    echo   https://nodejs.org
    echo.
    echo After installing Node.js, run this file again.
    echo.
    pause
    exit /b 1
)

:: 2. Check Node.js version
for /f "tokens=1,2,3 delims=.v " %%a in ('node -v') do set NODE_MAJOR=%%a
echo [OK] Node.js is detected (Version v!NODE_MAJOR!).

if !NODE_MAJOR! lss 22 (
    color 0E
    echo.
    echo ----------------------------------------------------------------------
    echo [ATTENTION] Your current Node.js version is v!NODE_MAJOR!, which is older than v22.
    echo The fast built-in SQLite database requires Node.js v22 or newer.
    echo.
    echo Please update Node.js by downloading the latest LTS from:
    echo   https://nodejs.org
    echo (Just run the installer, it will upgrade your existing version)
    echo ----------------------------------------------------------------------
    echo.
    pause
)

:: 3. Check and install dependencies (npm install)
if not exist "node_modules\" (
    echo.
    echo [INFO] First time setup: Installing necessary components...
    echo (This may take 1-2 minutes depending on your internet speed)
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install components. Please check your internet connection.
        pause
        exit /b 1
    )
)

:: 4. Build frontend assets if missing
if not exist "dist\" (
    echo.
    echo [INFO] Building user interface...
    call npm run build
)

:: 5. Launch the application
echo.
echo ======================================================================
echo [OK] All systems ready!
echo [OK] Opening Niramoy Pharmacy in your browser (http://localhost:3000)...
echo ======================================================================
echo.

:: Open browser
start "" "http://localhost:3000"

:: Start the server
call npm start

pause
