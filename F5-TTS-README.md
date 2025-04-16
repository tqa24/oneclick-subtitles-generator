# F5-TTS Integration for Subtitles Generator

This document explains how to set up and use the F5-TTS integration for generating narration from subtitles.

## Prerequisites

Before you begin, make sure you have the following installed:
- Node.js and npm
- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) - A faster Python package installer and resolver

## Installation

### 1. Install All Dependencies

Run the following command to install all dependencies (Node.js and Python):

```bash
npm run install:all
```

This command will:
1. Install all Node.js dependencies
2. Create a Python virtual environment (.venv)
3. Install F5-TTS from the local directory
4. Install required Python dependencies (flask, flask-cors, soundfile, numpy, torch, torchaudio, vocos)

### 2. Manual Installation (if needed)

If you prefer to install dependencies manually, follow these steps:

#### Node.js Dependencies
```bash
npm install
```

#### F5-TTS and Python Dependencies
```bash
# Create Python virtual environment
uv venv .venv

# Install F5-TTS
uv pip install -e F5-TTS

# Install required Python packages
uv pip install flask flask-cors soundfile numpy torch torchaudio vocos
```

## Running the Application

To run the application with F5-TTS integration:

```bash
npm run dev
```

This command starts:
1. The React frontend (port 3005)
2. The Node.js server (port 3007)
3. The Python F5-TTS server (port 3006)

## Using the Narration Feature

### Setting Up Reference Audio

Before generating narration, you need to set up a reference audio:

1. **Upload Reference Audio**: Upload an audio file that contains the voice you want to use for narration.
2. **Record Reference Audio**: Record your voice directly in the browser.
3. **Extract from Video**: Extract a segment from the current video to use as reference.

The reference audio should be clear and contain a single speaker's voice.

### Generating Narration

Once you have set up a reference audio:

1. Translate your subtitles using the translation feature.
2. Scroll down to the "Generate Narration" section below the translation results.
3. Click the "Generate Narration" button.
4. Wait for the narration to be generated for all subtitles.
5. Play or download individual narration files.

## Troubleshooting

### F5-TTS Not Available

If you see a message that "Narration service is not available", check:

1. Make sure the Python server is running (check terminal for errors)
2. Verify that F5-TTS is installed correctly
3. Check if required Python dependencies are installed

### Checking uv Installation

If you're having issues with uv, you can check if it's installed and working correctly:

```bash
npm run check:uv
```

### Testing Python with uv

To test if uv can run Python scripts correctly:

```bash
npm run test:python
```

### Running with Test Narration Service

If you're having issues with the F5-TTS integration, you can run the application with a test narration service that doesn't require F5-TTS:

```bash
npm run dev:test
```

Or use the provided scripts:
- On Windows: Run `run-with-test-service.bat`
- On macOS/Linux: Run `./run-with-test-service.sh`

This will start the application with a simple test narration service that always returns success responses, allowing you to test the UI without needing F5-TTS installed.

### Audio Playback Issues

If you can't hear the generated audio:

1. Check your browser's audio settings
2. Try downloading the audio file and playing it in a media player
3. Verify that the audio files are being generated correctly in the `narration/output` directory

## Technical Details

The F5-TTS integration consists of:

1. **Python Backend**: Handles the F5-TTS model and audio processing
2. **Node.js Proxy**: Routes requests between the frontend and Python backend
3. **React Components**: UI for setting up reference audio and generating narration

Audio files are stored in:
- `narration/reference`: Reference audio files
- `narration/output`: Generated narration files
