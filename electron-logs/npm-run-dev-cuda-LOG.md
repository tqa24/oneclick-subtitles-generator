>>>>>>this log is recorded by running npm run dev:cuda

PS C:\WORK_win\oneclick-subtitles-generator> npm run dev:cuda                                       

> subtitles-generator@1.0.0 dev:cuda
> node scripts/start-all.js

🚀 Starting One-Click Subtitles Generator...
🔧 Setting up environment variables for CORS configuration...
   FRONTEND_PORT=3030
   BACKEND_PORT=3031
   WEBSOCKET_PORT=3032
   VIDEO_RENDERER_PORT=3033
   VIDEO_RENDERER_FRONTEND_PORT=3034
   NARRATION_PORT=3035
   CHATTERBOX_PORT=3036
   PROMPTDJ_MIDI_PORT=3037
   PARAKEET_PORT=3038
✅ Environment variables configured
🧹 Cleaning up previous processes...
🧹 Cleaned up old process tracking file
🔍 Scanning for processes on application ports...
✅ No processes found on application ports
✅ Cleanup complete, starting services...
🚀 Starting all services: FRONTEND, SERVER, RENDERER, MIDI, PARAKEET with CUDA support...
[FRONTEND] > subtitles-generator@1.0.0 start
[FRONTEND] > npm run setup:react-env && npm run generate:version && node scripts/start-frontend.js  
[SERVER] > subtitles-generator@1.0.0 server:start
[SERVER] > node server.js
[RENDERER] > subtitles-generator@1.0.0 video-renderer:start
[RENDERER] > cd video-renderer && npm run server:start
[FRONTEND] > subtitles-generator@1.0.0 setup:react-env
[FRONTEND] > node scripts/generate-react-env.js
[FRONTEND] 🚀 Setting up React environment configuration
[FRONTEND] ==============================================
[FRONTEND] 🔧 Generating React environment variables...
[FRONTEND] ✅ React environment file created: C:\WORK_win\oneclick-subtitles-generator\.env.local   
[FRONTEND] 📋 Generated variables:
[FRONTEND]    REACT_APP_FRONTEND_PORT=3030
[FRONTEND]    REACT_APP_BACKEND_PORT=3031
[FRONTEND]    REACT_APP_WEBSOCKET_PORT=3032
[FRONTEND]    REACT_APP_VIDEO_RENDERER_PORT=3033
[FRONTEND]    REACT_APP_VIDEO_RENDERER_FRONTEND_PORT=3034
[FRONTEND]    REACT_APP_NARRATION_PORT=3035
[FRONTEND]    REACT_APP_CHATTERBOX_PORT=3036
[FRONTEND]    REACT_APP_PROMPTDJ_MIDI_PORT=3037
[FRONTEND]    REACT_APP_PARAKEET_PORT=3038
[FRONTEND] 📝 Creating React configuration file...
[FRONTEND] ✅ React configuration file created: C:\WORK_win\oneclick-subtitles-generator\src\config\appConfig.js
[FRONTEND] ✅ React environment setup completed successfully!
[FRONTEND] 📋 Next steps:
[FRONTEND]    1. Restart your React development server
[FRONTEND]    2. Update your components to use the new config:
[FRONTEND]       import { PORTS, API_URLS } from "../config/appConfig";
[FRONTEND]    3. The environment variables are automatically loaded
[RENDERER] > subtitle-video-maker@0.1.0 server:start
[RENDERER] > cross-env PORT=3033 node server/dist/index.js
[MIDI]   VITE v5.4.21  ready in 420 ms
[MIDI]   ➜  Local:   http://localhost:3037/
[MIDI]   ➜  Network: http://172.27.208.1:3037/
[MIDI]   ➜  Network: http://59.26.45.115:3037/
[PARAKEET] 2025-11-18 20:21:55,624 - __main__ - INFO - Starting Parakeet ASR FastAPI server...
[SERVER] 🚀 Starting narration services (F5-TTS + Chatterbox)...
[PARAKEET] INFO:     Started server process [26700]
[PARAKEET] INFO:     Waiting for application startup.
[PARAKEET] 2025-11-18 20:21:55,691 - __main__ - INFO - Loading ASR model: istupakov/parakeet-tdt-0.6b-v3-onnx...
[FRONTEND] > subtitles-generator@1.0.0 generate:version
[FRONTEND] > node scripts/generate-version.js
[SERVER] ✅ UV package manager found
[FRONTEND] 🚀 Generating version information from git...
[FRONTEND] 🔍 Extracting git commit information...
[RENDERER] 🚀 GPU Acceleration Configuration Loaded
[RENDERER] 🎬 Video Renderer Server running at http://localhost:3033
[RENDERER] ✅ High-performance pipeline is ACTIVE.
[RENDERER] 💡 Render dimension logic is now corrected for crop aspect ratio.
[FRONTEND] ✅ Git info extracted:
[FRONTEND]    Commit: 26e99735 (26e99735c30389e3743cb6cb39f78201d3e4f020)
[FRONTEND]    Date: 2025-11-18T20:04:30+09:00
[FRONTEND]    Branch: electron-app
[FRONTEND]    Clean: No (uncommitted changes)
[FRONTEND]    Build time: 2025-11-18T11:21:56.495Z
[FRONTEND] 📝 Version file generated: C:\WORK_win\oneclick-subtitles-generator\src\config\version.js
[FRONTEND]    Version: 2025.11.18-200430-26e99735
[FRONTEND] 🌍 Environment file generated: C:\WORK_win\oneclick-subtitles-generator\.env.version     
[FRONTEND] ✅ Version generation completed successfully!
[FRONTEND] 📋 Usage:
[FRONTEND]    - Import version info: import versionInfo from "./src/config/version.js"
[FRONTEND]    - Use in build: source .env.version before building
[FRONTEND]    - Environment variables are automatically available in React app
[FRONTEND] 🚀 Starting React frontend...
[FRONTEND] 📝 Tracking process React Frontend (PID: 10796) on port 3030
Fetching 5 files:   0%|          | 0/5 [00:00<?, ?it/s]
Fetching 5 files: 100%|##########| 5/5 [00:00<?, ?it/s]
[FRONTEND] > subtitles-generator@1.0.0 start-react
[FRONTEND] > cross-env PORT=3030 react-scripts start
[SERVER] Name: python-dateutil
[SERVER] Version: 2.9.0.post0
[SERVER] Location: C:\WORK_win\oneclick-subtitles-generator\.venv\Lib\site-packages
[SERVER] Requires: six
[SERVER] Required-by: botocore, matplotlib, pandas
[SERVER] ✅ F5-TTS narration service started on port 3035
[SERVER] 📝 Tracking process F5-TTS Narration (PID: 11048) on port 3035
[SERVER] 🔧 Starting Chatterbox API service on port 3036...
[SERVER] 📝 Tracking process Chatterbox API (PID: 24752) on port 3036
[SERVER] ✅ Chatterbox API service starting...
[SERVER] 📁 Working directory: C:\WORK_win\oneclick-subtitles-generator
[SERVER] 📁 Script path: chatterbox-fastapi\start_api.py
[SERVER] 🌐 Will be available at: http://localhost:3036
[SERVER] 📖 API documentation: http://localhost:3036/docs
[SERVER] ✅ Narration services startup completed
[SERVER] 📍 F5-TTS service: http://localhost:3035
[SERVER] 📍 Chatterbox service: http://localhost:3036
[SERVER] 🚀 Initializing server...
[SERVER] ℹ️  Port cleanup handled by dev-server, skipping...
[SERVER] ✅ Server initialization complete
[SERVER] 🌐 Server running on port 3031
[SERVER] 📝 Tracking process Express Server (PID: 26492) on port 3031
[SERVER] 📡 Progress WebSocket server started on port 3032
[SERVER] INFO:     Will watch for changes in these directories: ['C:\\WORK_win\\oneclick-subtitles-generator\\chatterbox-fastapi']
[SERVER] INFO:     Uvicorn running on http://0.0.0.0:3036 (Press CTRL+C to quit)
[SERVER] INFO:     Started reloader process [26912] using WatchFiles
[FRONTEND] (node:21908) [DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE] DeprecationWarning: 'onAfterSetupMiddleware' option is deprecated. Please use the 'setupMiddlewares' option.
[FRONTEND] (Use `node --trace-deprecation ...` to show where the warning was created)
[FRONTEND] (node:21908) [DEP_WEBPACK_DEV_SERVER_ON_BEFORE_SETUP_MIDDLEWARE] DeprecationWarning: 'onBeforeSetupMiddleware' option is deprecated. Please use the 'setupMiddlewares' option.
[PARAKEET] 2025-11-18 20:22:01,174 - __main__ - INFO - ASR model loaded successfully.
[PARAKEET] INFO:     Application startup complete.
[PARAKEET] INFO:     Uvicorn running on http://0.0.0.0:3038 (Press CTRL+C to quit)
[SERVER] 2025-11-18 20:22:02,213 - model_manager.constants - WARNING - huggingface_hub or huggingFaceCache module not found. Cache operations might be limited.
[SERVER] 2025-11-18 20:22:03,433 - narration_service.narration_edge_gtts - INFO - edge-tts library is available
[SERVER] 2025-11-18 20:22:03,445 - narration_service.narration_edge_gtts - INFO - gtts library is available
[SERVER] 2025-11-18 20:22:03,461 - __main__ - INFO - Starting F5-TTS Narration Service on port 3035
[SERVER]  * Serving Flask app 'narrationApp'
[SERVER]  * Debug mode: off
[SERVER] C:\WORK_win\oneclick-subtitles-generator\.venv\Lib\site-packages\perth\perth_net\__init__.py:1: UserWarning: pkg_resources is deprecated as an API. See https://setuptools.pypa.io/en/latest/pkg_resources.html. The pkg_resources package is slated for removal as early as 2025-11-30. Refrain from using this package or pin to Setuptools<81.
[SERVER]   from pkg_resources import resource_filename
[FRONTEND] Starting the development server...
[SERVER] INFO:     Started server process [24128]
[SERVER] INFO:     Waiting for application startup.
[SERVER] INFO:     Application startup complete.
[FRONTEND] Compiled with warnings.
[FRONTEND] [eslint] 
[FRONTEND] src\config\appConfig.js
[FRONTEND]   Line 31:1:  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
[FRONTEND] Search for the keywords to learn more about each warning.
[FRONTEND] To ignore, add // eslint-disable-next-line to the line before.
[FRONTEND] WARNING in [eslint] 
[FRONTEND] src\config\appConfig.js
[FRONTEND]   Line 31:1:  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
[FRONTEND]
[FRONTEND] webpack compiled with 1 warning
[SERVER] Current git branch: electron-app
[SERVER] Current git branch: electron-app