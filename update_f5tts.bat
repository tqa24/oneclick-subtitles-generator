@echo off
echo Updating F5-TTS to use CUDA...

REM First, install PyTorch with CUDA
call install_pytorch_cuda.bat

REM Reinstall F5-TTS
echo Reinstalling F5-TTS...
uv pip uninstall f5-tts

REM Install with uv pip
echo Installing F5-TTS with uv pip...
uv pip install --force-reinstall f5-tts

REM Verify installation
echo Verifying F5-TTS installation...
uv python update_f5tts.py

echo Done!
pause
