# CORS Configuration Guide

This document explains the centralized CORS (Cross-Origin Resource Sharing) configuration for the One-Click Subtitles Generator application.

## Overview

The application uses a **centralized CORS configuration** that ensures all microservices can communicate with each other without CORS errors. All port configurations are managed from a single source of truth.

## Architecture

### Centralized Configuration Files

1. **`server/config.js`** - Main configuration file with unified port definitions
2. **`server/config/corsConfig.js`** - Node.js CORS configuration
3. **`server/config/cors_config.py`** - Python CORS configuration
4. **`src/config/appConfig.js`** - React frontend configuration (auto-generated)
5. **`.env.local`** - React environment variables (auto-generated)

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3030 | React application |
| Backend | 3031 | Express.js API server |
| WebSocket | 3032 | Real-time progress tracking |
| Video Renderer | 3033 | Remotion video rendering service |
| Video Renderer Frontend | 3034 | Video renderer React UI |
| Narration Service | 3035 | F5-TTS Flask service |
| Chatterbox Service | 3036 | Better-chatterbox FastAPI service |

## CORS Configuration Details

### Allowed Origins

All services accept requests from:
- `http://localhost:[PORT]` for each service port
- `http://127.0.0.1:[PORT]` for each service port

### Allowed Methods

- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

### Allowed Headers

- `Content-Type`
- `Authorization`
- `Cache-Control`
- `Pragma`
- `Expires`

### Credentials

- `credentials: true` - Allows cookies and authentication headers

## Service-Specific Configurations

### Express.js Services (Backend, Video Renderer)

Uses the `cors` middleware with configuration from `server/config/corsConfig.js`:

```javascript
const { EXPRESS_CORS_CONFIG } = require('./server/config/corsConfig');
app.use(cors(EXPRESS_CORS_CONFIG));
```

### Flask Service (Narration)

Uses `flask-cors` with configuration from `server/config/cors_config.py`:

```python
from config.cors_config import get_flask_cors_config
flask_cors_config = get_flask_cors_config()
CORS(app, resources={r"/*": flask_cors_config})
```

### FastAPI Service (Chatterbox)

Uses `CORSMiddleware` with configuration from `server/config/cors_config.py`:

```python
from config.cors_config import get_fastapi_cors_config
fastapi_cors_config = get_fastapi_cors_config()
app.add_middleware(CORSMiddleware, **fastapi_cors_config)
```

### React Frontend

Uses auto-generated configuration from `src/config/appConfig.js`:

```javascript
import { API_URLS, PORTS } from '../config/appConfig';
const CHATTERBOX_API_BASE_URL = API_URLS.CHATTERBOX;
```

The React configuration is automatically generated from the centralized server configuration and uses environment variables with the `REACT_APP_` prefix.

## Setup and Testing

### Automatic Setup

CORS configuration is automatically set up when starting the application:

```bash
# Development mode (includes CORS setup)
npm run dev

# Production mode
npm run start:all
```

### Manual Setup

To manually configure CORS environment variables:

```bash
npm run setup:cors
```

To manually set up React environment variables:

```bash
npm run setup:react-env
```

### Testing CORS Configuration

To verify all services have proper CORS configuration:

```bash
npm run test:cors
```

This will test:
- Basic CORS headers for all services
- Preflight OPTIONS requests
- Cross-origin requests between services

## Troubleshooting

### Common CORS Errors

1. **"No 'Access-Control-Allow-Origin' header is present"**
   - Service is not running or CORS is not configured
   - Run `npm run setup:cors` and restart services

2. **"Response to preflight request doesn't pass access control check"**
   - OPTIONS method not properly handled
   - Check service-specific CORS middleware configuration

3. **"CORS policy: credentials mode is 'include'"**
   - Credentials not properly configured
   - Verify `credentials: true` in CORS configuration

### Debugging Steps

1. **Check if all services are running:**
   ```bash
   npm run test:services
   ```

2. **Verify CORS configuration:**
   ```bash
   npm run test:cors
   ```

3. **Check service health endpoints:**
   - Backend: http://localhost:3031/api/health
   - Video Renderer: http://localhost:3033/health
   - Narration: http://localhost:3035/health
   - Chatterbox: http://localhost:3036/health

4. **Inspect browser network tab:**
   - Look for preflight OPTIONS requests
   - Check response headers for CORS headers
   - Verify request origins match allowed origins

### Manual CORS Header Verification

You can manually test CORS headers using curl:

```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: http://localhost:3030" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  http://localhost:3031/api/health

# Test actual request
curl -X GET \
  -H "Origin: http://localhost:3030" \
  http://localhost:3031/api/health
```

## Configuration Updates

### Adding New Services

1. Add the new service port to `server/config.js`:
   ```javascript
   const PORTS = {
     // ... existing ports
     NEW_SERVICE: parseInt(process.env.NEW_SERVICE_PORT) || 3037
   };
   ```

2. The CORS configuration will automatically include the new service

3. Restart all services to apply changes

### Modifying CORS Settings

1. **For Node.js services:** Update `server/config/corsConfig.js`
2. **For Python services:** Update `server/config/cors_config.py`
3. Restart affected services

## Security Considerations

- **Development vs Production:** In production, consider restricting origins to specific domains
- **Credentials:** Only enable credentials if authentication is required
- **Headers:** Limit allowed headers to those actually needed by your application

## Best Practices

1. **Always use the centralized configuration** - Don't hardcode ports or origins
2. **Test CORS after changes** - Run `npm run test:cors` after configuration updates
3. **Monitor browser console** - Check for CORS errors during development
4. **Use environment variables** - Allow port configuration through environment variables
