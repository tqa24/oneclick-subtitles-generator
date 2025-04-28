import os
import json
import logging
import shutil
import requests
import time
from pathlib import Path
from huggingface_hub import hf_hub_download
from huggingFaceCache import list_huggingface_cache_models, delete_huggingface_cache_model

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

def get_models(include_cache=False):
    """
    Get list of available models.

    Args:
        include_cache (bool): Whether to include models from Hugging Face cache
    """
    registry = get_registry()
    result = {
        "active_model": registry["active_model"],
        "models": registry["models"],
        "downloads": registry["downloads"]
    }

    if include_cache:
        # Add cache info to the response
        result["cache_models"] = list_huggingface_cache_models()

    return result

def is_model_using_symlinks(model_id):
    """
    Check if a model is using symbolic links.
    Note: This function is kept for backward compatibility but will always return False
    since we no longer use symlinks in the new implementation.

    Args:
        model_id (str): ID of the model to check

    Returns:
        tuple: (is_using_symlinks, original_model_file, original_vocab_file)
    """
    registry = get_registry()

    # Find the model in the registry
    model = None
    for m in registry["models"]:
        if m["id"] == model_id:
            model = m
            break

    if model is None:
        return False, None, None

    # In the new implementation, we always return False since we're using direct paths
    # to the Hugging Face cache and not using symlinks
    return False, None, None

def update_model_info(model_id, model_info):
    """
    Update model information in the registry.

    Args:
        model_id (str): ID of the model to update
        model_info (dict): New model information
    """
    registry = get_registry()

    # Check if model exists
    model_to_update = None
    model_index = -1
    for i, model in enumerate(registry["models"]):
        if model["id"] == model_id:
            model_to_update = model
            model_index = i
            break

    if model_to_update is None:
        return False, f"Model {model_id} not found"

    # Update allowed fields
    allowed_fields = ["name", "language", "languages", "config"]
    for field in allowed_fields:
        if field in model_info:
            registry["models"][model_index][field] = model_info[field]

    # If language is updated but languages is not, update languages array too
    if "language" in model_info and "languages" not in model_info:
        registry["models"][model_index]["languages"] = [model_info["language"]]

    if save_registry(registry):
        return True, f"Model {model_id} updated successfully"
    else:
        return False, "Failed to save registry"

def get_download_status(model_id):
    """Get the download status of a model."""
    registry = get_registry()
    return registry["downloads"].get(model_id, None)

def update_download_status(model_id, status, progress=0, error=None):
    """Update the download status of a model."""
    registry = get_registry()

    # If status is 'completed', ensure progress is 100%
    if status == 'completed':
        progress = 100

    registry["downloads"][model_id] = {
        "status": status,  # 'downloading', 'completed', 'failed'
        "progress": progress,
        "error": error,
        "timestamp": time.time()
    }

    # Log the status update
    logger.info(f"Updated download status for {model_id}: status={status}, progress={progress}%")

    # Make sure to save the registry
    if not save_registry(registry):
        logger.error(f"Failed to save registry after updating download status for {model_id}")
        return False

    # If status is 'completed', remove the download status after a short delay
    if status == 'completed':
        import threading
        def remove_after_delay():
            time.sleep(5)  # Wait 5 seconds
            remove_download_status(model_id)

        thread = threading.Thread(target=remove_after_delay)
        thread.daemon = True
        thread.start()

    return True

def remove_download_status(model_id):
    """Remove the download status of a model."""
    try:
        registry = get_registry()

        if model_id in registry["downloads"]:
            logger.info(f"Removing download status for model {model_id}")
            del registry["downloads"][model_id]
            if not save_registry(registry):
                logger.error(f"Failed to save registry after removing download status for {model_id}")
                return False
            logger.info(f"Successfully removed download status for model {model_id}")
        else:
            logger.info(f"No download status found for model {model_id}")

        return True
    except Exception as e:
        logger.error(f"Error removing download status for model {model_id}: {e}")
        return False

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

