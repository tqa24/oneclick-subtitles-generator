"""
Startup script for the Chatterbox FastAPI service.
"""

import uvicorn
import argparse
import sys
from pathlib import Path

# Add the server directory to the path to import the port config
sys.path.append(str(Path(__file__).parent.parent / "server"))
from config.cors_config import get_ports


def main():
    # Get centralized port configuration
    ports = get_ports()
    default_port = ports['CHATTERBOX']

    parser = argparse.ArgumentParser(description="Start Chatterbox TTS API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=default_port, help=f"Port to bind to (default: {default_port})")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument("--workers", type=int, default=1, help="Number of worker processes (default: 1)")
    parser.add_argument("--log-level", default="info", choices=["debug", "info", "warning", "error"], 
                       help="Log level (default: info)")
    
    args = parser.parse_args()
    
    # Check if api.py exists - handle both running from project root and from chatterbox-fastapi dir
    api_path = Path(__file__).parent / "api.py"
    if not api_path.exists():
        print(f"Error: api.py not found at {api_path}")
        sys.exit(1)
    
    print(f"Starting Chatterbox API server...")
    print(f"Host: {args.host}")
    print(f"Port: {args.port}")
    print(f"Workers: {args.workers}")
    print(f"Log level: {args.log_level}")
    print(f"Reload: {args.reload}")
    print(f"API docs will be available at: http://{args.host}:{args.port}/docs")
    print("-" * 50)
    
    # Change to the chatterbox-fastapi directory for uvicorn to find the api module
    import os
    os.chdir(Path(__file__).parent)
    
    uvicorn.run(
        "api:app",
        host=args.host,
        port=args.port,
        workers=args.workers if not args.reload else 1,  # reload doesn't work with multiple workers
        reload=args.reload,
        log_level=args.log_level,
        access_log=True
    )


if __name__ == "__main__":
    main()
