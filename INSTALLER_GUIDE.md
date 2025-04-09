# Subtitles Generator Installer Guide

This guide provides detailed instructions for creating and distributing the Subtitles Generator installer.

## Prerequisites for Building the Installer

Before you can build the installer, you need:

1. **Node.js** (v14 or higher) installed on your system
2. **Git** installed (if you want to clone the repository)
3. **Windows OS** (the installer is built for Windows)

## Building the Installer

### Option 1: Using the Batch Script (Recommended)

The easiest way to build the installer is to use the provided batch script:

1. Open a Command Prompt or PowerShell window
2. Navigate to the project directory
3. Run the batch script:
   ```
   create-installer.bat
   ```
4. Wait for the process to complete (this may take several minutes)
5. The installer will be created in the `dist` folder

### Option 2: Manual Build

If you prefer to build the installer manually:

1. Install dependencies:
   ```
   npm install
   ```

2. Build the React application:
   ```
   npm run build
   ```

3. Build the Electron installer:
   ```
   npm run electron:build
   ```

4. The installer will be created in the `dist` folder

## Installer Features

The installer includes:

- **Automatic FFmpeg Installation**: The installer will check if FFmpeg is installed and install it if needed
- **Desktop and Start Menu Shortcuts**: For easy access to the application
- **User Data Directory**: All videos and subtitles are stored in the user's AppData folder
- **Uninstaller**: For easy removal of the application

## Customizing the Installer

### Changing the Application Icon

1. Replace the `public/favicon.png` file with your own icon
2. Make sure your icon is at least 256x256 pixels for best results

### Modifying the Installer Behavior

1. Edit the `installer.nsh` file to change the NSIS installer behavior
2. Update the `build` section in `package.json` to change electron-builder settings

### Changing Application Name or Version

1. Update the `name`, `version`, and `productName` fields in `package.json`

## Distributing the Installer

After building the installer, you can distribute it through:

1. **Direct Download**: Host the installer on your website or file sharing service
2. **GitHub Releases**: Upload the installer as a release asset
3. **Cloud Storage**: Upload to services like Google Drive, Dropbox, etc.

## Troubleshooting

### Common Issues

1. **Build Fails with Node.js Errors**:
   - Make sure you have Node.js v14 or higher installed
   - Try deleting the `node_modules` folder and running `npm install` again

2. **FFmpeg Installation Fails**:
   - The installer attempts to use winget to install FFmpeg
   - If this fails, users may need to install FFmpeg manually
   - Include instructions for manual FFmpeg installation in your documentation

3. **Antivirus Blocks Installation**:
   - Some antivirus software may flag the installer
   - Users may need to temporarily disable their antivirus during installation

## Support

If users encounter issues with the installer:

1. Ensure they have administrator privileges
2. Check if FFmpeg is installed correctly
3. Verify that the application has write access to the AppData folder
4. Check for any error messages in the application logs
