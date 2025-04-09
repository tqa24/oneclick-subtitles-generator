@echo off
echo ===================================================
echo Subtitles Generator - Installer Test
echo ===================================================
echo.

echo Looking for installer in dist folder...
set INSTALLER_PATH=
for /f "delims=" %%i in ('dir /b /s "dist\*.exe" 2^>nul') do (
  set INSTALLER_PATH=%%i
  goto :found
)

:found
if "%INSTALLER_PATH%"=="" (
  echo No installer found in dist folder.
  echo Please run create-installer.bat first.
  goto :end
)

echo Found installer: %INSTALLER_PATH%
echo.
echo Running installer...
echo.
echo IMPORTANT: This will install the application on your system.
echo Press Ctrl+C to cancel or any key to continue...
pause > nul

start "" "%INSTALLER_PATH%"

:end
echo.
pause
