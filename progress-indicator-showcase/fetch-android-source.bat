@echo off
REM Windows batch script to fetch Android source files

if "%1"=="" (
    echo Usage: fetch-android-source.bat ^<file_path^> [output_dir]
    echo.
    echo Examples:
    echo   fetch-android-source.bat compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/WavyProgressIndicator.kt
    echo   fetch-android-source.bat compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/internal/ProgressIndicatorImpl.kt kotlin-code/
    exit /b 1
)

python fetch-android-source.py %*
