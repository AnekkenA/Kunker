@echo off
cd /d "%~dp0"
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ssh.exe >nul 2>&1
if exist "bin\node.exe" (
    "bin\node.exe" "server\launcher.js"
) else (
    node "server\launcher.js"
)
pause
