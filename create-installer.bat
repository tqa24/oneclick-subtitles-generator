@echo off
echo ===================================================
echo Subtitles Generator Installer Creation Script
echo ===================================================
echo.

echo Step 1: Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
  echo Error installing dependencies. Aborting.
  exit /b %ERRORLEVEL%
)
echo Dependencies installed successfully.
echo.

echo Step 2: Building React application...
call npm run build
if %ERRORLEVEL% neq 0 (
  echo Error building React application. Aborting.
  exit /b %ERRORLEVEL%
)
echo React application built successfully.
echo.

echo Step 3: Creating directories for videos and subtitles...
if not exist videos mkdir videos
if not exist subtitles mkdir subtitles
echo. > videos\.gitkeep
echo. > subtitles\.gitkeep
echo Directories created.
echo.

echo Step 4: Building Electron installer...
echo This may take several minutes...
set DEBUG=electron-builder
call npm run electron:build
if %ERRORLEVEL% neq 0 (
  echo Error building Electron installer. Aborting.
  exit /b %ERRORLEVEL%
)
echo.
echo ===================================================
echo Installer created successfully!
echo The installer can be found in the dist folder.
echo ===================================================
echo.
pause
