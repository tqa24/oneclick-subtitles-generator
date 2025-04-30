import os
import json
import logging
import shutil
import requests
import time
import threading
from pathlib import Path

# Dictionary to track download threads and cancellation flags
download_threads = {}
from huggingface_hub import hf_hub_download
from huggingFaceCache import list_huggingface_cache_models, delete_huggingface_cache_model

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Note on language detection:
# This module uses a flexible approach to detect language codes from model IDs and URLs.
# Instead of using a hardcoded list of language codes, it uses regex patterns to find
# common language code formats (like 'en', 'zh', etc.) in model IDs and URLs.
# This allows for better compatibility with the frontend's language list in ModelList.js
# and avoids mismatches when new models are added.

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

        # Check if F5-TTS v1 Base model is in the registry
        # This is the default model that's always available
        f5tts_base_exists = False
        for model in registry["models"]:
            if model["id"] == "f5tts-v1-base":
                f5tts_base_exists = True
                break

        # Add F5-TTS v1 Base model if it's not in the registry
        if not f5tts_base_exists:
            # Add a simple entry for the default model without trying to find it in cache
            # Since we know the narration service can use it regardless
            registry["models"].append({
                "id": "f5tts-v1-base",
                "name": "F5-TTS v1 Base",
                "repo_id": "SWivid/F5-TTS",
                "model_path": "default",  # Special marker to indicate this is the default model
                "vocab_path": "default",  # Special marker to indicate this is the default model
                "config": {
                    "dim": 1024,
                    "depth": 22,
                    "heads": 16,
                    "ff_mult": 2,
                    "text_dim": 512,
                    "conv_layers": 4
                },
                "source": "default",
                "language": "en",
                "languages": ["en", "zh"],
                "is_symlink": False,
                "original_model_file": None,
                "original_vocab_file": None
            })

            # If no active model is set, set this as active
            if registry["active_model"] is None:
                registry["active_model"] = "f5tts-v1-base"

            # Save the updated registry
            with open(MODELS_REGISTRY_FILE, 'w') as f:
                json.dump(registry, f, indent=2)

            logger.info("Added F5-TTS v1 Base model to registry as the default model")

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

def update_download_status(model_id, status, progress=0, error=None, downloaded_size=None, total_size=None):
    """Update the download status of a model."""
    registry = get_registry()

    # If status is 'completed', ensure progress is 100% and remove it immediately
    if status == 'completed':
        progress = 100
        # Log the completion with 100%
        logger.info(f"Download completed for {model_id}: 100.0%")
        # Remove the download status immediately
        remove_download_status(model_id)
        return True
    else:
        # Round progress to 1 decimal place
        progress = round(progress, 1)

        # Create the status object
        if downloaded_size is not None:
            # If we have size information, include both size and calculated progress
            status_obj = {
                "status": status,  # 'downloading', 'completed', 'failed'
                "downloaded_size": downloaded_size,
                "error": error,
                "timestamp": time.time()
            }

            # Add total size if available and calculate progress percentage
            if total_size is not None:
                status_obj["total_size"] = total_size
                # Calculate progress percentage from size information with exactly one decimal place
                calculated_progress = (downloaded_size / total_size) * 100
                # Truncate to one decimal place without rounding
                truncated_progress = int(calculated_progress * 10) / 10
                status_obj["progress"] = truncated_progress
            else:
                # If we don't have total size, use the provided progress
                status_obj["progress"] = progress
        else:
            # Fall back to progress percentage if no size information
            status_obj = {
                "status": status,  # 'downloading', 'completed', 'failed'
                "progress": progress,
                "error": error,
                "timestamp": time.time()
            }

        registry["downloads"][model_id] = status_obj

    # Log the status update
    if downloaded_size is not None:
        downloaded_mb = downloaded_size / (1024 * 1024)
        if total_size is not None:
            total_mb = total_size / (1024 * 1024)
            calculated_progress = (downloaded_size / total_size) * 100
            # Truncate to one decimal place without rounding
            truncated_progress = int(calculated_progress * 10) / 10
            logger.info(f"Updated download status for {model_id}: status={status}, size={downloaded_mb:.1f}MB/{total_mb:.1f}MB, progress={truncated_progress}%")
        else:
            logger.info(f"Updated download status for {model_id}: status={status}, size={downloaded_mb:.1f}MB, progress={progress:.1f}%")
    else:
        logger.info(f"Updated download status for {model_id}: status={status}, progress={progress:.1f}%")

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

