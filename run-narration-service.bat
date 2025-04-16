@echo off
echo Running narration service with Python 3.11 and PyTorch CUDA...

REM Run the narration service with uv python
uv python --python 3.11 server/narrationApp.py

pause
