@echo off
echo Running narration service using Python 3.11 (via uv) and PyTorch CUDA...
echo Ensure 'uv' is in your PATH.

REM uv automatically detects the ..venv environment
REM Run the narration service using uv run
uv run -- python server/narrationApp.py

pause