def cancel_download(model_id):
    """
    Cancel an ongoing model download and delete the model folder from the Hugging Face cache.

    Args:
        model_id (str): ID of the model download to cancel

    Returns:
        bool: True if cancellation was successful, False otherwise
    """
    try:
        logger.info(f"Received request to cancel download for model {model_id}")

        # Check if the model is in the download_threads dictionary
        if model_id in download_threads:
            logger.info(f"Found active download thread for model {model_id}, setting cancel flag")

            # Set the cancellation flag to True - this will be checked during download
            download_threads[model_id]["cancel"] = True

            # Log the cancellation
            logger.info(f"Cancellation flag set for model {model_id}")

            # Remove from download status immediately
            remove_download_status(model_id)
            logger.info(f"Removed download status for model {model_id}")

            # Get the project's models directory
            try:
                project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                project_models_dir = os.path.join(project_dir, "models", "f5_tts")
                logger.info(f"Using project models directory: {project_models_dir}")

                # Check for model in the project's models directory
                model_dir = os.path.join(project_models_dir, model_id)
                if os.path.exists(model_dir):
                    logger.info(f"Deleting model directory: {model_dir}")
                    try:
                        shutil.rmtree(model_dir)
                        logger.info(f"Successfully deleted model directory: {model_dir}")
                    except Exception as e:
                        logger.error(f"Error deleting model directory: {e}")
                else:
                    logger.info(f"No model directory found at: {model_dir}")
            except Exception as e:
                logger.error(f"Error accessing project models directory: {e}")

            # For backward compatibility, also check the Hugging Face cache location
            try:
                # Try the newer API first
                try:
                    from huggingface_hub import get_cache_dir
                    hf_cache_dir = get_cache_dir()
                    logger.info(f"Using get_cache_dir(): {hf_cache_dir}")
                except (ImportError, AttributeError):
                    # Fall back to older approach
                    home_dir = os.path.expanduser("~")
                    hf_cache_dir = os.path.join(home_dir, ".cache", "huggingface")
                    logger.info(f"Using default cache path: {hf_cache_dir}")

                # If we found the cache directory, try to delete any partial downloads
                if hf_cache_dir:
                    # Check for model in the custom_models directory
                    custom_cache_dir = os.path.join(hf_cache_dir, "custom_models", model_id)
                    if os.path.exists(custom_cache_dir):
                        logger.info(f"Deleting custom model directory: {custom_cache_dir}")
                        try:
                            shutil.rmtree(custom_cache_dir)
                            logger.info(f"Successfully deleted custom model directory: {custom_cache_dir}")
                        except Exception as e:
                            logger.error(f"Error deleting custom model directory: {e}")
                    else:
                        logger.info(f"No custom model directory found at: {custom_cache_dir}")
            except Exception as e:
                logger.error(f"Error getting Hugging Face cache directory: {e}")
                hf_cache_dir = None

                # Also check for repository-based models
                registry = get_registry()
                download_info = registry.get("downloads", {}).get(model_id, {})
                repo_id = download_info.get("repo_id")
                if repo_id:
                    logger.info(f"Model {model_id} is from repository {repo_id}")
                    try:
                        # Import the function to delete from Hugging Face cache
                        from huggingFaceCache import delete_huggingface_cache_model
                        success, message = delete_huggingface_cache_model(repo_id)
                        if success:
                            logger.info(f"Successfully deleted model from Hugging Face cache: {repo_id}")
                        else:
                            logger.warning(f"Failed to delete model from Hugging Face cache: {message}")
                    except Exception as e:
                        logger.error(f"Error deleting model from Hugging Face cache: {e}")

            # Remove from download_threads after a short delay
            def cleanup_thread():
                time.sleep(2)
                if model_id in download_threads:
                    logger.info(f"Cleaning up download thread for model {model_id}")
                    del download_threads[model_id]

            cleanup = threading.Thread(target=cleanup_thread)
            cleanup.daemon = True
            cleanup.start()

            logger.info(f"Successfully cancelled download for model {model_id}")
            return True
        else:
            # Check if there's a download status for this model in the registry
            registry = get_registry()
            if model_id in registry.get("downloads", {}):
                logger.info(f"Found download status for model {model_id} in registry but no active thread")

                # Remove from download status immediately
                remove_download_status(model_id)
                logger.info(f"Removed download status for model {model_id}")

                # Try to delete any partial downloads
                try:
                    # Get the project's models directory
                    try:
                        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                        project_models_dir = os.path.join(project_dir, "models", "f5_tts")
                        logger.info(f"Using project models directory: {project_models_dir}")

                        # Check for model in the project's models directory
                        model_dir = os.path.join(project_models_dir, model_id)
                        if os.path.exists(model_dir):
                            logger.info(f"Deleting model directory: {model_dir}")
                            try:
                                shutil.rmtree(model_dir)
                                logger.info(f"Successfully deleted model directory: {model_dir}")
                            except Exception as e:
                                logger.error(f"Error deleting model directory: {e}")
                        else:
                            logger.info(f"No model directory found at: {model_dir}")
                    except Exception as e:
                        logger.error(f"Error accessing project models directory: {e}")

                    # For backward compatibility, also check the Hugging Face cache location
                    try:
                        # Try the newer API first
                        try:
                            from huggingface_hub import get_cache_dir
                            hf_cache_dir = get_cache_dir()
                        except (ImportError, AttributeError):
                            # Fall back to older approach
                            home_dir = os.path.expanduser("~")
                            hf_cache_dir = os.path.join(home_dir, ".cache", "huggingface")

                        if hf_cache_dir:
                            # Check for model in the custom_models directory
                            custom_cache_dir = os.path.join(hf_cache_dir, "custom_models", model_id)
                            if os.path.exists(custom_cache_dir):
                                logger.info(f"Deleting custom model directory: {custom_cache_dir}")
                                try:
                                    shutil.rmtree(custom_cache_dir)
                                    logger.info(f"Successfully deleted custom model directory: {custom_cache_dir}")
                                except Exception as e:
                                    logger.error(f"Error deleting custom model directory: {e}")
                            else:
                                logger.info(f"No custom model directory found at: {custom_cache_dir}")
                    except Exception as e:
                        logger.error(f"Error getting Hugging Face cache directory: {e}")
                        hf_cache_dir = None

                        # Also check for repository-based models
                        download_info = registry.get("downloads", {}).get(model_id, {})
                        repo_id = download_info.get("repo_id")
                        if repo_id:
                            logger.info(f"Model {model_id} is from repository {repo_id}")
                            try:
                                # Import the function to delete from Hugging Face cache
                                from huggingFaceCache import delete_huggingface_cache_model
                                success, message = delete_huggingface_cache_model(repo_id)
                                if success:
                                    logger.info(f"Successfully deleted model from Hugging Face cache: {repo_id}")
                                else:
                                    logger.warning(f"Failed to delete model from Hugging Face cache: {message}")
                            except Exception as e:
                                logger.error(f"Error deleting model from Hugging Face cache: {e}")

                except Exception as e:
                    logger.error(f"Error cleaning up model files: {e}")
                    # Continue with cancellation even if cleanup fails

                logger.info(f"Successfully cancelled download for model {model_id} from registry")
                return True
            else:
                logger.warning(f"No active download found for model {model_id}")
                return False
    except Exception as e:
        logger.error(f"Error cancelling download for model {model_id}: {e}")
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
    # Prevent deletion of the default F5-TTS v1 Base model
    if model_id == 'f5tts-v1-base':
        return False, "Cannot delete the default F5-TTS v1 Base model as it is required by the system"

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

    # Get the project's models directory
    project_models_dir = None
    try:
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        project_models_dir = os.path.join(project_dir, "models", "f5_tts")
        logger.info(f"Using project models directory: {project_models_dir}")
    except Exception as e:
        logger.error(f"Error getting project models directory: {e}")
        project_models_dir = None

    # Always check and delete from project's models directory regardless of delete_cache flag
    custom_models_deleted = False
    if project_models_dir:
        model_dir = os.path.join(project_models_dir, model_id)
        logger.info(f"Checking for model directory at: {model_dir}")

        if os.path.exists(model_dir):
            try:
                shutil.rmtree(model_dir)
                logger.info(f"Deleted model from project models directory: {model_dir}")
                custom_models_deleted = True
            except Exception as e:
                logger.error(f"Error deleting model directory: {e}")
        else:
            logger.info(f"No model directory found at: {model_dir}")

    # For backward compatibility, also check the Hugging Face cache location
    hf_cache_dir = None
    try:
        # Try the newer API first
        try:
            from huggingface_hub import get_cache_dir
            hf_cache_dir = get_cache_dir()
            logger.info(f"Using get_cache_dir(): {hf_cache_dir}")
        except (ImportError, AttributeError):
            # Fall back to older approach
            home_dir = os.path.expanduser("~")
            hf_cache_dir = os.path.join(home_dir, ".cache", "huggingface")
            logger.info(f"Using default cache path: {hf_cache_dir}")
    except Exception as e:
        logger.error(f"Error getting Hugging Face cache directory: {e}")
        hf_cache_dir = None

    # Also check and delete from custom_models directory in Hugging Face cache for backward compatibility
    if hf_cache_dir:
        custom_cache_dir = os.path.join(hf_cache_dir, "custom_models", model_id)
        logger.info(f"Checking for custom model directory at: {custom_cache_dir}")

        if os.path.exists(custom_cache_dir):
            try:
                shutil.rmtree(custom_cache_dir)
                logger.info(f"Deleted custom model from Hugging Face cache: {custom_cache_dir}")
                custom_models_deleted = True
            except Exception as e:
                logger.error(f"Error deleting custom model directory: {e}")
        else:
            logger.info(f"No custom model directory found at: {custom_cache_dir}")

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
        elif model_to_delete.get("source") == "url" and not custom_models_deleted:
            # For URL-based models, try to delete the custom model directory in the cache
            # (only if we haven't already deleted it above)
            try:
                if hf_cache_dir:
                    custom_cache_dir = os.path.join(hf_cache_dir, "custom_models", model_id)
                    logger.info(f"Checking for custom model directory at: {custom_cache_dir}")

                    if os.path.exists(custom_cache_dir):
                        shutil.rmtree(custom_cache_dir)
                        logger.info(f"Deleted custom model from Hugging Face cache: {custom_cache_dir}")
                        cache_deletion_result = f"Deleted custom model from Hugging Face cache"
                    else:
                        logger.info(f"Custom model directory not found at: {custom_cache_dir}")
            except Exception as e:
                logger.error(f"Error deleting custom model from Hugging Face cache: {e}")
                cache_deletion_result = f"Note: Error deleting custom model from Hugging Face cache: {str(e)}"

    # Also check for model files in the model paths
    if model_to_delete.get("model_path") and os.path.exists(model_to_delete["model_path"]):
        try:
            logger.info(f"Deleting model file: {model_to_delete['model_path']}")
            os.remove(model_to_delete["model_path"])
            logger.info(f"Successfully deleted model file")
        except Exception as e:
            logger.error(f"Error deleting model file: {e}")

    if model_to_delete.get("vocab_path") and os.path.exists(model_to_delete["vocab_path"]):
        try:
            logger.info(f"Deleting vocab file: {model_to_delete['vocab_path']}")
            os.remove(model_to_delete["vocab_path"])
            logger.info(f"Successfully deleted vocab file")
        except Exception as e:
            logger.error(f"Error deleting vocab file: {e}")

    if save_registry(registry):
        success_message = f"Model {model_id} deleted successfully"
        if custom_models_deleted:
            success_message += f". Deleted model files from project directory"
        if cache_deletion_result:
            success_message += f". {cache_deletion_result}"
        return True, success_message
    else:
        return False, "Failed to save registry"

