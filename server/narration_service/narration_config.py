import os
import logging
import sys
import codecs
import torch

# Set up logging with UTF-8 encoding
# Force UTF-8 encoding for stdout and stderr if not already set
try:
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
except Exception as e:
    print(f"Warning: Could not force UTF-8 encoding for stdout/stderr: {e}")

# Configure logging
# Use basicConfig only if no handlers are configured yet to avoid duplicate logs
if not logging.root.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        encoding='utf-8',
        handlers=[logging.StreamHandler(sys.stdout)] # Explicitly use the configured stdout
    )
logger = logging.getLogger(__name__)

# Constants
# Use absolute path relative to this file's location
SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_ROOT_DIR = os.path.dirname(os.path.dirname(SERVICE_DIR))  # Go up two levels to get to the root
NARRATION_DIR = os.path.join(APP_ROOT_DIR, 'narration')
REFERENCE_AUDIO_DIR = os.path.join(NARRATION_DIR, 'reference')
OUTPUT_AUDIO_DIR = os.path.join(NARRATION_DIR, 'output')

# Create directories if they don't exist
os.makedirs(NARRATION_DIR, exist_ok=True)
os.makedirs(REFERENCE_AUDIO_DIR, exist_ok=True)
os.makedirs(OUTPUT_AUDIO_DIR, exist_ok=True)



# Initialize variables
HAS_F5TTS = False
INIT_ERROR = None
device = None

# --- F5-TTS Initialization ---
try:
    # Check if CUDA is available
    cuda_available = torch.cuda.is_available()


    if cuda_available:
        try:
            # Explicitly set to device 0 if multiple GPUs exist
            if torch.cuda.device_count() > 1:
                torch.cuda.set_device(0)

            device = "cuda:0"

            # Small test allocation to confirm CUDA is working
            _ = torch.tensor([1.0, 2.0]).to(device)

        except Exception as e:
            logger.error(f"CUDA available but failed to initialize/use: {e}. Falling back to CPU.", exc_info=True)
            device = "cpu"
            cuda_available = False # Update flag
    else:
        logger.warning("CUDA not available, using CPU.")
        device = "cpu"



    # Import from model_manager package instead of modelManager.py
    from model_manager import initialize_registry
    # Initialize registry to ensure default model is registered
    initialize_registry()


    # Set flag to indicate F5-TTS is available
    HAS_F5TTS = True
    INIT_ERROR = None


except ImportError as e:
    logger.warning(f"F5-TTS library or dependencies not found. Narration features will be disabled. Error: {e}")
    HAS_F5TTS = False
    INIT_ERROR = f"F5-TTS or dependency not found: {str(e)}"
    device = None # No device relevant if library missing
except Exception as e:
    logger.error(f"Error during F5-TTS initialization checks: {e}", exc_info=True)
    HAS_F5TTS = False
    INIT_ERROR = f"Error initializing F5-TTS environment: {str(e)}"
    device = None
