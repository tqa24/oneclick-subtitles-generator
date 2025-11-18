>>>>this log is recorded using Start-Process -FilePath PS C:\WORK_win\oneclick-subtitles-generator> Start-Process -FilePath "electron-dist\win-unpacked\One-Click Subtitles Generator.exe" -WindowStyle Normal
PS C:\WORK_win\oneclick-subtitles-generator> 
🚀 Electron app ready, creating window...
🚀 Starting services in production mode...
🔍 Debug: Starting service initialization...
🔍 Debug: isDev = false
🔍 Debug: app.isPackaged = true
🔍 Debug: process.resourcesPath = C:\WORK_win\oneclick-subtitles-generator\electron-dist\win-unpacked\resources
🔍 Debug: __dirname = C:\WORK_win\oneclick-subtitles-generator\electron-dist\win-unpacked\resources\app.asar\electron
🔍 Debug: process.cwd() = C:\WORK_win\oneclick-subtitles-generator
🚀 Starting all services...
🔧 Starting Express.js Backend Server on port 3031...
🔍 Debug: SERVER.SCRIPT_PATH = C:\WORK_win\oneclick-subtitles-generator\electron-dist\win-unpacked\resources\app.asar\server.js
🚀 Starting Express.js Backend Server...
[DEBUG] Service script path: C:\WORK_win\oneclick-subtitles-generator\electron-dist\win-unpacked\resources\app.asar.unpacked\server.js
[DEBUG] Service working directory: C:\WORK_win\oneclick-subtitles-generator\electron-dist\win-unpacked\resources\app.asar.unpacked
[DEBUG] Spawning service 'Express.js Backend Server' with node executable 'node.exe'
[Express.js Backend Server ERROR] node:internal/errors:540
      throw error;
      ^

TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received undefined    
    at Object.join (node:path:528:7)
    at Object.<anonymous> (C:\WORK_win\oneclick-subtitles-generator\electron-dist\win-unpacked\resources\app.asar.unpacked\server\startNarrationService.js:25:12)
    at Module._compile (node:internal/modules/cjs/loader:1706:14)
    at Object..js (node:internal/modules/cjs/loader:1839:10)
    at Module.load (node:internal/modules/cjs/loader:1441:32)
    at Function._load (node:internal/modules/cjs/loader:1263:12)
    at TracingChannel.traceSync (node:diagnostics_channel:322:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:237:24)
    at Module.require (node:internal/modules/cjs/loader:1463:12)
    at require (node:internal/modules/helpers:147:16) {
  code: 'ERR_INVALID_ARG_TYPE'
}

Node.js v22.20.0
Express.js Backend Server exited with code 1
(node:23420) electron: Failed to load URL: http://127.0.0.1:3037/ with error: ERR_CONNECTION_REFUSED
(Use `One-Click Subtitles Generator --trace-warnings ...` to show where the warning was created)    
❌ EXPRESS.JS BACKEND SERVER FAILED: Error: Express.js Backend Server failed to start (exit code: 1)
❌ Error details: Express.js Backend Server failed to start (exit code: 1) Error: Express.js Backend Server failed to start (exit code: 1)
    at Timeout._onTimeout (C:\WORK_win\oneclick-subtitles-generator\electron-dist\win-unpacked\resources\app.asar\electron\main.js:368:16)
    at listOnTimeout (node:internal/timers:581:17)
    at process.processTimers (node:internal/timers:519:7)
⚠️  Skipping other services to focus on backend server
🔍 Debug: Final results: {}