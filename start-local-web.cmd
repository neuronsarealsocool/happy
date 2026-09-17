@echo off
setlocal

set "PORT=8081"
if not "%~1"=="" set "PORT=%~1"

set "APP_ENV=development"
set "BROWSER=none"

echo Starting Agentic Messenger local web development server...
echo.
echo Local site: http://localhost:%PORT%
echo Changes under packages\happy-app will refresh automatically.
echo Press Ctrl+C in this window to stop the server.
echo.

start "" "http://localhost:%PORT%"
node "%~dp0node_modules\expo\bin\cli" start --web --port %PORT%

