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
let setupWindow = null;
let nodeServerProcess = null;
let websocketServerProcess = null;
let videoRendererProcess = null;
let videoRendererFrontendProcess = null;
let promptdjMidiProcess = null;
let pythonServiceManager = null;
let pythonSetupProcess = null;

// Check if Python environment needs to be set up (first run)
function getPythonVenvPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python-venv', 'venv');
  }
  return path.join(__dirname, '..', '.venv');
}

function isPythonSetupRequired() {
  const venvPath = getPythonVenvPath();
  const pythonExe = process.platform === 'win32'
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python');

  const exists = fs.existsSync(pythonExe);
  debugLog(`[SETUP] Checking Python at: ${pythonExe} - exists: ${exists}`);
  return !exists;
}

// Create setup window for first-run installation
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 600,
    height: 400,
    resizable: false,
    frame: true,
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'One-Click Subtitles Generator - First Run Setup',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Create a simple HTML setup page
  const setupHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>First Run Setup</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #fff;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .subtitle { opacity: 0.7; margin-bottom: 30px; }
        .progress-container {
          width: 100%;
          max-width: 400px;
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .progress-bar {
          height: 8px;
          background: linear-gradient(90deg, #00d4ff, #7b2ff7);
          width: 0%;
          transition: width 0.3s;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .status {
          font-size: 14px;
          opacity: 0.8;
          text-align: center;
          max-width: 400px;
          word-wrap: break-word;
        }
        .log {
          margin-top: 20px;
          width: 100%;
          max-width: 500px;
          height: 120px;
          background: rgba(0,0,0,0.3);
          border-radius: 8px;
          padding: 10px;
          font-family: monospace;
          font-size: 11px;
          overflow-y: auto;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <h1>🚀 Setting Up Python Environment</h1>
      <p class="subtitle">This only happens once. Please wait...</p>
      <div class="progress-container">
        <div class="progress-bar" id="progress"></div>
      </div>
      <p class="status" id="status">Initializing setup...</p>
      <div class="log" id="log"></div>
      <script>
        let progress = 5;
        const progressBar = document.getElementById('progress');
        const statusEl = document.getElementById('status');
        const logEl = document.getElementById('log');
        
        // Slow progress animation
        setInterval(() => {
          if (progress < 90) {
            progress += Math.random() * 0.5;
            progressBar.style.width = progress + '%';
          }
        }, 500);
        
        window.electronAPI?.onSetupProgress?.((data) => {
          if (data.message) {
            statusEl.textContent = data.message;
            logEl.textContent += data.message + '\\n';
            logEl.scrollTop = logEl.scrollHeight;
          }
          if (data.progress) {
            progress = data.progress;
            progressBar.style.width = progress + '%';
          }
        });
      </script>
    </body>
    </html>
  `;

  setupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(setupHtml)}`);

  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

// Run Python setup using the bundled setup-narration.js
async function runPythonSetup() {
  return new Promise((resolve, reject) => {
    debugLog('[SETUP] Starting Python environment setup...');

    // Find setup script
    let setupScriptPath;
    let targetVenvPath;

    if (app.isPackaged) {
      setupScriptPath = path.join(process.resourcesPath, 'setup-narration.js');
      targetVenvPath = path.join(process.resourcesPath, 'python-venv', 'venv');
    } else {
      setupScriptPath = path.join(__dirname, '..', 'setup-narration.js');
      targetVenvPath = path.join(__dirname, '..', '.venv');
    }

    debugLog(`[SETUP] Setup script: ${setupScriptPath}`);
    debugLog(`[SETUP] Target venv: ${targetVenvPath}`);

    if (!fs.existsSync(setupScriptPath)) {
      reject(new Error(`Setup script not found: ${setupScriptPath}`));
      return;
    }

    // Ensure target directory exists
    const venvParent = path.dirname(targetVenvPath);
    if (!fs.existsSync(venvParent)) {
      fs.mkdirSync(venvParent, { recursive: true });
    }

    // Run the setup script
    const nodeExe = process.execPath;
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      VENV_PATH: targetVenvPath,
      QUIET: 'false'
    };

    pythonSetupProcess = spawn(nodeExe, [setupScriptPath], {
      cwd: app.isPackaged ? process.resourcesPath : path.dirname(setupScriptPath),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const sendProgress = (message) => {
      debugLog(`[SETUP] ${message}`);
      if (setupWindow && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send('setup-progress', { message });
      }
    };

    pythonSetupProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => sendProgress(line));
    });

    pythonSetupProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => sendProgress(`[stderr] ${line}`));
    });

    pythonSetupProcess.on('error', (err) => {
      debugLog(`[SETUP] Setup process error: ${err.message}`);
      reject(err);
    });

    pythonSetupProcess.on('close', (code) => {
      debugLog(`[SETUP] Setup process exited with code: ${code}`);
      pythonSetupProcess = null;

      if (code === 0) {
        sendProgress('✅ Python environment setup complete!');
        resolve();
      } else {
        reject(new Error(`Setup failed with exit code ${code}`));
      }
    });
  });
}

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
    script: path.join(__dirname, '../video-renderer/server/dist/index.js'),
    port: PORTS.VIDEO_RENDERER,
    healthCheck: '/health'
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
      if (script.includes('app.asar')) {
        // In ASAR packaged mode, use the unpacked path
        const appRoot = path.dirname(__dirname); // resources/app.asar
        const relativeFromAppRoot = path.relative(appRoot, script);
        scriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', relativeFromAppRoot);
      } else {
        // In non-ASAR packaged mode, use script path directly
        scriptPath = script;
      }
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
        START_PYTHON_SERVER: 'false',
        DEV_SERVER_MANAGED: 'true',
        ELECTRON_MANAGES_PYTHON: 'true'
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
      if (script.includes('app.asar')) {
        // In production with ASAR, files are inside app.asar. For Node to execute them,
        // we need the asar path rewritten to the unpacked app directory.
        const appRoot = path.dirname(__dirname); // resources/app.asar
        const relativeFromAppRoot = path.relative(appRoot, script);
        scriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', relativeFromAppRoot);
      } else {
        // In non-ASAR packaged mode, use script path directly
        scriptPath = script;
      }
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
    // UPDATE: Use process.execPath WITH ELECTRON_RUN_AS_NODE=1 to safely use internal Node.js
    const nodeExecutable = process.execPath;
    debugLog(`[DEBUG] Spawning service '${name}' with executable '${nodeExecutable}' (ELECTRON_RUN_AS_NODE=1)`);

    // When running as node via electron, the first argument is treated as the script
    const childProcess = spawn(nodeExecutable, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: workingDir,
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production',
        ELECTRON_RUN_AS_NODE: '1', // FORCE: Run as Node, not Electron app
        // Mirror dev:cuda behavior so narration + chatterbox can start
        START_PYTHON_SERVER: 'false', // Let Electron manage python services
        DEV_SERVER_MANAGED: 'true',
        ELECTRON_MANAGES_PYTHON: 'true',
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
    // Start all services in parallel/sequence as appropriate
    console.log('🚀 Starting all services...');

    // 1. Express.js Backend Server (3031) - CRITICAL
    debugLog('🔧 Starting Express.js Backend Server on port 3031...');
    try {
      results.nodeServer = await startNodeServer();
      debugLog('✅ Express.js Backend Server started successfully');
    } catch (error) {
      debugLog('❌ EXPRESS.JS BACKEND SERVER FAILED: ' + error.message);
      throw error; // Critical failure
    }

    // 2. WebSocket Service (3032)
    debugLog('📡 Starting WebSocket Service...');
    try {
      results.websocketServer = await startService(SERVICES.WEBSOCKET_SERVER);
      debugLog('✅ WebSocket Service started successfully');
    } catch (error) {
      debugLog('❌ WEBSOCKET SERVICE FAILED: ' + error.message);
    }

    // 3. Video Renderer (3033) & Frontend (3034)
    debugLog('🎞️ Starting Video Renderer Services...');
    try {
      results.videoRenderer = await startService(SERVICES.VIDEO_RENDERER);
      debugLog('✅ Video Renderer Service started');


    } catch (error) {
      debugLog('❌ VIDEO RENDERER SERVICES FAILED: ' + error.message);
    }

    // 4. MIDI Service (3037)
    debugLog('🎹 Starting PromptDJ MIDI Service...');
    try {
      results.promptdjMidi = await startService(SERVICES.PROMPTDJ_MIDI);
      debugLog('✅ PromptDJ MIDI Service started');
    } catch (error) {
      debugLog('❌ MIDI SERVICE FAILED: ' + error.message);
    }

    // 5. Python Narrator Services (F5-TTS: 3035, Chatterbox: 3036)
    debugLog('🗣️ Starting Narration Services...');
    try {
      // F5-TTS
      const narrationResult = await startPythonService({
        name: SERVICES.NARRATION_SERVICE.name,
        script: SERVICES.NARRATION_SERVICE.script,
        port: SERVICES.NARRATION_SERVICE.port,
        healthCheck: SERVICES.NARRATION_SERVICE.healthCheck
      });
      results.narrationService = narrationResult;
      debugLog('✅ F5-TTS Narration Service started');

      // Chatterbox
      const chatterboxResult = await startPythonService({
        name: SERVICES.CHATTERBOX_SERVICE.name,
        script: SERVICES.CHATTERBOX_SERVICE.script,
        port: SERVICES.CHATTERBOX_SERVICE.port,
        healthCheck: SERVICES.CHATTERBOX_SERVICE.healthCheck
      });
      results.chatterboxService = chatterboxResult;
      debugLog('✅ Chatterbox API Service started');

    } catch (error) {
      debugLog('❌ NARRATION SERVICES FAILED: ' + error.message);
    }

    // 6. Python Parakeet Service (3038)
    debugLog('🦜 Starting Parakeet ASR Service...');
    try {
      const parakeetResult = await startPythonService({
        name: SERVICES.PARAKEET_SERVICE.name,
        script: SERVICES.PARAKEET_SERVICE.script,
        port: SERVICES.PARAKEET_SERVICE.port,
        healthCheck: SERVICES.PARAKEET_SERVICE.healthCheck
      });
      results.parakeetService = parakeetResult;
      debugLog('✅ Parakeet ASR Service started');
    } catch (error) {
      debugLog('❌ PARAKEET SERVICE FAILED: ' + error.message);
    }

    // UPDATE GLOBAL PROCESS REFERENCES FOR CLEANUP
    if (results.nodeServer) nodeServerProcess = results.nodeServer;
    if (results.websocketServer) websocketServerProcess = results.websocketServer;
    if (results.videoRenderer) videoRendererProcess = results.videoRenderer;

    if (results.promptdjMidi) promptdjMidiProcess = results.promptdjMidi;
    // Note: Python services returned as processes can be tracked here if needed for direct kill
    // but typically they are child processes of the shell or managed differently.
    // For now we trust the process tree cleanup, or you could add explicit globals for them too.

    debugLog('🔍 Debug: Final service results: ' + JSON.stringify(Object.keys(results)));

    // Notify window of success
    if (mainWindow) {
      mainWindow.webContents.send('services-ready', {
        success: true,
        services: {
          nodeServer: !!results.nodeServer,
          websocketServer: !!results.websocketServer,
          videoRenderer: !!results.videoRenderer,

          promptdjMidi: !!results.promptdjMidi,
          narrationService: !!results.narrationService,
          chatterboxService: !!results.chatterboxService,
          parakeetService: !!results.parakeetService
        },
        debug: {
          isDev: isDev,
          isPackaged: app.isPackaged,
          resourcesPath: process.resourcesPath
        }
      });
    }

    return results;
  } catch (error) {
    console.error('❌ Failed to start services:', error);
    if (mainWindow) {
      mainWindow.webContents.send('services-ready', {
        success: false,
        error: error.message
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
  if (websocketServerProcess) websocketServerProcess.kill();
  if (videoRendererProcess) videoRendererProcess.kill();

  if (promptdjMidiProcess) promptdjMidiProcess.kill();
  // Python services are handled via spawning logic, but we should kill them if we have refs
  // Note: startAllServices implementation above stores results in local scope, we need to update globals.
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

    promptdjMidi: {
      running: false,
      pid: null,
      port: PORTS.PROMPTDJ_MIDI
    },
    narrationService: { running: false, port: PORTS.NARRATION },
    chatterboxService: { running: false, port: PORTS.CHATTERBOX },
    parakeetService: { running: !!(pythonServiceManager && results.parakeetService), port: PORTS.PARAKEET }
  };
});

// App event handlers
app.whenReady().then(async () => {
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