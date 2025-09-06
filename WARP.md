# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

One-Click Subtitles Generator is a comprehensive web application for auto-subtitling videos, translating SRT files, generating AI narration with voice cloning, creating background images, and rendering professional subtitled videos.

## Key Technologies

- **Frontend**: React 18, Material-UI, Remotion (video rendering)
- **Backend**: Node.js/Express, Python (Flask/FastAPI for AI services)
- **AI Services**: Google Gemini API (transcription), F5-TTS (voice cloning), Chatterbox TTS
- **Video Processing**: FFmpeg, yt-dlp, Playwright
- **Package Management**: npm (Node), uv (Python)

## Common Development Commands

### Install Dependencies
```bash
# Full installation with voice cloning (8-12 GB)
npm run install:all

# Lite installation without voice cloning (2-3 GB)
npm install && node install-yt-dlp.js

# Quiet installation (minimal output)
npm run install:all:quiet
```

### Start Development Server
```bash
# Start all services (recommended for full development)
npm run dev

# Start with CUDA support for voice cloning (if GPU available)
npm run dev:cuda

# Start individual services
npm run start          # Frontend only (port 3030)
npm run server:start   # Backend only (port 3001)
npm run python:start   # Python narration service (port 5222)
```

### Build and Production
```bash
# Build frontend
npm run build

# Build video renderer
npm run video-renderer:build
```

### Testing
```bash
# Run tests
npm test

# Test Python narration service
npm run python:test

# Test services connectivity
npm run test:services

# Test Chatterbox import
npm run test:chatterbox-import

# Test port manager
npm run test:port-manager
```

### Video Renderer
```bash
# Start video renderer (runs on port 3033/3034)
npm run video-renderer:start

# Open Remotion studio for video development
cd video-renderer && npm run studio
```

## Architecture Overview

### Service Architecture
The application runs multiple services that communicate via HTTP APIs:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│                     Port: 3030                           │
└─────────────┬───────────────────────────────┬───────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────┐
│   Express Backend Server    │ │  Video Renderer Service  │
│       Port: 3001            │ │    Ports: 3033/3034      │
└─────────────┬───────────────┘ └─────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                   Python Services                        │
├─────────────────────────────┬───────────────────────────┤
│  F5-TTS Narration Service   │   Chatterbox TTS API      │
│       Port: 5222            │       Port: 5050          │
└─────────────────────────────┴───────────────────────────┘
```

### Key Directories

- **`/src`** - React frontend application
  - `/components` - React components (UI elements, modals, editors)
  - `/services` - API clients (Gemini, narration, video processing)
  - `/utils` - Utility functions (subtitle processing, video handling)
  - `/styles` - CSS and styled components
  - `/i18n` - Internationalization (English, Vietnamese, Korean)

- **`/server`** - Node.js backend
  - `/routes` - Express API routes
  - `/services` - Business logic (video download, cache, processing)
  - `/utils` - Server utilities (port management, file handling)
  - `narrationApp.py` - Python Flask app for F5-TTS voice cloning

- **`/video-renderer`** - Remotion-based video rendering service
  - `/src/remotion` - Remotion compositions for subtitle rendering
  - `/server` - TypeScript server for rendering API

- **`/chatterbox-fastapi`** - FastAPI service for Chatterbox TTS
  - `api.py` - Main API implementation
  - `start_api.py` - Service startup script

- **`/F5-TTS`** - Voice cloning model (submodule)

## Processing Flow

### Video Subtitle Generation Flow
1. **Input**: User provides video file, YouTube URL, or Douyin/TikTok link
2. **Download**: Backend uses yt-dlp to download video if URL provided
3. **Processing**: Two modes available:
   - **Simplified (Beta)**: Uses Gemini Files API for single-call processing
   - **Legacy**: Splits video into segments for parallel processing
4. **Transcription**: Gemini AI generates timed subtitles with configured prompts
5. **Editing**: Visual timeline editor for subtitle refinement
6. **Export**: SRT files or rendered videos with subtitles

### Voice Narration Flow
1. **Reference Audio**: Upload, record, or extract from video
2. **TTS Engine Selection**: F5-TTS (cloning), Chatterbox, Edge TTS, or Google TTS
3. **Generation**: Create AI voice for subtitles
4. **Audio Mixing**: Combine with original video audio

## Configuration

### Required API Keys
- **Gemini API Key** (required): Set in Settings → AI Configuration
- **YouTube API Key** (optional): For video search functionality

### Environment Variables
```bash
# Development ports (automatically configured)
PORT=3030                    # Frontend
EXPRESS_PORT=3001           # Backend
NARRATION_PORT=5222         # F5-TTS
CHATTERBOX_PORT=5050        # Chatterbox
VIDEO_RENDERER_PORT=3033    # Renderer backend
VIDEO_RENDERER_UI_PORT=3034 # Renderer frontend
```

### Python Environment
The application uses `uv` for Python package management. Virtual environment is created at `.venv` and managed automatically by npm scripts.

## Video Processing Modes

### Simplified Processing (Beta)
Enable in Settings → Video Processing → "Use Simplified Processing"
- Single Gemini API call for entire video
- Better performance for long videos
- No server-side video splitting required

### Legacy Processing
Default mode with segment-based processing:
- Videos split into configurable segments (default 60 seconds)
- Parallel processing for faster results
- Better for very long videos or limited API quotas

## GPU Acceleration

### For Video Rendering
Remotion uses GPU acceleration automatically when available:
- Windows: Vulkan/OpenGL
- macOS: Metal
- Linux: Vulkan

### For Voice Cloning
F5-TTS supports CUDA acceleration:
```bash
# Start with CUDA support
npm run dev:cuda

