@echo off
echo ===================================================
echo Subtitles Generator - Copy Build to Installed App
echo ===================================================
echo.

echo This script will copy the build files directly to the installed application.
echo This can be useful for debugging without having to rebuild the installer.
echo.

set APP_RESOURCES="%LOCALAPPDATA%\Programs\Subtitles Generator\resources"

if not exist %APP_RESOURCES% (
  echo Application resources not found at %APP_RESOURCES%
  echo Please check if the application is installed correctly.
  goto :end
)

echo Found application resources at %APP_RESOURCES%
echo.

if not exist "build" (
  echo Build directory not found.
  echo Please run "npm run build" first.
  goto :end
)

echo Copying build files to installed application...
echo.

xcopy /E /I /Y "build" %APP_RESOURCES%\build

echo.
echo Build files copied successfully.
echo You can now run the application to see the changes.
echo.

:end
pause
