@echo off
echo ===================================
echo F5-TTS Setup and Run Script
echo ===================================
echo.

REM Check if uv is installed
where uv >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: uv is not installed.
    echo Please install uv first:
    echo https://github.com/astral-sh/uv
    echo.
    echo You can install it with:
    echo curl -sSf https://astral.sh/uv/install.sh | bash
    pause
    exit /b 1
)

echo uv is installed. Proceeding with setup...
echo.

REM Create Python virtual environment
echo Creating Python virtual environment...
call uv venv .venv
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create Python virtual environment.
    pause
    exit /b 1
)
echo Virtual environment created successfully.
echo.

REM Install F5-TTS
echo Installing F5-TTS...
call uv pip install -e F5-TTS
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install F5-TTS.
    pause
    exit /b 1
)
echo F5-TTS installed successfully.
echo.

REM Install Python dependencies
echo Installing Python dependencies...
call uv pip install flask flask-cors soundfile numpy torch torchaudio vocos
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install Python dependencies.
    pause
    exit /b 1
)
echo Python dependencies installed successfully.
echo.

REM Create narration directories
echo Creating narration directories...
if not exist narration mkdir narration
if not exist narration\reference mkdir narration\reference
if not exist narration\output mkdir narration\output
echo Narration directories created successfully.
echo.

echo ===================================
echo Setup completed successfully!
echo ===================================
echo.
echo Starting the application...
echo.

REM Start the application
npm run dev

pause
