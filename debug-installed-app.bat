@echo off
echo ===================================================
echo Subtitles Generator - Debug Installed Application
echo ===================================================
echo.

echo This script will help you debug the installed application.
echo It will enable logging and open DevTools when the application starts.
echo.

set APP_PATH="%LOCALAPPDATA%\Programs\Subtitles Generator\Subtitles Generator.exe"

if not exist %APP_PATH% (
  echo Application not found at %APP_PATH%
  echo Please check if the application is installed correctly.
  goto :end
)

echo Found application at %APP_PATH%
echo.
echo Setting environment variables for debugging...
echo.

set DEBUG=electron*,electron-builder*
set ELECTRON_ENABLE_LOGGING=true
set ELECTRON_ENABLE_STACK_DUMPING=true

echo Starting application with debugging enabled...
echo.
echo Press any key to continue...
pause > nul

start "" %APP_PATH%

echo.
echo Application started with debugging enabled.
echo Check the console output for any errors.
echo.

:end
pause
