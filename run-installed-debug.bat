@echo off
echo ===================================================
echo Subtitles Generator - Debug Installed Application
echo ===================================================
echo.

echo Looking for installed application...
set APP_PATH="%LOCALAPPDATA%\Programs\Subtitles Generator\Subtitles Generator.exe"

if not exist %APP_PATH% (
  echo Application not found at %APP_PATH%
  echo Please install the application first.
  goto :end
)

echo Found application at %APP_PATH%
echo.
echo Running application with debugging enabled...
echo.
echo Press Ctrl+C to cancel or any key to continue...
pause > nul

set DEBUG=electron*
set ELECTRON_ENABLE_LOGGING=true
start "" %APP_PATH%

:end
echo.
pause
