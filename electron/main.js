const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');

// Try to require @electron/remote, but don't fail if it's not available
let remoteMain;
try {
  remoteMain = require('@electron/remote/main');
  console.log('@electron/remote module loaded successfully');
} catch (error) {
  console.error('Failed to load @electron/remote module:', error.message);
  console.log('Application will continue without remote module support');
}
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
let serverProcess;
let serverPort = 3004;
let appPort = 3005;

// Check if we're in development or production
const isDev = process.env.NODE_ENV !== 'production';

// Set up global error handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);

  // Show error dialog
  if (app.isReady()) {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred: ${error.message}\n\nThe application will continue to run, but some features may not work correctly.`
    );
  }
});

// Log important paths and environment variables
console.log(`App path: ${app.getAppPath()}`);
console.log(`User data path: ${app.getPath('userData')}`);
console.log(`Executable path: ${app.getPath('exe')}`);
console.log(`Is development: ${isDev}`);
console.log(`Process type: ${process.type || 'unknown'}`);
console.log(`Electron version: ${process.versions.electron || 'unknown'}`);
console.log(`Node version: ${process.versions.node || 'unknown'}`);
console.log(`Chrome version: ${process.versions.chrome || 'unknown'}`);
console.log(`V8 version: ${process.versions.v8 || 'unknown'}`);
console.log(`OS: ${process.platform} ${process.arch}`);
console.log(`Process ID: ${process.pid}`);
console.log(`Command line args: ${process.argv.join(' ')}`);
console.log(`Working directory: ${process.cwd()}`);
console.log(`Environment variables: NODE_ENV=${process.env.NODE_ENV || 'not set'}, DEBUG=${process.env.DEBUG || 'not set'}`);


// Create directories if they don't exist
function ensureDirectories() {
  const appPath = app.getPath('userData');
  const videosDir = path.join(appPath, 'videos');
  const subtitlesDir = path.join(appPath, 'subtitles');

  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
    console.log(`Created videos directory at ${videosDir}`);
  }

  if (!fs.existsSync(subtitlesDir)) {
    fs.mkdirSync(subtitlesDir, { recursive: true });
    console.log(`Created subtitles directory at ${subtitlesDir}`);
  }

  return { videosDir, subtitlesDir };
}

// Check if FFmpeg is installed
async function checkFFmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('error', () => {
      dialog.showMessageBox({
        type: 'warning',
        title: 'FFmpeg Not Found',
        message: 'FFmpeg is required for video processing but was not found on your system.',
        detail: 'The application will attempt to install FFmpeg automatically when needed.',
        buttons: ['OK']
      });
      resolve(false);
    });

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

// Start the Express server
function startServer() {
  const { videosDir, subtitlesDir } = ensureDirectories();

  console.log(`Starting server with videos dir: ${videosDir}`);
  console.log(`Starting server with subtitles dir: ${subtitlesDir}`);

  // Get the path to the server.js file
  let serverPath;
  if (isDev) {
    // In development, use the server.js file directly
    serverPath = path.join(process.cwd(), 'server.js');
  } else {
    // In production, use the server.js file from the app directory
    serverPath = path.join(app.getAppPath(), 'server.js');
  }

  console.log(`Starting server with path: ${serverPath}`);

  // Start the server process
  serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: serverPort,
      VIDEOS_DIR: videosDir,
      SUBTITLES_DIR: subtitlesDir,
      NODE_ENV: isDev ? 'development' : 'production'
    }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server error: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

// Function to find the index.html file
function findIndexHtml() {
  const possiblePaths = [
    path.join(app.getAppPath(), 'build', 'index.html'),
    path.join(process.resourcesPath, 'app', 'build', 'index.html'),
    path.join(process.resourcesPath, 'app.asar', 'build', 'index.html'),
    path.join(process.resourcesPath, 'build', 'index.html'),
    path.join(__dirname, '..', 'build', 'index.html'),
    path.join(process.cwd(), 'build', 'index.html')
  ];

  console.log('Searching for index.html in the following locations:');
  for (const p of possiblePaths) {
    console.log(` - ${p}`);
    if (fs.existsSync(p)) {
      console.log(`Found index.html at: ${p}`);
      return p;
    }
  }

  console.error('Could not find index.html in any of the expected locations');
  return null;
}

// Create the main browser window
function createWindow() {
  console.log('Creating main window...');

  // Get the path to the preload script
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log(`Preload script path: ${preloadPath}`);

  // Get the path to the icon
  const iconPath = isDev
    ? path.join(__dirname, '../public/favicon.png')
    : path.join(app.getAppPath(), 'build/favicon.png');
  console.log(`Icon path: ${iconPath}`);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev, // Disable web security in dev mode for local file access
      preload: preloadPath
    },
    icon: iconPath
  });

  // Load the app
  if (isDev) {
    // In development, load from the dev server
    const devUrl = `http://localhost:${appPort}`;
    console.log(`Loading app from dev server: ${devUrl}`);
    mainWindow.loadURL(devUrl);
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the built files
    const indexPath = findIndexHtml();

    if (!indexPath) {
      // Show error dialog if index.html not found
      dialog.showErrorBox(
        'Application Error',
        'Could not find the application files. Please reinstall the application.'
      );
      return;
    }

    console.log(`Loading app from file: ${indexPath}`);

    // Try to load the file
    try {
      const fileUrl = url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true
      });
      console.log(`Loading URL: ${fileUrl}`);
      mainWindow.loadURL(fileUrl);

      // Open DevTools in production for debugging
      if (process.env.DEBUG) {
        mainWindow.webContents.openDevTools();
      }
    } catch (err) {
      console.error('Failed to load index.html:', err);
      dialog.showErrorBox(
        'Application Error',
        `Failed to load the application: ${err.message}\n\nPlease reinstall the application.`
      );
    }
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Set up IPC handlers
function setupIPC() {
  // Get app version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Get app path
  ipcMain.handle('get-app-path', () => {
    return app.getPath('userData');
  });

  // Open external URL
  ipcMain.handle('open-external', async (_, url) => {
    await shell.openExternal(url);
    return true;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Initialize remote module if available
  if (remoteMain) {
    remoteMain.initialize();
  }

  setupIPC();
  await checkFFmpeg();
  startServer();
  createWindow();

  // Enable remote module for the window if available
  if (remoteMain && mainWindow) {
    try {
      remoteMain.enable(mainWindow.webContents);
      console.log('Remote module enabled for main window');
    } catch (error) {
      console.error('Failed to enable remote module for main window:', error.message);
    }
  }

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it is common for applications to stay open until the user quits
  // explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Kill the server process when the app is quitting
app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