# Function removed since we're only using public repositories

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
    # Log the huggingface_hub version and available functions for debugging
    try:
        import huggingface_hub
        import inspect

        # Log version
        try:
            logger.info(f"Using huggingface_hub version: {huggingface_hub.__version__}")
        except AttributeError:
            logger.warning("Could not determine huggingface_hub version")

        # Log available functions to help with debugging
        try:
            functions = [name for name, obj in inspect.getmembers(huggingface_hub)
                        if inspect.isfunction(obj)]
            logger.info(f"Available huggingface_hub functions: {', '.join(functions[:10])}...")

            # Check if specific functions exist
            has_get_cache_dir = hasattr(huggingface_hub, 'get_cache_dir')
            has_hf_hub_download = hasattr(huggingface_hub, 'hf_hub_download')
            logger.info(f"Has get_cache_dir: {has_get_cache_dir}, Has hf_hub_download: {has_hf_hub_download}")
        except Exception as e:
            logger.warning(f"Error inspecting huggingface_hub: {e}")
    except ImportError:
        logger.warning("huggingface_hub module not found")

    # Log that we're proceeding with the download
    logger.info(f"Proceeding with download from repository: {repo_id}")

    # Log the input parameters
    logger.info(f"Download request: repo_id={repo_id}, model_path={model_path}, vocab_path={vocab_path}, model_id={model_id}")
    # Generate model ID if not provided
    if model_id is None:
        model_id = repo_id.split('/')[-1]
        if '/' in model_path:
            model_id += '_' + model_path.split('/')[0]

    # Update download status to 'downloading'
    update_download_status(model_id, 'downloading')

    # Create a cancellation flag
    download_threads[model_id] = {"cancel": False, "thread": None}

    # Start download in a separate thread
    thread = threading.Thread(
        target=_download_model_from_hf_thread,
        args=(repo_id, model_path, vocab_path, config, model_id, language_codes)
    )
    thread.daemon = True

    # Store the thread in the dictionary
    download_threads[model_id]["thread"] = thread

    # Start the thread
    thread.start()

    return True, f"Model download started for {model_id}", model_id

