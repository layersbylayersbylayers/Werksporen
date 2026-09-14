@echo off
cd /d "%~dp0"

set "NODE_BIN=%~dp0portfolio-runtime\windows-x64\node.exe"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_BIN=%~dp0portfolio-runtime\windows-arm64\node.exe"
if exist "%NODE_BIN%" goto node_ready
set "NODE_BIN=%~dp0..\portfolio\portfolio-runtime\windows-x64\node.exe"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_BIN=%~dp0..\portfolio\portfolio-runtime\windows-arm64\node.exe"
:node_ready
if not exist "%NODE_BIN%" set "NODE_BIN=node"

start "" /b "%NODE_BIN%" portfolio-admin-server.js
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/admin"
echo Portfolio V2 Admin draait. Laat dit venster open.
echo Gebruik op iPad/iPhone het wifi-adres dat hierboven verschijnt.
pause >nul
