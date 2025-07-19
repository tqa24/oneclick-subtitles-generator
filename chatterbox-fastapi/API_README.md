# Chatterbox FastAPI Service

A clean, production-ready FastAPI wrapper for Chatterbox TTS that exposes only the 2 primary controls for optimal simplicity and integration.

## Features

- **Simplified Controls**: Only exposes `exaggeration` and `cfg_weight` - the two most important parameters
- **Optimal Defaults**: All other parameters are set to optimal values automatically
- **Production Ready**: FastAPI with proper error handling, validation, and documentation
- **Easy Integration**: Clean REST API that any system can consume
- **Auto Documentation**: Swagger/OpenAPI docs generated automatically
- **Multiple Endpoints**: Basic TTS, TTS with custom voice, and voice conversion

## Quick Start

### 1. Install Dependencies

```bash
# Install FastAPI dependencies (in addition to existing chatterbox requirements)
pip install -r requirements-api.txt
```

### 2. Start the Server

```bash
# Simple start
python start_api.py

# With custom settings
python start_api.py --host 0.0.0.0 --port 8000 --reload

# For production (multiple workers)
python start_api.py --workers 4 --log-level warning
```

### 3. Access the API

- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and model loading information.

### Basic Text-to-Speech
```
POST /tts/generate
Content-Type: application/json

{
    "text": "Your text here",
    "exaggeration": 0.5,    // 0.25-2.0, neutral=0.5
    "cfg_weight": 0.5       // 0.0-1.0, controls pace
}
```

### TTS with Custom Voice
```
POST /tts/generate-with-voice
Content-Type: multipart/form-data

text: "Your text here"
exaggeration: 0.5
cfg_weight: 0.5
voice_file: [audio file]
```

### Voice Conversion
```
POST /vc/convert
Content-Type: multipart/form-data

input_audio: [audio file to convert]
target_voice: [reference voice file]
```

## Primary Controls Explained

### Exaggeration (0.25 - 2.0)
- **0.5**: Neutral, natural speech
- **< 0.5**: More subdued, less emotional
- **> 0.5**: More expressive, emotional
- **1.5-2.0**: Highly exaggerated (can be unstable)

### CFG Weight (0.0 - 1.0)
- **0.5**: Balanced guidance and pace
- **< 0.5**: Faster pace, less guidance (good for fast speakers)
- **> 0.5**: Slower pace, stronger guidance
- **0.3**: Recommended for reference voices with fast speaking style

## Usage Examples

### Python Client
```python
import requests

# Basic generation
response = requests.post("http://localhost:8000/tts/generate", json={
    "text": "Hello world!",
    "exaggeration": 0.7,
    "cfg_weight": 0.4
})

with open("output.wav", "wb") as f:
    f.write(response.content)
```

### cURL
```bash
# Basic TTS
curl -X POST "http://localhost:8000/tts/generate" \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello world!", "exaggeration": 0.5, "cfg_weight": 0.5}' \
     --output output.wav

# TTS with voice file
curl -X POST "http://localhost:8000/tts/generate-with-voice" \
     -F "text=Hello world!" \
     -F "exaggeration=0.7" \
     -F "cfg_weight=0.4" \
     -F "voice_file=@reference_voice.wav" \
     --output output_with_voice.wav
```

### JavaScript/Fetch
```javascript
// Basic generation
const response = await fetch('http://localhost:8000/tts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        text: "Hello world!",
        exaggeration: 0.5,
        cfg_weight: 0.5
    })
});

const audioBlob = await response.blob();
```

## Optimal Settings Guide

### General Use
- `exaggeration: 0.5`, `cfg_weight: 0.5` - Works well for most cases

### Fast Speaking Reference Voice
- `exaggeration: 0.5`, `cfg_weight: 0.3` - Improves pacing

### Emotional/Expressive Speech
- `exaggeration: 0.7-1.2`, `cfg_weight: 0.5` - More dramatic

### Calm/Professional Speech
- `exaggeration: 0.3-0.4`, `cfg_weight: 0.6` - More controlled

## Integration Tips

### For Microservices
- Use Docker to containerize the API
- Set up health checks on `/health` endpoint
- Use multiple workers for production load

### For Real-time Applications
- Consider WebSocket endpoints for streaming (not implemented yet)
- Cache model loading by keeping the service running
- Use async clients to avoid blocking

### For Batch Processing
- Use the API with job queues (Celery, RQ, etc.)
- Implement rate limiting if needed
- Consider file upload size limits

## Error Handling

The API returns standard HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `422`: Validation error
- `500`: Internal server error
- `503`: Service unavailable (models not loaded)

## Performance Notes

- **Model Loading**: Models are loaded once on startup (takes ~30 seconds)
- **Generation Time**: ~2-5 seconds per request depending on text length
- **Memory Usage**: ~4-6GB GPU memory required
- **Concurrency**: Single worker recommended due to GPU memory constraints

## Files Created

- `api.py` - Main FastAPI application
- `start_api.py` - Server startup script
- `client_example.py` - Example client usage
- `requirements-api.txt` - Additional dependencies
- `API_README.md` - This documentation

## Why Only 2 Controls?

Based on analysis of the Chatterbox codebase, while there are many parameters available, `exaggeration` and `cfg_weight` are the two most impactful controls for end users:

1. **Exaggeration** controls emotional intensity - the unique feature of Chatterbox
2. **CFG Weight** controls pacing and guidance strength - critical for quality

All other parameters are set to optimal defaults based on the original research and testing. This keeps the API simple while delivering the best results.
