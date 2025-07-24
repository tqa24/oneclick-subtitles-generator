import os
import sys
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add the current directory to the path so we can import narration_service
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from narration_service import narration_bp

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
# Configure CORS to allow requests from the frontend origin with credentials - using unified port configuration
CORS(app, resources={r"/*": {"origins": ["http://localhost:3030", "http://127.0.0.1:3030"], "supports_credentials": True}}, allow_headers=["Content-Type", "Authorization", "Accept"])

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    # Check the request origin and set the appropriate CORS header
    request_origin = request.headers.get('Origin')
    # Use unified port configuration - frontend is on port 3030
    allowed_origins = ['http://localhost:3030', 'http://127.0.0.1:3030']

    if request_origin in allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', request_origin)
    else:
        # Default to localhost if origin not in allowed list
        response.headers.add('Access-Control-Allow-Origin', 'http://127.0.0.1:3030')

    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Register blueprints
app.register_blueprint(narration_bp, url_prefix='/api/narration')

# Default route
@app.route('/')
def index():
    # Get GPU info if available
    gpu_info = {}
    try:
        import torch
        if torch.cuda.is_available():
            gpu_info = {
                'cuda_available': True,
                'device_name': torch.cuda.get_device_name(0),
                'device_count': torch.cuda.device_count(),
                'current_device': torch.cuda.current_device(),
                'memory_allocated': f"{torch.cuda.memory_allocated(0) / 1024**2:.2f} MB",
                'memory_reserved': f"{torch.cuda.memory_reserved(0) / 1024**2:.2f} MB"
            }
        else:
            gpu_info = {'cuda_available': False}
    except ImportError:
        gpu_info = {'cuda_available': False, 'error': 'torch not installed'}
    except Exception as e:
        gpu_info = {'cuda_available': False, 'error': str(e)}

    return jsonify({
        'status': 'ok',
        'message': 'F5-TTS Narration Service is running',
        'gpu_info': gpu_info
    })

if __name__ == '__main__':
    # Use unified port configuration - no fallback ports
    port = int(os.environ.get('NARRATION_PORT', 3035))

    try:
        logger.info(f"Starting F5-TTS Narration Service on port {port}")

        # Write the port to a file so the main server can find it
        port_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'narration_port.txt')
        with open(port_file, 'w') as f:
            f.write(str(port))

        # Start the server on the specified port
        app.run(host='0.0.0.0', port=port, debug=True)

    except OSError as e:
        logger.error(f"Failed to start server on port {port}: {e}")
        logger.error("Make sure the port is not already in use")
        sys.exit(1)
