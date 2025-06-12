# Subtitled Video Maker

<div align="center">
  <img src="readme_assets/Screenshot%202025-03-26%20105427.png" width="400" />
  <img src="readme_assets/Screenshot%202025-03-26%20105510.png" width="400" />
  <img src="readme_assets/Screenshot%202025-03-26%20105612.png" width="400" />
  <img src="readme_assets/Screenshot%202025-03-26%20105618.png" width="400" />
  <img src="readme_assets/Screenshot%202025-03-26%20105623.png" width="400" />
  <img src="readme_assets/Screenshot%202025-03-26%20105642.png" width="400" />
</div>

A React + Remotion application for creating dynamic subtitled videos with multiple audio track support and GPU-accelerated rendering.

## Features

- Create subtitled videos with synchronized text
- Support for multiple audio tracks:
  - Main audio/video
  - Narration audio (optional)
- Volume controls for audio tracks
- Customizable subtitle styles:
  - Font size
  - Font family
  - Font weight
  - Text color
  - Text alignment
  - Line height
  - Letter spacing
  - Text transform
  - Background color
  - Background opacity
  - Border radius
  - Border width
  - Border color
  - Border style
  - Text shadow
  - Glow effect

- Theme switching (light/dark)
- Multi-language support
- Tab-based workspace
- Render queue management
- GPU-accelerated video rendering (Vulkan)
- Support for SRT and JSON subtitle formats

## Technologies

- Frontend:
  - React 19
  - Remotion (video rendering)
  - styled-components
  - React Router
- Backend:
  - Express
  - Multer (file uploads)
  - Remotion renderer

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Build the server:
```bash
npm run server:build
```

## Running the Application

Run the application in development mode:
```bash
npm run server:dev
```

## Development Notes

- The application uses Remotion for video rendering with GPU acceleration
- Backend provides file upload and video rendering endpoints
- Frontend manages the workspace and render queue
- Both light and dark themes are supported
- Multiple language support is implemented via LanguageContext

## Project Structure

- `src/` - Frontend React application
  - `components/` - Reusable components
  - `contexts/` - Application contexts
  - `remotion/` - Remotion video compositions
  - `services/` - API services
  - `utils/` - Utility functions
- `server/` - Backend Express server
  - `src/` - Server source code
  - `uploads/` - Uploaded files
  - `output/` - Rendered videos
