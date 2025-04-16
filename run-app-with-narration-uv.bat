@echo off
echo Running the application with narration service (using uv)...

REM Start the narration service in a new window using the uv script
start "Narration Service (uv)" cmd /k "run-narration-service-uv.bat"

REM Wait for the narration service to start (adjust time if needed)
echo Waiting for narration service to start...
timeout /t 5 /nobreak > nul

REM Start the application (assuming Node.js part remains the same)
echo Starting the application...
npm run dev

pause
