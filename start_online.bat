@echo off
cd /d "%~dp0"
title Bunker: Vault 101
taskkill /F /IM cloudflared.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
if exist "bin\node.exe" (
    "bin\node.exe" "server\launcher.js" --internet
) else (
    node "server\launcher.js" --internet
)
