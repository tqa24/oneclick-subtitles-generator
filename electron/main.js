const { app, BrowserWindow, dialog, shell } = require('electron');
const { ipcMain } = require('electron/main');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const PythonServiceManager = require('./python-services');
const isDev = process.env.NODE_ENV === 'development';

// Import port configuration from server
const { PORTS } = require('../server/config');

// Debug logging function that writes to file
function debugLog(message) {
  const debugFile = path.join(app.getPath('userData'), 'debug.log');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  try {
    fs.appendFileSync(debugFile, logMessage);
    console.log(message); // Also log to console for development
  } catch (error) {
    console.error('Failed to write debug log:', error);
  }
}

// Keep a global reference of the window object
let mainWindow;
let nodeServerProcess = null;
let websocketServerProcess = null;
let videoRendererProcess = null;
let videoRendererFrontendProcess = null;
let promptdjMidiProcess = null;
let pythonServiceManager = null;

// Service configuration using unified port system
const SERVICES = {
  NODE_SERVER: {
    name: 'Express.js Backend Server',
    script: path.join(__dirname, '../server.js'),
    port: PORTS.BACKEND,
    healthCheck: '/health'
  },
  FRONTEND_SERVER: {
    name: 'React Frontend Server',
    script: null, // Built React app, served by Electron
    port: PORTS.FRONTEND,
    healthCheck: null
  },
  WEBSOCKET_SERVER: {
    name: 'WebSocket Service',
    script: path.join(__dirname, '../server/services/shared/progressWebSocket.js'),
    port: PORTS.WEBSOCKET,
    healthCheck: null
  },
  VIDEO_RENDERER: {
    name: 'Remotion Video Renderer',
    script: path.join(__dirname, '../video-renderer/server/index.js'),
    port: PORTS.VIDEO_RENDERER,
    healthCheck: '/health'
  },
  VIDEO_RENDERER_FRONTEND: {
    name: 'Video Renderer Frontend',
    script: path.join(__dirname, '../video-renderer/client/server.js'),
    port: PORTS.VIDEO_RENDERER_FRONTEND,
    healthCheck: null
  },
  NARRATION_SERVICE: {
    name: 'F5-TTS Narration Service',
    script: path.join(__dirname, '../server/narrationApp.py'),
    port: PORTS.NARRATION,
    healthCheck: '/health'
  },
  CHATTERBOX_SERVICE: {
    name: 'Chatterbox API Service',
    script: path.join(__dirname, '../chatterbox-fastapi/start_api.py'),
    port: PORTS.CHATTERBOX,
    healthCheck: '/docs'
  },
  PROMPTDJ_MIDI: {
    name: 'PromptDJ MIDI Service',
    script: path.join(__dirname, '../promptdj-midi/server.js'),
    port: PORTS.PROMPTDJ_MIDI,
    healthCheck: null
  },
  PARAKEET_SERVICE: {
    name: 'Parakeet ASR Service',
    script: path.join(__dirname, '../parakeet_wrapper/app.py'),
    port: PORTS.PARAKEET,
    healthCheck: '/'
  }
};

