"""
Unified CORS Configuration for Python Services
This ensures consistent CORS settings across all Python microservices
All ports are sourced from the centralized config only
"""

import os
import json

def get_ports():
    """
    Get port configuration from the centralized JavaScript config
    Falls back to default values if config is not available
    """
    # Default ports matching server/config.js
    default_ports = {
        'FRONTEND': 3030,
        'BACKEND': 3031,
        'WEBSOCKET': 3032,
        'VIDEO_RENDERER': 3033,
        'VIDEO_RENDERER_FRONTEND': 3034,
        'NARRATION': 3035,
        'CHATTERBOX': 3036
    }
    
    # Try to read from environment variables first (set by Node.js processes)
    ports = {}
    for key, default_value in default_ports.items():
        env_key = f"{key}_PORT"
        ports[key] = int(os.environ.get(env_key, default_value))
    
    return ports

def get_allowed_origins():
    """
    Generate allowed origins for CORS based on unified port configuration
    Includes both localhost and 127.0.0.1 for maximum compatibility
    """
    ports = get_ports()
    origins = []
    
    # Add all service ports with both localhost and 127.0.0.1
    for port in ports.values():
        origins.append(f"http://localhost:{port}")
        origins.append(f"http://127.0.0.1:{port}")
    
    return origins

def get_flask_cors_config():
    """
    Standard CORS configuration for Flask services
    """
    return {
        'origins': get_allowed_origins(),
        'supports_credentials': True,
        'allow_headers': ['Content-Type', 'Authorization', 'Accept']
    }

def get_fastapi_cors_config():
    """
    Standard CORS configuration for FastAPI services
    """
    return {
        'allow_origins': get_allowed_origins(),
        'allow_credentials': True,
        'allow_methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'allow_headers': ['*']
    }

def get_cors_headers(request_origin=None):
    """
    CORS headers for manual implementation
    """
    allowed_origins = get_allowed_origins()
    ports = get_ports()
    
    # Check if the request origin is in our allowed list
    if request_origin and request_origin in allowed_origins:
        origin = request_origin
    else:
        # Default to frontend origin if request origin is not in allowed list
        origin = f"http://localhost:{ports['FRONTEND']}"
    
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, Pragma, Expires',
        'Access-Control-Allow-Credentials': 'true'
    }
