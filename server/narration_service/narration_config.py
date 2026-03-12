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
CUDA_RUNTIME_INFO = {
    "cuda_available": False,
    "selected_device": "cpu",
    "device_name": None,
    "device_capability": None,
    "device_arch": None,
    "supported_arches": [],
    "arch_compatible": False,
    "reason": None,
}


def _capability_to_arch(capability):
    """Convert a CUDA capability tuple like (12, 0) to 'sm_120'."""
    major, minor = capability
    return f"sm_{major}{minor}"


def _arch_list_supports_device(arch_list, device_arch):
    return any(arch == device_arch or arch.startswith(device_arch) for arch in arch_list)


def _detect_best_torch_device():
    info = {
        "cuda_available": False,
        "selected_device": "cpu",
        "device_name": None,
        "device_capability": None,
        "device_arch": None,
        "supported_arches": [],
        "arch_compatible": False,
        "reason": None,
    }

    if not torch.cuda.is_available():
        info["reason"] = "CUDA not available"
        return "cpu", info

    info["cuda_available"] = True

    try:
        if torch.cuda.device_count() > 1:
            torch.cuda.set_device(0)

        device_index = 0
        device_name = torch.cuda.get_device_name(device_index)
        capability = torch.cuda.get_device_capability(device_index)
        device_arch = _capability_to_arch(capability)
        supported_arches = list(getattr(torch.cuda, "get_arch_list", lambda: [])())

        info.update({
            "device_name": device_name,
            "device_capability": capability,
            "device_arch": device_arch,
            "supported_arches": supported_arches,
        })

        if supported_arches and not _arch_list_supports_device(supported_arches, device_arch):
            info["reason"] = (
                f"Installed PyTorch CUDA kernels support {', '.join(supported_arches)}, "
                f"but detected GPU '{device_name}' requires {device_arch}."
            )
            return "cpu", info

        selected_device = "cuda:0"
        _ = torch.tensor([1.0, 2.0], device=selected_device)
        info["arch_compatible"] = True
        info["selected_device"] = selected_device
        return selected_device, info
    except Exception as e:
        info["reason"] = f"CUDA available but failed to initialize/use: {e}"
        return "cpu", info

# --- F5-TTS Initialization ---
try:
    device, CUDA_RUNTIME_INFO = _detect_best_torch_device()
    if device.startswith("cuda"):
        logger.info(
            f"Using CUDA device {device} ({CUDA_RUNTIME_INFO['device_name']}, "
            f"{CUDA_RUNTIME_INFO['device_arch']}) for narration."
        )
    else:
        logger.warning(
            f"Using CPU for narration. {CUDA_RUNTIME_INFO['reason'] or 'CUDA is not available.'}"
        )



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