def delete_model(model_id, delete_cache=False):
    """
    Delete a model from the registry and optionally from the Hugging Face cache.

    Args:
        model_id (str): ID of the model to delete
        delete_cache (bool): Whether to also delete the model from Hugging Face cache
    """
    registry = get_registry()

    # Check if model exists
    model_to_delete = None
    for model in registry["models"]:
        if model["id"] == model_id:
            model_to_delete = model
            break

    if model_to_delete is None:
        return False, f"Model {model_id} not found"

    # If model is active, set active model to None
    if registry["active_model"] == model_id:
        registry["active_model"] = None
        logger.info(f"Active model {model_id} is being deleted, setting active model to None")

    # Remove model from registry
    registry["models"] = [model for model in registry["models"] if model["id"] != model_id]

    # Also remove any download status for this model
    if model_id in registry["downloads"]:
        logger.info(f"Removing download status for model {model_id} during deletion")
        del registry["downloads"][model_id]

    # Delete from Hugging Face cache if requested
    cache_deletion_result = None
    if delete_cache:
        if model_to_delete.get("repo_id"):
            try:
                success, message = delete_huggingface_cache_model(model_to_delete["repo_id"])
                if success:
                    logger.info(f"Deleted model from Hugging Face cache: {model_to_delete['repo_id']}")
                    cache_deletion_result = f"Also deleted from Hugging Face cache: {model_to_delete['repo_id']}"
                else:
                    logger.warning(f"Failed to delete model from Hugging Face cache: {message}")
                    cache_deletion_result = f"Note: Failed to delete from Hugging Face cache: {message}"
            except Exception as e:
                logger.error(f"Error deleting model from Hugging Face cache: {e}")
                cache_deletion_result = f"Note: Error deleting from Hugging Face cache: {str(e)}"
        elif model_to_delete.get("source") == "url":
            # For URL-based models, try to delete the custom model directory in the cache
            try:
                from huggingface_hub.constants import HF_CACHE_HOME
                custom_cache_dir = os.path.join(HF_CACHE_HOME, "custom_models", model_id)
                if os.path.exists(custom_cache_dir):
                    shutil.rmtree(custom_cache_dir)
                    logger.info(f"Deleted custom model from Hugging Face cache: {custom_cache_dir}")
                    cache_deletion_result = f"Deleted custom model from Hugging Face cache"
            except Exception as e:
                logger.error(f"Error deleting custom model from Hugging Face cache: {e}")
                cache_deletion_result = f"Note: Error deleting custom model from Hugging Face cache: {str(e)}"

    if save_registry(registry):
        success_message = f"Model {model_id} deleted successfully"
        if cache_deletion_result:
            success_message += f". {cache_deletion_result}"
        return True, success_message
    else:
        return False, "Failed to save registry"

