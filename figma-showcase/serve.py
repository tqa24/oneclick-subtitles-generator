#!/usr/bin/env python3
"""
Simple HTTP server to serve the shapes showcase with proper CORS headers
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    # Change to the project root directory (parent of figma-showcase)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    os.chdir(project_root)
    
    PORT = 8080
    
    print(f"🚀 Starting shapes showcase server...")
    print(f"📁 Serving from: {project_root}")
    print(f"🌐 Open in browser: http://localhost:{PORT}/figma-showcase/shapes-review.html")
    print(f"⏹️  Press Ctrl+C to stop")
    
    try:
        with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        sys.exit(0)

if __name__ == "__main__":
    main()
