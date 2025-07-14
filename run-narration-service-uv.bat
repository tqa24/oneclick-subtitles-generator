@echo off
setlocal

echo Running narration service using Python 3.11 (via uv) and PyTorch (NVIDIA target)...
echo Activating environment and running server/narrationApp.py with uv...
echo.

REM Ensure the script's directory is the current directory
cd /d "%~dp0"

REM Check if uv is available
uv --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Error: 'uv' command not found in PATH. Please install uv.
    echo See: https://github.com/astral-sh/uv#installation
    goto PauseAndExit
)

REM Check if the venv exists (Windows/Posix paths)
if not exist ".venv\Scripts\python.exe" (
    if not exist ".venv/bin/python" (
      echo Error: Virtual environment '..venv' not found or incomplete.
      echo Please run the setup script again (e.g., node setup-narration.js).
      goto PauseAndExit
    )
)

REM Explicitly specify the .venv environment to ensure uv uses it
echo Starting F5-TTS server (server/narrationApp.py)...
uv run --python .venv -- python server/narrationApp.py

echo.
echo Server stopped.
goto End

:PauseAndExit
echo.
pause
exit /b 1

:End
endlocal
pause
