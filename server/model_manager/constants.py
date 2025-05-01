"""
Constants and configuration for the model manager.
"""
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Define constants
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'models', 'f5_tts')
MODELS_REGISTRY_FILE = os.path.join(MODELS_DIR, 'models_registry.json')

# Ensure models directory exists
os.makedirs(MODELS_DIR, exist_ok=True)

# Dictionary to track download threads and cancellation flags
download_threads = {}