def _custom_download_file(url, output_path, model_id, progress_start=0, progress_end=90):
    """
    Custom download function with progress tracking and cancellation support.

    Args:
        url (str): URL to download from
        output_path (str): Path to save the downloaded file
        model_id (str): Model ID for tracking cancellation
        progress_start (int): Starting progress percentage
        progress_end (int): Ending progress percentage

    Returns:
        bool: True if download was successful, False if cancelled
    """
    import requests
    import os

    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Try to get content length for progress tracking
        response_head = requests.head(url, allow_redirects=True)
        total_size = int(response_head.headers.get('Content-Length', 0))
        logger.info(f"File size: {total_size / (1024 * 1024):.2f} MB")
        has_size = total_size > 0
    except Exception as e:
        logger.warning(f"Could not determine file size: {e}")
        has_size = False
        total_size = 0

    # Download the file
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Error starting download: {e}")
        raise

    # Set up progress tracking
    downloaded_size = 0
    chunk_size = 8192
    progress_step = 2  # Update progress every 2%
    last_progress = progress_start
    progress_range = progress_end - progress_start

    # Download with progress tracking
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=chunk_size):
            # Check if download has been cancelled
            if model_id in download_threads and download_threads[model_id]["cancel"]:
                logger.info(f"Download cancelled for model {model_id} during file download")
                f.close()

                # Delete the partially downloaded file
                try:
                    if os.path.exists(output_path):
                        logger.info(f"Deleting partially downloaded file: {output_path}")
                        os.remove(output_path)
                        logger.info(f"Successfully deleted file: {output_path}")
                except Exception as e:
                    logger.error(f"Error deleting file: {e}")

                return False  # Indicate cancellation

            f.write(chunk)
            downloaded_size += len(chunk)

            # Update progress
            if has_size:
                # Calculate real progress if we know the size
                progress = progress_start + min(progress_range, (downloaded_size / total_size) * progress_range)
            else:
                # Otherwise increment by small amounts
                progress = min(progress_end, last_progress + 0.5)

            # Only update status when progress changes significantly
            if progress >= last_progress + progress_step or progress >= progress_end:
                update_download_status(
                    model_id=model_id,
                    status='downloading',
                    progress=progress,
                    downloaded_size=downloaded_size,
                    total_size=total_size if has_size else None
                )
                last_progress = progress
                if has_size:
                    progress_percent = (downloaded_size / total_size) * 100
                    # Truncate to one decimal place without rounding
                    truncated_progress = int(progress_percent * 10) / 10
                    logger.info(f"Download progress: {downloaded_size / (1024 * 1024):.1f}MB/{total_size / (1024 * 1024):.1f}MB ({truncated_progress}%)")
                else:
                    logger.info(f"Download progress: {downloaded_size / (1024 * 1024):.1f}MB")

    logger.info(f"File downloaded successfully to: {output_path}")
    update_download_status(
        model_id=model_id,
        status='downloading',
        progress=progress_end,
        downloaded_size=downloaded_size,
        total_size=total_size if has_size else None
    )
    return True  # Indicate successful download

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
    import time

    try:
        # Download model file with progress tracking
        logger.info(f"Downloading model from {repo_id}/{model_path}")
        update_download_status(model_id, 'downloading', 0)

        # Log that we're starting the actual download
        logger.info("Starting actual download from Hugging Face Hub")

        # Use the project's models/f5_tts directory instead of Hugging Face cache
        try:
            # Get the project's models directory
            import os
            project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            models_dir = os.path.join(project_dir, "models", "f5_tts")
            logger.info(f"Using project models directory: {models_dir}")

            # Make sure the directory exists
            os.makedirs(models_dir, exist_ok=True)
        except Exception as e:
            logger.error(f"Error getting project models directory: {e}")
            raise

        # Create a directory in the project's models/f5_tts directory for this model
        cache_dir = os.path.join(models_dir, model_id)
        logger.info(f"Creating model directory at: {cache_dir}")
        os.makedirs(cache_dir, exist_ok=True)

        # Set initial progress
        update_download_status(model_id, 'downloading', 5)

        # Check if download has been cancelled before starting actual download
        if model_id in download_threads and download_threads[model_id]["cancel"]:
            logger.info(f"Download cancelled for model {model_id} before starting actual download")
            # Don't add to registry at all for cancelled downloads
            remove_download_status(model_id)

            # Delete the model directory
            try:
                if os.path.exists(cache_dir):
                    logger.info(f"Deleting model directory: {cache_dir}")
                    shutil.rmtree(cache_dir)
                    logger.info(f"Successfully deleted model directory: {cache_dir}")
            except Exception as e:
                logger.error(f"Error deleting model directory: {e}")

            return  # Exit the thread

        # Construct URLs for the model and vocab files
        model_url = f"https://huggingface.co/{repo_id}/resolve/main/{model_path}"
        vocab_url = f"https://huggingface.co/{repo_id}/resolve/main/{vocab_path}"

        logger.info(f"Model URL: {model_url}")
        logger.info(f"Vocab URL: {vocab_url}")

        # Prepare file paths
        model_filename = os.path.basename(model_path)
        vocab_filename = os.path.basename(vocab_path)
        model_file = os.path.join(cache_dir, model_filename)
        vocab_file = os.path.join(cache_dir, vocab_filename)

        # Download model file with progress tracking
        logger.info(f"Starting download of model file from {model_url}")
        update_download_status(model_id, 'downloading', 10)

        # Download model file
        model_success = _custom_download_file(
            url=model_url,
            output_path=model_file,
            model_id=model_id,
            progress_start=10,
            progress_end=60
        )

        # If model download was cancelled, exit
        if not model_success:
            # Delete the model directory
            try:
                if os.path.exists(cache_dir):
                    logger.info(f"Deleting model directory: {cache_dir}")
                    shutil.rmtree(cache_dir)
                    logger.info(f"Successfully deleted model directory: {cache_dir}")
            except Exception as e:
                logger.error(f"Error deleting model directory: {e}")

            # Don't add to registry at all for cancelled downloads
            remove_download_status(model_id)
            return  # Exit the thread

        # Download vocab file
        logger.info(f"Starting download of vocab file from {vocab_url}")
        update_download_status(model_id, 'downloading', 60)

        # Download vocab file
        vocab_success = _custom_download_file(
            url=vocab_url,
            output_path=vocab_file,
            model_id=model_id,
            progress_start=60,
            progress_end=90
        )

        # If vocab download was cancelled, exit
        if not vocab_success:
            # Delete the model directory
            try:
                if os.path.exists(cache_dir):
                    logger.info(f"Deleting model directory: {cache_dir}")
                    shutil.rmtree(cache_dir)
                    logger.info(f"Successfully deleted model directory: {cache_dir}")
            except Exception as e:
                logger.error(f"Error deleting model directory: {e}")

            # Don't add to registry at all for cancelled downloads
            remove_download_status(model_id)
            return  # Exit the thread

        # Check if download has been cancelled after all files are downloaded
        if model_id in download_threads and download_threads[model_id]["cancel"]:
            logger.info(f"Download cancelled for model {model_id} after all files downloaded")

            # Delete the model directory
            try:
                if os.path.exists(cache_dir):
                    logger.info(f"Deleting model directory: {cache_dir}")
                    shutil.rmtree(cache_dir)
                    logger.info(f"Successfully deleted model directory: {cache_dir}")
            except Exception as e:
                logger.error(f"Error deleting model directory: {e}")

            # Don't add to registry at all for cancelled downloads
            remove_download_status(model_id)
            return  # Exit the thread

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
            # Use a more flexible approach to detect language codes
            model_id_lower = model_id.lower()
            repo_id_lower = repo_id.lower()

            # Common language codes that might be found in model IDs or repo IDs
            # This is just a fallback - the preferred method is to provide language codes explicitly
            # We don't limit to a fixed list, but we'll check for common patterns

            # Check for language codes in model ID using common patterns
            # Look for patterns like "model-en", "model_en", "model-en-us", etc.
            import re

            # Pattern to match language codes in model ID
            # This looks for 2-letter codes that are either:
            # 1. At the end of the string
            # 2. Followed by a hyphen and more text (like en-us)
            # 3. Preceded by a hyphen or underscore
            lang_pattern = r'(?:^|[-_])([a-z]{2})(?:$|[-_])'

            # Find all matches in model ID
            matches = re.findall(lang_pattern, model_id_lower)
            if matches:
                # Use the first match as primary language
                primary_language = matches[0]
                supported_languages = list(set(matches))  # Remove duplicates
                logger.info(f"Detected languages from model ID: {supported_languages}")

            # If not found in model ID, check repo ID
            if not supported_languages:
                matches = re.findall(lang_pattern, repo_id_lower)
                if matches:
                    primary_language = matches[0]
                    supported_languages = list(set(matches))  # Remove duplicates
                    logger.info(f"Detected languages from repo ID: {supported_languages}")

            # If still no languages detected, default to "en" as a fallback
            if not supported_languages:
                logger.info("No language detected, defaulting to 'en'")
                primary_language = "en"
                supported_languages = ["en"]

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

        # Log the model info for debugging
        logger.info(f"Model info prepared: id={model_id}, model_path={model_file}, vocab_path={vocab_file}")

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
    - hf://erax-ai/EraX-Smile-UnixSex-F5/models/model_42000.safetensors
    - https://huggingface.co/SWivid/F5-TTS/blob/main/F5TTS_v1_Base/model_1250000.safetensors

    Returns:
        tuple: (repo_id, file_path)
    """
    logger.info(f"Parsing Hugging Face URL: {url}")

    if not url:
        logger.error("Empty URL provided to parse_hf_url")
        return None, None

    if url.startswith('hf://'):
        # Format: hf://repo_id/file_path
        parts = url[5:].split('/', 1)
        if len(parts) == 2:
            repo_id, file_path = parts
            logger.info(f"Parsed hf:// URL - repo_id: {repo_id}, file_path: {file_path}")
            return repo_id, file_path

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
                    # Split by first slash to remove branch name
                    _, file_path = file_path.split('/', 1)
                    logger.info(f"Parsed huggingface.co URL - repo_id: {repo_id}, file_path: {file_path}")
                    return repo_id, file_path

            # Handle direct resolve URLs (no blob)
            # Format: https://huggingface.co/repo_id/resolve/main/file_path
            elif '/resolve/' in path:
                repo_id, file_path = path.split('/resolve/', 1)
                # Remove branch name
                if '/' in file_path:
                    # Split by first slash to remove branch name
                    _, file_path = file_path.split('/', 1)
                    logger.info(f"Parsed huggingface.co resolve URL - repo_id: {repo_id}, file_path: {file_path}")
                    return repo_id, file_path

    # If we get here, the URL format wasn't recognized
    logger.error(f"Failed to parse Hugging Face URL: {url}")
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

    # Create a cancellation flag
    download_threads[model_id] = {"cancel": False, "thread": None}

    # Start download in a separate thread
    thread = threading.Thread(
        target=_download_model_from_url_thread,
        args=(model_url, vocab_url, config, model_id, language_codes)
    )
    thread.daemon = True

    # Store the thread in the dictionary
    download_threads[model_id]["thread"] = thread

    # Start the thread
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
    import re

    try:
        # Use the project's models/f5_tts directory instead of Hugging Face cache
        try:
            # Get the project's models directory
            import os
            project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            models_dir = os.path.join(project_dir, "models", "f5_tts")
            logger.info(f"Using project models directory: {models_dir}")

            # Make sure the directory exists
            os.makedirs(models_dir, exist_ok=True)
        except Exception as e:
            logger.error(f"Error getting project models directory: {e}")
            raise

        # Create a directory in the project's models/f5_tts directory for this model
        cache_dir = os.path.join(models_dir, model_id)
        logger.info(f"Creating model directory at: {cache_dir}")
        os.makedirs(cache_dir, exist_ok=True)

        # Verify the directory was created
        if not os.path.exists(cache_dir):
            raise IOError(f"Failed to create cache directory at {cache_dir}")
        else:
            logger.info(f"Cache directory created/exists: {cache_dir}")

        # Download model file directly to the Hugging Face cache
        logger.info(f"Downloading model from {model_url}")
        model_filename = os.path.basename(model_url)
        cache_model_path = os.path.join(cache_dir, model_filename)
        logger.info(f"Model will be saved to: {cache_model_path}")

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
                # Check if download has been cancelled
                if model_id in download_threads and download_threads[model_id]["cancel"]:
                    logger.info(f"Download cancelled for model {model_id} during model file download")
                    f.close()

                    # Delete the partially downloaded file
                    try:
                        if os.path.exists(cache_model_path):
                            logger.info(f"Deleting partially downloaded model file: {cache_model_path}")
                            os.remove(cache_model_path)
                            logger.info(f"Successfully deleted model file: {cache_model_path}")
                    except Exception as e:
                        logger.error(f"Error deleting model file: {e}")

                    # Delete the model directory
                    try:
                        if os.path.exists(cache_dir):
                            logger.info(f"Deleting model directory: {cache_dir}")
                            shutil.rmtree(cache_dir)
                            logger.info(f"Successfully deleted model directory: {cache_dir}")
                    except Exception as e:
                        logger.error(f"Error deleting model directory: {e}")

                    # Don't add to registry at all for cancelled downloads
                    remove_download_status(model_id)
                    return  # Exit the thread

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

        # Check if download has been cancelled after model file download
        if model_id in download_threads and download_threads[model_id]["cancel"]:
            logger.info(f"Download cancelled for model {model_id} after model file download")

            # Delete the downloaded file
            try:
                if os.path.exists(cache_model_path):
                    logger.info(f"Deleting downloaded model file: {cache_model_path}")
                    os.remove(cache_model_path)
                    logger.info(f"Successfully deleted model file: {cache_model_path}")
            except Exception as e:
                logger.error(f"Error deleting model file: {e}")

            # Delete the model directory
            try:
                if os.path.exists(cache_dir):
                    logger.info(f"Deleting model directory: {cache_dir}")
                    shutil.rmtree(cache_dir)
                    logger.info(f"Successfully deleted model directory: {cache_dir}")
            except Exception as e:
                logger.error(f"Error deleting model directory: {e}")

            # Don't add to registry at all for cancelled downloads
            remove_download_status(model_id)
            return  # Exit the thread

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
            # Use a more flexible approach to detect language codes
            model_id_lower = model_id.lower()
            model_url_lower = model_url.lower()

            # Common language codes that might be found in model IDs or URLs
            # This is just a fallback - the preferred method is to provide language codes explicitly
            # We don't limit to a fixed list, but we'll check for common patterns

            # Check for language codes in model ID using common patterns
            # Look for patterns like "model-en", "model_en", "model-en-us", etc.
            import re

            # Pattern to match language codes in model ID
            # This looks for 2-letter codes that are either:
            # 1. At the end of the string
            # 2. Followed by a hyphen and more text (like en-us)
            # 3. Preceded by a hyphen or underscore
            lang_pattern = r'(?:^|[-_])([a-z]{2})(?:$|[-_])'

            # Find all matches in model ID
            matches = re.findall(lang_pattern, model_id_lower)
            if matches:
                # Use the first match as primary language
                primary_language = matches[0]
                supported_languages = list(set(matches))  # Remove duplicates
                logger.info(f"Detected languages from model ID: {supported_languages}")

            # If not found in model ID, check URL
            if not supported_languages:
                matches = re.findall(lang_pattern, model_url_lower)
                if matches:
                    primary_language = matches[0]
                    supported_languages = list(set(matches))  # Remove duplicates
                    logger.info(f"Detected languages from URL: {supported_languages}")

            # If still no languages detected, default to "en" as a fallback
            if not supported_languages:
                logger.info("No language detected, defaulting to 'en'")
                primary_language = "en"
                supported_languages = ["en"]

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

        # Log the model info for debugging
        logger.info(f"Model info prepared: id={model_id}, model_path={cache_model_path}, vocab_path={cache_vocab_path}")

        # Verify the model file exists
        if not os.path.exists(cache_model_path):
            logger.error(f"Model file not found at {cache_model_path}")
            raise FileNotFoundError(f"Model file not found at {cache_model_path}")

        # Verify the vocab file exists if provided
        if cache_vocab_path and not os.path.exists(cache_vocab_path):
            logger.error(f"Vocab file not found at {cache_vocab_path}")
            raise FileNotFoundError(f"Vocab file not found at {cache_vocab_path}")

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