// Create the Electron window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegrationInWorker: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'One-Click Subtitles Generator',
    show: false,
    backgroundColor: '#1a1a1a'
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${PORTS.FRONTEND}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}
// Generic service starter for Python services that uses bundled wheelhouse
function startPythonService(serviceConfig) {
  return new Promise((resolve, reject) => {
    const { script, name, port } = serviceConfig;
    
    if (!script) {
      console.log(`✅ ${name} (built-in service)`);
      resolve(null);
      return;
    }
    
    console.log(`🚀 Starting Python ${name}...`);

    // Determine if we're in packaged mode
    const isPackaged = process.execPath.includes('One-Click Subtitles Generator.exe');
    
    // Resolve script path correctly in both dev and packaged modes
    let scriptPath;
    let workingDir;

    if (isPackaged) {
      // In packaged mode, use the unpacked path
      const appRoot = path.dirname(__dirname); // resources/app.asar
      const relativeFromAppRoot = path.relative(appRoot, script);
      scriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', relativeFromAppRoot);
      workingDir = path.dirname(scriptPath);
    } else {
      // In development, use the script path as defined
      scriptPath = script;
      workingDir = path.dirname(scriptPath);
    }

    debugLog(`[DEBUG] Python Service script path: ${scriptPath}`);
    debugLog(`[DEBUG] Python Service working directory: ${workingDir}`);
    
    // Check if file exists
    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Python Service script not found: ${scriptPath}`);
      reject(new Error(`Python Service script not found: ${scriptPath}`));
      return;
    }

    // Use bundled Python wheelhouse in packaged mode, or system Python in dev mode
    let pythonExecutable;
    if (isPackaged) {
      // Use bundled wheelhouse (copied to python-venv/ in build config)
      const wheelhouseVenv = path.join(process.resourcesPath, 'python-venv', 'venv');
      pythonExecutable = process.platform === 'win32'
        ? path.join(wheelhouseVenv, 'Scripts', 'python.exe')
        : path.join(wheelhouseVenv, 'bin', 'python');
    } else {
      // Use system Python in dev mode
      pythonExecutable = process.platform === 'win32' ? 'python.exe' : 'python';
    }

    debugLog(`[DEBUG] Python executable: ${pythonExecutable}`);

    const childProcess = spawn(pythonExecutable, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDir,
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production',
        START_PYTHON_SERVER: 'true',
        DEV_SERVER_MANAGED: 'true'
      }
    });

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      debugLog(`[${name}] ${output}`.trimEnd());
      if (mainWindow) {
        mainWindow.webContents.send('service-log', {
          service: name,
          type: 'stdout',
          message: output,
          timestamp: Date.now()
        });
      }
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      debugLog(`[${name} ERROR] ${output}`.trimEnd());
      if (mainWindow) {
        mainWindow.webContents.send('service-log', {
          service: name,
          type: 'stderr',
          message: output,
          timestamp: Date.now()
        });
      }
    });

    childProcess.on('error', (error) => {
      console.error(`Failed to start ${name}:`, error);
      reject(error);
    });

    childProcess.on('close', (code) => {
      console.log(`${name} exited with code ${code}`);
      if (mainWindow) {
        mainWindow.webContents.send('service-status', {
          service: name,
          status: 'stopped',
          exitCode: code
        });
      }
    });

    setTimeout(() => {
      if (childProcess.exitCode === null) {
        console.log(`✅ ${name} started successfully`);
        resolve(childProcess);
      } else {
        reject(new Error(`${name} failed to start (exit code: ${childProcess.exitCode})`));
      }
    }, 3000);
  });
}

// Generic service starter for Node.js services
function startService(serviceConfig) {
  return new Promise((resolve, reject) => {
    const { script, name, port } = serviceConfig;
    
    if (!script) {
      // No script means it's a built-in service (like React frontend served by Electron)
      console.log(`✅ ${name} (built-in service)`);
      resolve(null);
      return;
    }
    
    console.log(`🚀 Starting ${name}...`);

    // Resolve script path correctly in both dev and packaged (asar) modes
    // so that Node services run from their actual on-disk location.
    let scriptPath;
    let workingDir;

    if (app.isPackaged) {
      // In production, files are inside app.asar. For Node to execute them,
      // we need the asar path rewritten to the unpacked app directory.
      // __dirname points into resources/app.asar/electron, so go up one
      // level to the app root and then apply the same relative path that
      // was used when constructing `script`.
      const appRoot = path.dirname(__dirname); // resources/app.asar
      const relativeFromAppRoot = path.relative(appRoot, script);
      scriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', relativeFromAppRoot);
      workingDir = path.dirname(scriptPath);
    } else {
      // In development, use the script path as defined
      scriptPath = script;
      workingDir = path.dirname(scriptPath);
    }

    debugLog(`[DEBUG] Service script path: ${scriptPath}`);
    debugLog(`[DEBUG] Service working directory: ${workingDir}`);
    
    // Check if file exists before trying to spawn
    if (!fs.existsSync(scriptPath)) {
      console.error(`❌ Service script not found: ${scriptPath}`);
      reject(new Error(`Service script not found: ${scriptPath}`));
      return;
    }
    
    // CRITICAL FIX: Use 'node' executable instead of process.execPath to avoid infinite recursion
    // process.execPath points to the Electron executable in packaged apps, causing infinite loops
    const nodeExecutable = process.platform === 'win32' ? 'node.exe' : 'node';
    debugLog(`[DEBUG] Spawning service '${name}' with node executable '${nodeExecutable}'`);
    const childProcess = spawn(nodeExecutable, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDir,
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production',
        // Mirror dev:cuda behavior so narration + chatterbox can start
        START_PYTHON_SERVER: 'true',
        DEV_SERVER_MANAGED: 'true',
        // Explicitly signal packaged mode for Python service detection
        ELECTRON_RUN_AS_PACKAGED: app.isPackaged ? '1' : '0',
        // Pass resources path to Node process (process.resourcesPath not available in child processes)
        ELECTRON_RESOURCES_PATH: app.isPackaged ? process.resourcesPath : ''
      }
    });

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      debugLog(`[${name}] ${output}`.trimEnd());
      if (mainWindow) {
        mainWindow.webContents.send('service-log', {
          service: name,
          type: 'stdout',
          message: output,
          timestamp: Date.now()
        });
      }
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      debugLog(`[${name} ERROR] ${output}`.trimEnd());
      if (mainWindow) {
        mainWindow.webContents.send('service-log', {
          service: name,
          type: 'stderr',
          message: output,
          timestamp: Date.now()
        });
      }
    });

    childProcess.on('error', (error) => {
      console.error(`Failed to start ${name}:`, error);
      reject(error);
    });

    childProcess.on('close', (code) => {
      console.log(`${name} exited with code ${code}`);
      if (mainWindow) {
        mainWindow.webContents.send('service-status', {
          service: name,
          status: 'stopped',
          exitCode: code
        });
      }
    });

    setTimeout(() => {
      if (childProcess.exitCode === null) {
        console.log(`✅ ${name} started successfully`);
        resolve(childProcess);
      } else {
        reject(new Error(`${name} failed to start (exit code: ${childProcess.exitCode})`));
      }
    }, 3000);
  });
}

function startNodeServer() {
  return startService(SERVICES.NODE_SERVER);
}

async function startAllServices() {
  const results = {};

  debugLog('🔍 Debug: Starting service initialization...');
  debugLog('🔍 Debug: isDev = ' + isDev);
  debugLog('🔍 Debug: app.isPackaged = ' + app.isPackaged);
  debugLog('🔍 Debug: process.resourcesPath = ' + process.resourcesPath);
  debugLog('🔍 Debug: __dirname = ' + __dirname);
  debugLog('🔍 Debug: process.cwd() = ' + process.cwd());
  
  try {
    // Start all Node.js services
    console.log('🚀 Starting all services...');
    
    // 1. Express.js Backend Server (3031) - START WITH DETAILED DEBUGGING
    debugLog('🔧 Starting Express.js Backend Server on port 3031...');
    debugLog('🔍 Debug: SERVER.SCRIPT_PATH = ' + SERVICES.NODE_SERVER.script);

    try {
      results.nodeServer = await startNodeServer();
      debugLog('✅ Express.js Backend Server started successfully');
      if (mainWindow) {
        mainWindow.webContents.send('service-ready', {
          service: 'nodeServer',
          success: true,
          message: 'Backend server started successfully on port 3031'
        });
      }

      // Start Python services with the same pattern as dev:cuda
      debugLog('🚀 Starting F5-TTS Narration Service (port 3035)...');
      try {
        const narrationResult = await startPythonService({
          name: 'F5-TTS Narration Service',
          script: SERVICES.NARRATION_SERVICE.script,
          port: SERVICES.NARRATION_SERVICE.port,
          healthCheck: SERVICES.NARRATION_SERVICE.healthCheck
        });
        results.narrationService = narrationResult;
        debugLog('✅ F5-TTS Narration Service started successfully');
      } catch (error) {
        debugLog('❌ F5-TTS NARRATION SERVICE FAILED: ' + error.message);
      }

      debugLog('🚀 Starting Chatterbox API Service (port 3036)...');
      try {
        const chatterboxResult = await startPythonService({
          name: 'Chatterbox API Service',
          script: SERVICES.CHATTERBOX_SERVICE.script,
          port: SERVICES.CHATTERBOX_SERVICE.port,
          healthCheck: SERVICES.CHATTERBOX_SERVICE.healthCheck
        });
        results.chatterboxService = chatterboxResult;
        debugLog('✅ Chatterbox API Service started successfully');
      } catch (error) {
        debugLog('❌ CHATTERBOX SERVICE FAILED: ' + error.message);
      }

    } catch (error) {
      debugLog('❌ EXPRESS.JS BACKEND SERVER FAILED: ' + error);
      debugLog('❌ Error details: ' + error.message + ' ' + error.stack);
      if (mainWindow) {
        mainWindow.webContents.send('service-ready', {
          service: 'nodeServer',
          success: false,
          message: `Backend server failed: ${error.message}`
        });
      }
    }
    
    // Add a delay to let services start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // For now, skip other services to focus on the main issue
    debugLog('⚠️  Skipping other services to focus on backend server');

    debugLog('🔍 Debug: Final results: ' + JSON.stringify(results));
    
    if (mainWindow) {
      mainWindow.webContents.send('services-ready', {
        success: true,
        services: {
          nodeServer: !!results.nodeServer,
          websocketServer: false, // Skipped for now
          videoRenderer: false,   // Skipped for now
          videoRendererFrontend: false, // Skipped for now
          promptdjMidi: false,    // Skipped for now
          narrationService: false, // Skipped for now
          chatterboxService: false, // Skipped for now
          parakeetService: false   // Skipped for now
        },
        debug: {
          isDev: isDev,
          isPackaged: app.isPackaged,
          resourcesPath: process.resourcesPath,
          cwd: process.cwd()
        }
      });
    }
    
    return results;
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    console.error('❌ Error stack:', error.stack);
    if (mainWindow) {
      mainWindow.webContents.send('services-ready', {
        success: false,
        error: error.message,
        debug: {
          isDev: isDev,
          isPackaged: app.isPackaged,
          resourcesPath: process.resourcesPath,
          cwd: process.cwd()
        }
      });
    }
    throw error;
  }
}

function stopAllServices() {
  console.log('🛑 Stopping all services...');
  
  // Stop Node.js services
  if (nodeServerProcess && !nodeServerProcess.killed) {
    nodeServerProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!nodeServerProcess.killed) {
        nodeServerProcess.kill('SIGKILL');
      }
    }, 5000);
  }
  
  // Stop other services...
}

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('start-services', async () => {
  try {
    console.log('🔍 Debug: Manual service start requested');
    const results = await startAllServices();
    nodeServerProcess = results.nodeServer;
    return { success: true };
  } catch (error) {
    console.error('❌ Manual service start failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-services', () => {
  stopAllServices();
  return { success: true };
});

ipcMain.handle('get-service-status', () => {
  return {
    nodeServer: {
      running: !!(nodeServerProcess && !nodeServerProcess.killed),
      pid: nodeServerProcess?.pid,
      port: PORTS.BACKEND
    },
    websocketServer: {
      running: false,
      pid: null,
      port: PORTS.WEBSOCKET
    },
    videoRenderer: {
      running: false,
      pid: null,
      port: PORTS.VIDEO_RENDERER
    },
    videoRendererFrontend: {
      running: false,
      pid: null,
      port: PORTS.VIDEO_RENDERER_FRONTEND
    },
    promptdjMidi: {
      running: false,
      pid: null,
      port: PORTS.PROMPTDJ_MIDI
    },
    narrationService: { running: false, port: PORTS.NARRATION },
    chatterboxService: { running: false, port: PORTS.CHATTERBOX },
    parakeetService: { running: false, port: PORTS.PARAKEET }
  };
});

// App event handlers
app.whenReady().then(() => {
  console.log('🚀 Electron app ready, creating window...');
  createWindow();
  
  if (!isDev) {
    console.log('🚀 Starting services in production mode...');
    startAllServices()
      .then(() => {
        console.log('✅ All services started successfully');
      })
      .catch(error => {
        console.error('❌ Failed to start services on app ready:', error);
        console.error('Error stack:', error.stack);
      });
  } else {
    console.log('🚀 Development mode - skipping service startup');
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopAllServices();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopAllServices();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});