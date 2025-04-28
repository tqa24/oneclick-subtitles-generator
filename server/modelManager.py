import os
import json
import logging
import shutil
import requests
import time
from pathlib import Path
from huggingface_hub import hf_hub_download

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define constants
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models', 'f5_tts')
MODELS_REGISTRY_FILE = os.path.join(MODELS_DIR, 'models_registry.json')

# Ensure models directory exists
os.makedirs(MODELS_DIR, exist_ok=True)

def initialize_registry():
    """Initialize the models registry if it doesn't exist."""
    if not os.path.exists(MODELS_REGISTRY_FILE):
        with open(MODELS_REGISTRY_FILE, 'w') as f:
            json.dump({
                "active_model": None,
                "models": [],
                "downloads": {}
            }, f, indent=2)
        logger.info(f"Created new models registry at {MODELS_REGISTRY_FILE}")

    # Ensure the registry is valid
    try:
        with open(MODELS_REGISTRY_FILE, 'r') as f:
            registry = json.load(f)

        # Check if registry has required fields
        if "active_model" not in registry or "models" not in registry:
            raise ValueError("Invalid registry format")

        # Add downloads field if it doesn't exist
        if "downloads" not in registry:
            registry["downloads"] = {}
            with open(MODELS_REGISTRY_FILE, 'w') as f:
                json.dump(registry, f, indent=2)

    except Exception as e:
        logger.error(f"Error reading registry: {e}")
        # Reset registry if invalid
        with open(MODELS_REGISTRY_FILE, 'w') as f:
            json.dump({
                "active_model": None,
                "models": [],
                "downloads": {}
            }, f, indent=2)
        logger.info(f"Reset models registry due to error")

