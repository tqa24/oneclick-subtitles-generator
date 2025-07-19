"""
Startup script for the Chatterbox FastAPI service.
"""

import uvicorn
import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Start Chatterbox TTS API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    parser.add_argument("--workers", type=int, default=1, help="Number of worker processes (default: 1)")
    parser.add_argument("--log-level", default="info", choices=["debug", "info", "warning", "error"], 
                       help="Log level (default: info)")
    
    args = parser.parse_args()
    
    # Check if api.py exists
    if not Path("api.py").exists():
        print("Error: api.py not found in current directory")
        sys.exit(1)
    
    print(f"Starting Chatterbox API server...")
    print(f"Host: {args.host}")
    print(f"Port: {args.port}")
    print(f"Workers: {args.workers}")
    print(f"Log level: {args.log_level}")
    print(f"Reload: {args.reload}")
    print(f"API docs will be available at: http://{args.host}:{args.port}/docs")
    print("-" * 50)
    
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
