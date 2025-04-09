@echo off
echo ===================================================
echo Subtitles Generator - Electron Debug Mode
echo ===================================================
echo.

echo Starting Electron in debug mode...
set DEBUG=electron*
set ELECTRON_ENABLE_LOGGING=true
npm run electron:dev