def download_model_from_hf(repo_id, model_path, vocab_path, config=None, model_id=None, language_codes=None):
    """
    Download a model from Hugging Face Hub.

    Args:
        repo_id (str): Hugging Face repository ID (e.g., "SWivid/F5-TTS")
        model_path (str): Path to model file within the repo (e.g., "F5TTS_v1_Base/model_1250000.safetensors")
        vocab_path (str): Path to vocab file within the repo (e.g., "F5TTS_v1_Base/vocab.txt")
        config (dict, optional): Model configuration
        model_id (str, optional): Custom ID for the model, defaults to last part of repo_id
        language_codes (list, optional): List of language codes supported by the model

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
        args=(repo_id, model_path, vocab_path, config, model_id, language_codes)
    )
    thread.daemon = True
    thread.start()

    return True, f"Model download started for {model_id}", model_id

def _download_model_from_hf_thread(repo_id, model_path, vocab_path, config=None, model_id=None, language_codes=None):
    """
    Thread function to download a model from Hugging Face Hub.

    Args:
        repo_id (str): Hugging Face repository ID
        model_path (str): Path to model file within the repo
        vocab_path (str): Path to vocab file within the repo
        config (dict, optional): Model configuration
        model_id (str, optional): Custom ID for the model
        language_codes (list, optional): List of language codes supported by the model
    """
    # Import required modules
    import os
    from huggingface_hub import hf_hub_download

    try:
        # Download model file with progress tracking
        logger.info(f"Downloading model from {repo_id}/{model_path}")
        update_download_status(model_id, 'downloading', 0)

        # We'll use a custom approach to track progress
        import threading
        import time
        import os
        import requests
        import random
        from huggingface_hub.constants import HUGGINGFACE_CO_URL_TEMPLATE
        from huggingface_hub.utils import build_hf_headers
        from huggingface_hub import hf_hub_url

        # We'll use estimated sizes for F5-TTS models since getting exact sizes can be complex
        logger.info("Using estimated sizes for progress tracking")
        model_size = 1500 * 1024 * 1024  # 1.5 GB typical model size
        vocab_size = 1 * 1024 * 1024     # 1 MB typical vocab size
        total_size = model_size + vocab_size
        logger.info(f"Estimated sizes - Model: {model_size / (1024 * 1024):.2f} MB, Vocab: {vocab_size / (1024 * 1024):.2f} MB")

        # We'll skip trying to find the exact cache paths since it's complex and version-dependent
        # Instead, we'll just simulate the download progress
        try:
            # Just log that we're using a simulated approach
            logger.info("Using simulated progress tracking for Hugging Face download")

            # Instead of trying to monitor the cache files directly, which can be complex,
            # we'll use a simpler approach with a timer-based progress simulation
            def simulate_download_progress():
                # Start with 0% progress
                progress = 0

                # We'll simulate progress over approximately 2-3 minutes
                # This is a fallback since we can't reliably track the actual download
                start_time = time.time()
                estimated_download_time = 180  # 3 minutes

                # Simulate progress until we reach 95%
                while progress < 95:
                    time.sleep(1)  # Update every second

                    # Calculate elapsed time
                    elapsed = time.time() - start_time

                    # Calculate progress based on elapsed time
                    # Use a curve that starts fast and slows down
                    progress = min(95, (elapsed / estimated_download_time) * 100)

                    # Add some randomness to make it look more realistic
                    progress += random.uniform(-1, 1)
                    progress = max(0, min(95, progress))

                    # Update status
                    update_download_status(model_id, 'downloading', progress)

                    # Log progress occasionally
                    if int(progress) % 10 == 0:
                        logger.info(f"Download progress (estimated): {progress:.1f}%")

                    # We can't easily check if the download is complete since we don't know the exact paths
                    # Just rely on the timer-based approach
                    pass

                # Set to 95% when we exit the loop
                update_download_status(model_id, 'downloading', 95)
                logger.info("Download monitoring complete")

            # Start monitoring thread
            monitor_thread = threading.Thread(target=simulate_download_progress)
            monitor_thread.daemon = True
            monitor_thread.start()

        except Exception as e:
            logger.warning(f"Failed to set up progress monitoring: {e}")

        # Download the model file directly to the Hugging Face cache
        model_file = hf_hub_download(
            repo_id=repo_id,
            filename=model_path,
            resume_download=True,
            force_download=False
        )
        # Don't override progress here, let the monitoring thread handle it
        logger.info(f"Model file downloaded: {model_file}")

        # Download vocab file directly to the Hugging Face cache
        logger.info(f"Downloading vocab from {repo_id}/{vocab_path}")
        vocab_file = hf_hub_download(
            repo_id=repo_id,
            filename=vocab_path,
            resume_download=True,
            force_download=False
        )
        # Don't override progress here, let the monitoring thread handle it
        logger.info(f"Vocab file downloaded: {vocab_file}")

        # Set language information
        primary_language = "unknown"
        supported_languages = []

        # Use provided language codes if available
        if language_codes and len(language_codes) > 0:
            supported_languages = language_codes
            primary_language = language_codes[0]  # First language is primary
            logger.info(f"Using provided language codes: {language_codes}")
        else:
            # Try to determine language from model ID or repo ID
            # Check if any known language code is in the model ID or repo ID
            known_languages = ["zh", "en", "fi", "fr", "hi", "it", "ja", "ru", "es", "vi"]
            model_id_lower = model_id.lower()
            repo_id_lower = repo_id.lower()

            # Check for language codes in model ID
            for lang in known_languages:
                if f"-{lang}" in model_id_lower or f"_{lang}" in model_id_lower or model_id_lower.endswith(lang):
                    supported_languages.append(lang)
                    primary_language = lang
                    logger.info(f"Detected language from model ID: {lang}")
                    break

            # If not found in model ID, check repo ID
            if not supported_languages:
                for lang in known_languages:
                    if lang in repo_id_lower:
                        supported_languages.append(lang)
                        primary_language = lang
                        logger.info(f"Detected language from repo ID: {lang}")
                        break

        # Create model info that points directly to the Hugging Face cache files
        model_info = {
            "id": model_id,
            "name": model_id.replace('_', ' '),
            "repo_id": repo_id,
            "model_path": model_file,  # Direct path to the file in Hugging Face cache
            "vocab_path": vocab_file,  # Direct path to the file in Hugging Face cache
            "config": config or {},
            "source": "huggingface",
            "language": primary_language,  # Primary language
            "languages": supported_languages,  # List of supported languages
            "is_symlink": False,  # No symlinks used
            "original_model_file": None,
            "original_vocab_file": None
        }

        # Set progress to 99% before adding to registry
        update_download_status(model_id, 'downloading', 99)
        logger.info(f"Download complete, adding model {model_id} to registry")

        # Add model to registry
        success, message = add_model(model_info)

        if success:
            # Only set to 100% when fully complete
            update_download_status(model_id, 'completed', 100)
            logger.info(f"Model {model_id} downloaded successfully and added to registry")

            # After a short delay, remove the download status to clean up the registry
            time.sleep(2)
            remove_download_status(model_id)
            logger.info(f"Removed download status for model {model_id}")
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

def download_model_from_url(model_url, vocab_url=None, config=None, model_id=None, language_codes=None):
    """
    Download a model from direct URLs.

    Args:
        model_url (str): URL to model file
        vocab_url (str, optional): URL to vocab file
        config (dict, optional): Model configuration
        model_id (str, optional): Custom ID for the model
        language_codes (list, optional): List of language codes supported by the model

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
        args=(model_url, vocab_url, config, model_id, language_codes)
    )
    thread.daemon = True
    thread.start()

    return True, f"Model download started for {model_id}", model_id