# Falls back to CPU if CUDA unavailable
```

## Troubleshooting

### Port Conflicts
```bash
# Check and kill processes on default ports
node server/utils/portManager.js

# Ports used: 3030, 3001, 3033, 3034, 5222, 5050
```

### Python Service Issues
```bash
# Recreate virtual environment
uv venv .venv --recreate

# Reinstall dependencies
npm run setup:narration:verbose

# Test Python environment
npm run test:python
```

### Video Download Issues
```bash
# Update yt-dlp
npm run install:yt-dlp:verbose

# Clear video cache
rm -rf videos/*
```

## Performance Optimization

### Caching Strategy
- **Subtitle Cache**: Prevents repeated Gemini API calls
- **Video Cache**: Local storage in `/videos` directory
- **Model Cache**: Hugging Face models in `/models`

### Memory Management
- React Window virtualization for long subtitle lists
- Automatic cleanup of temporary files
- Smart resource management for video processing

## Development Tips

### Hot Reloading
All services support hot reloading in development:
- Frontend: React Fast Refresh
- Backend: Nodemon watches server files
- Python: Flask/FastAPI with --reload flag

### Debug Mode
```javascript
// Enable debug logging in browser console
localStorage.setItem('debug_simplified_processing', 'true');
localStorage.setItem('debug_subtitle_sync', 'true');
```

### Service Health Check
```bash
# Check all services status
npm run test:services

# Manual health checks
curl http://localhost:3001/health
curl http://localhost:5222/health
curl http://localhost:5050/health
```

## File Formats

### Input Support
- **Video**: MP4, AVI, MOV, WebM, WMV, MKV
- **Audio**: MP3, WAV, AAC, FLAC, M4A
- **Subtitles**: SRT, JSON

### Output Formats
- **Subtitles**: SRT, JSON, custom formatted text
- **Video**: MP4 with burned-in subtitles (360p to 8K)
- **Audio**: WAV, MP3 for generated narration

## Deployment Considerations

### Production Build
```bash
# Build all components
npm run build
cd video-renderer && npm run build

# Start production servers
NODE_ENV=production npm run server:start
```

### Resource Requirements
- **Minimum**: 4GB RAM, 10GB disk space (Lite version)
- **Recommended**: 8GB RAM, 20GB disk space, GPU for voice cloning
- **Network**: Stable internet for API calls and video downloads
