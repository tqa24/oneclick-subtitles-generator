@echo off
setlocal
echo Running the application with narration service (using uv)...

REM Ensure the script's directory is the current directory
cd /d "%~dp0"

REM Check if the narration service run script exists
if not exist "run-narration-service-uv.bat" (
    echo Error: run-narration-service-uv.bat not found.
    echo Please run the setup script again (e.g., node setup-narration.js).
    goto PauseAndExit
)

REM Check if npm is available
npm --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Error: 'npm' command not found in PATH. Please install Node.js and npm.
    echo See: https://nodejs.org/
    goto PauseAndExit
)

REM Start the narration service in a new window using the uv script
echo Starting Narration Service (uv - NVIDIA target)...
start "Narration Service (uv)" cmd /c "run-narration-service-uv.bat"

REM Wait for the narration service to start (adjust time if needed)
echo Waiting a few seconds for narration service to initialize...
timeout /t 5 /nobreak > nul

REM Start the application (assuming Node.js part remains the same)
echo Starting the main application (npm run dev)...
npm run dev

echo.
echo Main application stopped.
goto End

:PauseAndExit
echo.
pause
exit /b 1

:End
endlocal
pause
