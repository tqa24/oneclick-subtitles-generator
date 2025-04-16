@echo off
echo Running the application with narration service...

REM Start the narration service in a new window
start cmd /k "run-narration-service.bat"

REM Wait for the narration service to start
echo Waiting for narration service to start...
timeout /t 5

REM Start the application
echo Starting the application...
npm run dev

pause
