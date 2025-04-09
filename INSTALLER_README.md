# Subtitles Generator Installer

This document explains how to create and use the Subtitles Generator installer.

## Creating the Installer

To create the installer, simply run the `create-installer.bat` script:

1. Double-click on `create-installer.bat`
2. Wait for the process to complete (this may take several minutes)
3. The installer will be created in the `dist` folder

## What the Installer Does

The installer:

1. Installs the Subtitles Generator application
2. Creates desktop and start menu shortcuts
3. Automatically installs FFmpeg if it's not already installed
4. Sets up all necessary directories for videos and subtitles

## System Requirements

- Windows 10 or later
- Internet connection (for the initial installation)
- 500MB of free disk space

## Troubleshooting

If you encounter issues during installation:

1. Make sure you have administrator privileges
2. Temporarily disable antivirus software
3. Ensure you have a stable internet connection
4. If FFmpeg installation fails, you can install it manually from [ffmpeg.org](https://ffmpeg.org/download.html)

## For Developers

If you want to modify the installer:

1. Edit the `installer.nsh` file for custom NSIS installation steps
2. Modify the `electron/main.js` file for application startup behavior
3. Update the `package.json` file's `build` section for electron-builder configuration
