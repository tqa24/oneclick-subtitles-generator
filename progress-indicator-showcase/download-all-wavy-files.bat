@echo off
REM Download all wavy progress indicator files

echo Downloading all wavy progress indicator files...
echo.

python fetch-android-source.py --batch wavy-progress-files.txt kotlin-code

echo.
echo Download complete! Check the kotlin-code folder for the files.
pause
