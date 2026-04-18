@echo off
setlocal
title AETHER Launcher Server
set PORT=8080

echo ======================================================
echo    🚀 AETHER PRO GAME HUB - HIGH-FIDELITY DEV
echo ======================================================
echo.

:: 1. Check for Custom Node.js Dev Server (Top Priority: Hot Reload)
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    if exist "server.js" (
        echo [SYSTEM] Detected Custom AETHER Dev Server with Hot-Reload.
        echo [ACTION] Initializing Dev Monitoring on port %PORT%...
        start http://localhost:%PORT%
        node server.js
        goto :eof
    )
)

:: 2. Check for npx serve (Secondary)
where npx >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [SYSTEM] Detected Node.js environment.
    echo [ACTION] Launching Static Server on port %PORT%...
    start http://localhost:%PORT%
    npx serve -l %PORT% .
    goto :eof
)

:: 3. Check for Python (Third)
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [SYSTEM] Detected Python environment.
    echo [ACTION] Launching HTTP Server on port %PORT%...
    start http://localhost:%PORT%
    python -m http.server %PORT%
    goto :eof
)

:: Error Fallback
echo [CRITICAL] No compatible server runtime found (Node.js or Python).
echo [REQUIRED] Please install Node.js (https://nodejs.org) for Hot Reload support.
echo.
pause