def get_registry():
    """Get the current models registry."""
    initialize_registry()
    try:
        with open(MODELS_REGISTRY_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading registry: {e}")
        return {"active_model": None, "models": []}

def save_registry(registry):
    """Save the models registry."""
    try:
        with open(MODELS_REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving registry: {e}")
        return False

def get_models():
    """Get list of available models."""
    registry = get_registry()
    return {
        "active_model": registry["active_model"],
        "models": registry["models"],
        "downloads": registry["downloads"]
    }

def get_download_status(model_id):
    """Get the download status of a model."""
    registry = get_registry()
    return registry["downloads"].get(model_id, None)

def update_download_status(model_id, status, progress=0, error=None):
    """Update the download status of a model."""
    registry = get_registry()

    registry["downloads"][model_id] = {
        "status": status,  # 'downloading', 'completed', 'failed'
        "progress": progress,
        "error": error,
        "timestamp": time.time()
    }

    save_registry(registry)
    return True

def remove_download_status(model_id):
    """Remove the download status of a model."""
    registry = get_registry()

    if model_id in registry["downloads"]:
        del registry["downloads"][model_id]
        save_registry(registry)

    return True

def get_active_model():
    """Get the currently active model."""
    registry = get_registry()
    return registry["active_model"]

def set_active_model(model_id):
    """Set the active model."""
    registry = get_registry()

    # Check if model exists
    model_exists = False
    for model in registry["models"]:
        if model["id"] == model_id:
            model_exists = True
            break

    if not model_exists:
        return False, f"Model {model_id} not found"

    registry["active_model"] = model_id
    if save_registry(registry):
        return True, f"Active model set to {model_id}"
    else:
        return False, "Failed to save registry"

def add_model(model_info):
    """Add a new model to the registry."""
    registry = get_registry()

    # Check if model already exists
    for model in registry["models"]:
        if model["id"] == model_info["id"]:
            return False, f"Model {model_info['id']} already exists"

    # Add model to registry
    registry["models"].append(model_info)

    # If this is the first model, set it as active
    if registry["active_model"] is None:
        registry["active_model"] = model_info["id"]

    if save_registry(registry):
        return True, f"Model {model_info['id']} added successfully"
    else:
        return False, "Failed to save registry"

def delete_model(model_id):
    """Delete a model from the registry and file system."""
    registry = get_registry()

    # Check if model exists
    model_to_delete = None
    for model in registry["models"]:
        if model["id"] == model_id:
            model_to_delete = model
            break

    if model_to_delete is None:
        return False, f"Model {model_id} not found"

    # Check if model is active
    if registry["active_model"] == model_id:
        return False, f"Cannot delete active model. Please set another model as active first."

    # Remove model from registry
    registry["models"] = [model for model in registry["models"] if model["id"] != model_id]

    # Delete model files if they exist
    model_dir = os.path.join(MODELS_DIR, model_id)
    if os.path.exists(model_dir):
        try:
            shutil.rmtree(model_dir)
            logger.info(f"Deleted model directory: {model_dir}")
        except Exception as e:
            logger.error(f"Error deleting model directory: {e}")
            return False, f"Error deleting model files: {str(e)}"

    if save_registry(registry):
        return True, f"Model {model_id} deleted successfully"
    else:
        return False, "Failed to save registry"

def download_model_from_hf(repo_id, model_path, vocab_path, config=None, model_id=None):
    """
    Download a model from Hugging Face Hub.

    Args:
        repo_id (str): Hugging Face repository ID (e.g., "SWivid/F5-TTS")
        model_path (str): Path to model file within the repo (e.g., "F5TTS_v1_Base/model_1250000.safetensors")
        vocab_path (str): Path to vocab file within the repo (e.g., "F5TTS_v1_Base/vocab.txt")
        config (dict, optional): Model configuration
        model_id (str, optional): Custom ID for the model, defaults to last part of repo_id

    Returns:
        tuple: (success, message, model_id)
    """
    # Generate model ID if not provided
    if model_id is None:
        model_id = repo_id.split('/')[-1]
        if '/' in model_path:
            model_id += '_' + model_path.split('/')[0]

    # Update download status to 'downloading'
    update_download_status(model_id, 'downloading')

    # Start download in a separate thread
    import threading
    thread = threading.Thread(
        target=_download_model_from_hf_thread,
        args=(repo_id, model_path, vocab_path, config, model_id)
    )
    thread.daemon = True
    thread.start()

    return True, f"Model download started for {model_id}", model_id

def _download_model_from_hf_thread(repo_id, model_path, vocab_path, config=None, model_id=None):
    """
    Thread function to download a model from Hugging Face Hub.
    """
    try:
        # Create model directory
        model_dir = os.path.join(MODELS_DIR, model_id)
        os.makedirs(model_dir, exist_ok=True)

        # Download model file
        logger.info(f"Downloading model from {repo_id}/{model_path}")
        update_download_status(model_id, 'downloading', 10)
        model_file = hf_hub_download(repo_id=repo_id, filename=model_path)
        update_download_status(model_id, 'downloading', 50)

        # Download vocab file
        logger.info(f"Downloading vocab from {repo_id}/{vocab_path}")
        vocab_file = hf_hub_download(repo_id=repo_id, filename=vocab_path)
        update_download_status(model_id, 'downloading', 80)

        # Copy files to model directory
        model_filename = os.path.basename(model_path)
        vocab_filename = os.path.basename(vocab_path)

        shutil.copy(model_file, os.path.join(model_dir, model_filename))
        shutil.copy(vocab_file, os.path.join(model_dir, vocab_filename))
        update_download_status(model_id, 'downloading', 90)

        # Create model info
        model_info = {
            "id": model_id,
            "name": model_id.replace('_', ' '),
            "repo_id": repo_id,
            "model_path": os.path.join(model_dir, model_filename),
            "vocab_path": os.path.join(model_dir, vocab_filename),
            "config": config or {},
            "source": "huggingface",
            "language": "unknown"  # Could be extracted from model ID or config
        }

        # Add model to registry
        success, message = add_model(model_info)

        if success:
            update_download_status(model_id, 'completed', 100)
            logger.info(f"Model {model_id} downloaded successfully")
        else:
            update_download_status(model_id, 'failed', 0, message)
            logger.error(f"Failed to add model {model_id}: {message}")

    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        update_download_status(model_id, 'failed', 0, str(e))

def parse_hf_url(url):
    """
    Parse a Hugging Face URL to extract repo_id and file path.

    Examples:
    - hf://SWivid/F5-TTS/F5TTS_v1_Base/model_1250000.safetensors
    - https://huggingface.co/SWivid/F5-TTS/blob/main/F5TTS_v1_Base/model_1250000.safetensors

    Returns:
        tuple: (repo_id, file_path)
    """
    if url.startswith('hf://'):
        # Format: hf://repo_id/file_path
        parts = url[5:].split('/', 1)
        if len(parts) == 2:
            return parts[0], parts[1]

    elif 'huggingface.co' in url:
        # Format: https://huggingface.co/repo_id/blob/branch/file_path
        parts = url.split('huggingface.co/', 1)
        if len(parts) == 2:
            path = parts[1]
            # Remove blob/main or blob/master if present
            if '/blob/' in path:
                repo_id, file_path = path.split('/blob/', 1)
                # Remove branch name
                if '/' in file_path:
                    branch, file_path = file_path.split('/', 1)
                    return repo_id, file_path

    return None, None

def download_model_from_url(model_url, vocab_url=None, config=None, model_id=None):
    """
    Download a model from direct URLs.

    Args:
        model_url (str): URL to model file
        vocab_url (str, optional): URL to vocab file
        config (dict, optional): Model configuration
        model_id (str, optional): Custom ID for the model

    Returns:
        tuple: (success, message, model_id)
    """
    # Generate model ID if not provided
    if model_id is None:
        model_id = os.path.basename(model_url).split('.')[0]

    # Update download status to 'downloading'
    update_download_status(model_id, 'downloading')

    # Start download in a separate thread
    import threading
    thread = threading.Thread(
        target=_download_model_from_url_thread,
        args=(model_url, vocab_url, config, model_id)
    )
    thread.daemon = True
    thread.start()

    return True, f"Model download started for {model_id}", model_id

def _download_model_from_url_thread(model_url, vocab_url=None, config=None, model_id=None):
    """
    Thread function to download a model from direct URLs.
    """
    try:
        # Create model directory
        model_dir = os.path.join(MODELS_DIR, model_id)
        os.makedirs(model_dir, exist_ok=True)

        # Download model file
        logger.info(f"Downloading model from {model_url}")
        update_download_status(model_id, 'downloading', 10)
        model_filename = os.path.basename(model_url)
        model_path = os.path.join(model_dir, model_filename)

        response = requests.get(model_url, stream=True)
        response.raise_for_status()

        with open(model_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        update_download_status(model_id, 'downloading', 50)

        # Download vocab file if provided
        vocab_path = None
        if vocab_url:
            logger.info(f"Downloading vocab from {vocab_url}")
            vocab_filename = os.path.basename(vocab_url)
            vocab_path = os.path.join(model_dir, vocab_filename)

            response = requests.get(vocab_url, stream=True)
            response.raise_for_status()

            with open(vocab_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

        update_download_status(model_id, 'downloading', 90)

        # Create model info
        model_info = {
            "id": model_id,
            "name": model_id.replace('_', ' '),
            "model_path": model_path,
            "vocab_path": vocab_path,
            "config": config or {},
            "source": "url",
            "language": "unknown"  # Could be extracted from model ID or config
        }

        # Add model to registry
        success, message = add_model(model_info)

        if success:
            update_download_status(model_id, 'completed', 100)
            logger.info(f"Model {model_id} downloaded successfully")
        else:
            update_download_status(model_id, 'failed', 0, message)
            logger.error(f"Failed to add model {model_id}: {message}")

    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        update_download_status(model_id, 'failed', 0, str(e))

# Initialize registry on module import
initialize_registry()