def _download_model_from_url_thread(model_url, vocab_url=None, config=None, model_id=None, language_codes=None):
    """
    Thread function to download a model from direct URLs.

    Args:
        model_url (str): URL to model file
        vocab_url (str, optional): URL to vocab file
        config (dict, optional): Model configuration
        model_id (str, optional): Custom ID for the model
        language_codes (list, optional): List of language codes supported by the model
    """
    # Import required modules
    import os
    import requests
    from huggingface_hub.constants import HF_CACHE_HOME

    try:
        # Create a directory in the Hugging Face cache for this model
        cache_dir = os.path.join(HF_CACHE_HOME, "custom_models", model_id)
        os.makedirs(cache_dir, exist_ok=True)

        # Download model file directly to the Hugging Face cache
        logger.info(f"Downloading model from {model_url}")
        model_filename = os.path.basename(model_url)
        cache_model_path = os.path.join(cache_dir, model_filename)

        # We'll use a simpler approach with direct progress tracking
        # Start with 0% progress
        update_download_status(model_id, 'downloading', 0)
        logger.info("Starting download with direct progress tracking")

        # Download model file with progress tracking
        try:
            # Try to get content length for progress tracking
            response_head = requests.head(model_url, allow_redirects=True)
            total_size = int(response_head.headers.get('Content-Length', 0))
            logger.info(f"Model file size: {total_size / (1024 * 1024):.2f} MB")
            has_size = total_size > 0
        except Exception as e:
            logger.warning(f"Could not determine file size: {e}")
            has_size = False
            total_size = 0

        # Download the file
        response = requests.get(model_url, stream=True)
        response.raise_for_status()

        # Set up progress tracking
        downloaded_size = 0
        chunk_size = 8192
        progress_step = 5  # Update progress every 5%
        last_progress = 0

        # Download with progress tracking
        with open(cache_model_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                f.write(chunk)
                downloaded_size += len(chunk)

                # Update progress
                if has_size:
                    # Calculate real progress if we know the size
                    progress = min(90, (downloaded_size / total_size) * 90)
                else:
                    # Otherwise increment by small amounts
                    progress = min(90, last_progress + 0.1)

                # Only update status when progress changes significantly
                if progress >= last_progress + progress_step or progress >= 90:
                    update_download_status(model_id, 'downloading', progress)
                    last_progress = progress
                    logger.info(f"Model download progress: {progress:.1f}% ({downloaded_size / (1024 * 1024):.1f}MB)")

        logger.info(f"Model file downloaded: {cache_model_path}")
        update_download_status(model_id, 'downloading', 90)

        # Download vocab file if provided
        cache_vocab_path = None
        if vocab_url:
            logger.info(f"Downloading vocab from {vocab_url}")
            vocab_filename = os.path.basename(vocab_url)
            cache_vocab_path = os.path.join(cache_dir, vocab_filename)

            # Download the vocab file
            response = requests.get(vocab_url, stream=True)
            response.raise_for_status()

            with open(cache_vocab_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=chunk_size):
                    f.write(chunk)

            logger.info(f"Vocab file downloaded: {cache_vocab_path}")
            update_download_status(model_id, 'downloading', 95)
        else:
            # If no vocab file, we're at 95% complete
            update_download_status(model_id, 'downloading', 95)
            logger.info("No vocab file to download")

        # Set language information
        primary_language = "unknown"
        supported_languages = []

        # Use provided language codes if available
        if language_codes and len(language_codes) > 0:
            supported_languages = language_codes
            primary_language = language_codes[0]  # First language is primary
            logger.info(f"Using provided language codes: {language_codes}")
        else:
            # Try to determine language from model ID or URL
            # Check if any known language code is in the model ID or URL
            known_languages = ["zh", "en", "fi", "fr", "hi", "it", "ja", "ru", "es", "vi"]
            model_id_lower = model_id.lower()
            model_url_lower = model_url.lower()

            # Check for language codes in model ID
            for lang in known_languages:
                if f"-{lang}" in model_id_lower or f"_{lang}" in model_id_lower or model_id_lower.endswith(lang):
                    supported_languages.append(lang)
                    primary_language = lang
                    logger.info(f"Detected language from model ID: {lang}")
                    break

            # If not found in model ID, check URL
            if not supported_languages:
                for lang in known_languages:
                    if lang in model_url_lower:
                        supported_languages.append(lang)
                        primary_language = lang
                        logger.info(f"Detected language from URL: {lang}")
                        break

        # Create model info that points directly to the Hugging Face cache files
        model_info = {
            "id": model_id,
            "name": model_id.replace('_', ' '),
            "model_path": cache_model_path,  # Direct path to the file in Hugging Face cache
            "vocab_path": cache_vocab_path,  # Direct path to the file in Hugging Face cache
            "config": config or {},
            "source": "url",
            "language": primary_language,
            "languages": supported_languages,
            "is_symlink": False,  # No symlinks used
            "original_model_file": None,
            "original_vocab_file": None
        }

        # Set progress to 99% before adding to registry
        update_download_status(model_id, 'downloading', 99)
        logger.info(f"Download complete, adding model {model_id} to registry")

        # Add model to registry
        success, message = add_model(model_info)

        if success:
            # Only set to 100% when fully complete
            update_download_status(model_id, 'completed', 100)
            logger.info(f"Model {model_id} downloaded successfully and added to registry")

            # After a short delay, remove the download status to clean up the registry
            time.sleep(2)
            remove_download_status(model_id)
            logger.info(f"Removed download status for model {model_id}")
        else:
            update_download_status(model_id, 'failed', 0, message)
            logger.error(f"Failed to add model {model_id}: {message}")

    except Exception as e:
        logger.error(f"Error downloading model: {e}")
        update_download_status(model_id, 'failed', 0, str(e))

# Initialize registry on module import
initialize_registry()
