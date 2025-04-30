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
# Assuming huggingFaceCache.py exists in the same directory or is accessible
try:
    from huggingFaceCache import list_huggingface_cache_models, delete_huggingface_cache_model
except ImportError:
    # Provide dummy functions if the import fails, to avoid crashing
    logging.warning("huggingFaceCache module not found. Cache operations might be limited.")
    def list_huggingface_cache_models(): return []
    def delete_huggingface_cache_model(repo_id): return (False, "huggingFaceCache module not found")


# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
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

# --- Registry Initialization and Management (largely unchanged) ---

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
            logger.warning("Registry missing 'active_model' or 'models' field. Resetting.")
            raise ValueError("Invalid registry format")

        # Add downloads field if it doesn't exist
        if "downloads" not in registry:
            registry["downloads"] = {}
            with open(MODELS_REGISTRY_FILE, 'w') as f:
                json.dump(registry, f, indent=2)
            logger.info("Added 'downloads' field to registry.")

        # Check if F5-TTS v1 Base model is in the registry
        f5tts_base_exists = False
        for model in registry.get("models", []): # Use .get for safety
            if model.get("id") == "f5tts-v1-base":
                f5tts_base_exists = True
                # Ensure default model has correct structure (add missing fields if needed)
                if "languages" not in model: model["languages"] = ["en", "zh"]
                if "language" not in model: model["language"] = "en"
                if "is_symlink" not in model: model["is_symlink"] = False
                if "original_model_file" not in model: model["original_model_file"] = None
                if "original_vocab_file" not in model: model["original_vocab_file"] = None
                if "source" not in model: model["source"] = "default"
                break

        # Add F5-TTS v1 Base model if it's not in the registry
        if not f5tts_base_exists:
            logger.info("F5-TTS v1 Base model not found in registry. Adding it.")
            registry.setdefault("models", []).append({ # Use setdefault for safety
                "id": "f5tts-v1-base",
                "name": "F5-TTS v1 Base",
                "repo_id": "SWivid/F5-TTS",
                "model_path": "default",
                "vocab_path": "default",
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
            if registry.get("active_model") is None: # Use .get for safety
                registry["active_model"] = "f5tts-v1-base"

            # Save the updated registry
            with open(MODELS_REGISTRY_FILE, 'w') as f:
                json.dump(registry, f, indent=2)
            logger.info("Added F5-TTS v1 Base model to registry as the default model")

    except (json.JSONDecodeError, ValueError, TypeError, KeyError) as e:
        logger.error(f"Error reading or validating registry: {e}. Resetting registry.")
        # Reset registry if invalid
        with open(MODELS_REGISTRY_FILE, 'w') as f:
            json.dump({
                "active_model": None,
                "models": [],
                "downloads": {}
            }, f, indent=2)
        logger.info(f"Reset models registry due to error")
        # Re-run initialization after reset
        initialize_registry()


def get_registry():
    """Get the current models registry."""
    initialize_registry() # Ensure it's initialized and valid before reading
    try:
        with open(MODELS_REGISTRY_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        logger.error(f"Error reading registry file: {e}. Returning default empty registry.")
        # Return a default structure in case of error
        return {"active_model": None, "models": [], "downloads": {}}
    except Exception as e:
        logger.error(f"Unexpected error reading registry: {e}")
        return {"active_model": None, "models": [], "downloads": {}}


def save_registry(registry):
    """Save the models registry."""
    try:
        # Create a temporary file path
        temp_file_path = MODELS_REGISTRY_FILE + ".tmp"

        # Write to the temporary file
        with open(temp_file_path, 'w') as f:
            json.dump(registry, f, indent=2)

        # Atomically replace the original file with the temporary file
        # On Windows, os.replace might fail if the target exists, so remove first.
        if os.path.exists(MODELS_REGISTRY_FILE):
            os.remove(MODELS_REGISTRY_FILE)
        os.replace(temp_file_path, MODELS_REGISTRY_FILE) # Atomic on POSIX, near-atomic on Windows

        logger.debug(f"Registry saved successfully to {MODELS_REGISTRY_FILE}")
        return True
    except Exception as e:
        logger.error(f"Error saving registry: {e}")
        # Clean up temp file if it exists
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError as rm_err:
                logger.error(f"Error removing temporary registry file {temp_file_path}: {rm_err}")
        return False


def get_models(include_cache=False):
    """Get list of available models."""
    registry = get_registry()
    # Ensure downloads is present
    if "downloads" not in registry:
        registry["downloads"] = {}

    result = {
        "active_model": registry.get("active_model"), # Use .get for safety
        "models": registry.get("models", []),       # Use .get for safety
        "downloads": registry.get("downloads", {})   # Use .get for safety
    }

    if include_cache:
        result["cache_models"] = list_huggingface_cache_models()

    return result

# --- is_model_using_symlinks (kept for compatibility, always returns False) ---
def is_model_using_symlinks(model_id):
    """Check if a model is using symbolic links (always returns False)."""
    return False, None, None

# --- update_model_info (unchanged) ---
def update_model_info(model_id, model_info):
    """Update model information in the registry."""
    registry = get_registry()
    model_index = -1
    for i, model in enumerate(registry.get("models", [])):
        if model.get("id") == model_id:
            model_index = i
            break

    if model_index == -1:
        return False, f"Model {model_id} not found"

    # Update allowed fields
    allowed_fields = ["name", "language", "languages", "config"]
    updated = False
    for field in allowed_fields:
        if field in model_info:
            if registry["models"][model_index].get(field) != model_info[field]:
                registry["models"][model_index][field] = model_info[field]
                updated = True

    # If language is updated but languages is not, update languages array too
    if "language" in model_info and "languages" not in model_info:
        # Only update if the single language isn't already the only one in languages
        current_languages = registry["models"][model_index].get("languages", [])
        new_language = model_info["language"]
        if not (len(current_languages) == 1 and current_languages[0] == new_language):
            registry["models"][model_index]["languages"] = [new_language]
            updated = True

    if updated:
        if save_registry(registry):
            return True, f"Model {model_id} updated successfully"
        else:
            return False, "Failed to save registry"
    else:
        return True, f"No changes detected for model {model_id}"

# --- Download Status Management (MODIFIED) ---

def get_download_status(model_id):
    """Get the download status of a model."""
    registry = get_registry()
    return registry.get("downloads", {}).get(model_id, None)

def update_download_status(model_id, status, progress=None, error=None, downloaded_size=None, total_size=None):
    """
    Update the download status of a model with precise, truncated progress.

    Args:
        model_id (str): ID of the model.
        status (str): 'downloading', 'completed', 'failed'.
        progress (float, optional): Fallback progress percentage (0-100) if size info is unavailable.
                                    Not used if downloaded_size and total_size are provided.
        error (str, optional): Error message if status is 'failed'.
        downloaded_size (int, optional): Bytes downloaded so far.
        total_size (int, optional): Total bytes of the download.
    """
    # Get the registry first to avoid race conditions
    registry = get_registry()
    # Ensure downloads key exists
    if "downloads" not in registry:
        registry["downloads"] = {}

    # If status is 'completed', remove immediately and log 100%
    if status == 'completed':
        logger.info(f"Download completed for {model_id}: 100.0%")
        # Remove the download status from the current registry object
        if model_id in registry["downloads"]:
            del registry["downloads"][model_id]
            # Attempt to save the registry immediately
            if not save_registry(registry):
                logger.error(f"Failed to save registry after removing completed download status for {model_id}")
        else:
            logger.warning(f"Attempted to remove completed download status for {model_id}, but it was not found.")
        return True # Indicate success even if save fails, as the state is 'completed'

    # --- Status Object Construction ---
    status_obj = {
        "status": status,
        "error": error,
        "timestamp": time.time()
    }

    calculated_progress = None
    # **Prioritize size information for precise progress**
    if downloaded_size is not None and total_size is not None and total_size > 0:
        status_obj["downloaded_size"] = downloaded_size
        status_obj["total_size"] = total_size
        # Calculate precise progress percentage
        raw_progress = (downloaded_size / total_size) * 100
        # **Truncate to one decimal place**
        calculated_progress = int(raw_progress * 10) / 10
        # Ensure progress doesn't exceed 100.0 (e.g., due to slight header inaccuracies)
        calculated_progress = min(calculated_progress, 100.0)
        status_obj["progress"] = calculated_progress
        # logger.debug(f"Calculated progress for {model_id}: {calculated_progress:.1f}% ({downloaded_size}/{total_size})")
    elif downloaded_size is not None:
        # We have downloaded size but not total size
        status_obj["downloaded_size"] = downloaded_size
        # Cannot calculate percentage, so don't include 'progress' or 'total_size'
        # logger.debug(f"Progress for {model_id}: {downloaded_size} bytes (total size unknown)")
    elif progress is not None:
        # Fallback to provided progress percentage if size info is incomplete/missing
        # Truncate the fallback progress as well
        fallback_progress = int(progress * 10) / 10
        fallback_progress = min(max(fallback_progress, 0.0), 100.0) # Clamp between 0 and 100
        status_obj["progress"] = fallback_progress
        # logger.debug(f"Using fallback progress for {model_id}: {fallback_progress:.1f}%")
    else:
        # No progress information available (should ideally not happen during 'downloading')
        # logger.debug(f"No progress information available for {model_id}")
        pass # status_obj only contains status, error, timestamp

    # Update the registry dictionary
    registry["downloads"][model_id] = status_obj

    # --- Logging ---
    log_message = f"Updating download status for {model_id}: status={status}"
    if "progress" in status_obj:
        log_message += f", progress={status_obj['progress']:.1f}%"
    if "downloaded_size" in status_obj:
        downloaded_mb = status_obj['downloaded_size'] / (1024 * 1024)
        if "total_size" in status_obj:
            total_mb = status_obj['total_size'] / (1024 * 1024)
            log_message += f" ({downloaded_mb:.2f}/{total_mb:.2f} MB)"
        else:
            log_message += f" ({downloaded_mb:.2f} MB / unknown total)"
    if error:
        log_message += f", error='{error}'"

    # Only log if the status has changed meaningfully (to reduce noise)
    # This basic check prevents logging identical consecutive updates,
    # but a more robust check might compare the whole status_obj.
    # For now, let's log every update during download for debugging.
    # if status != 'downloading' or model_id not in previous_statuses or previous_statuses[model_id] != status_obj:
    logger.info(log_message)
    # previous_statuses[model_id] = status_obj # Requires defining previous_statuses globally or passing it

    # --- Save Registry ---
    # Make sure to save the updated registry dictionary
    if not save_registry(registry):
        logger.error(f"Failed to save registry after updating download status for {model_id}")
        return False

    # Note: No delayed removal for 'completed' anymore, it's handled at the start.
    # If status is 'failed', it remains in the registry until acted upon (e.g., retry or delete).

    return True

def remove_download_status(model_id):
    """Remove the download status of a model."""
    try:
        registry = get_registry()
        if "downloads" not in registry:
            logger.info(f"No 'downloads' section found in registry. Cannot remove status for {model_id}.")
            return True # Nothing to remove

        if model_id in registry["downloads"]:
            logger.info(f"Removing download status for model {model_id}")
            del registry["downloads"][model_id]
            if not save_registry(registry):
                logger.error(f"Failed to save registry after removing download status for {model_id}")
                return False
            logger.info(f"Successfully removed download status for model {model_id}")
            return True
        else:
            logger.info(f"No download status found for model {model_id} to remove.")
            return True # Nothing to remove
    except Exception as e:
        logger.error(f"Error removing download status for model {model_id}: {e}")
        return False


# --- cancel_download (mostly unchanged, but logs more clearly) ---
def cancel_download(model_id):
    """Cancel an ongoing download and attempt cleanup."""
    logger.info(f"Initiating cancel request for model download: {model_id}")
    cancelled = False
    thread_found = False

    # 1. Signal the download thread to stop
    if model_id in download_threads:
        thread_info = download_threads[model_id]
        if not thread_info.get("cancel", False): # Check if not already cancelled
            logger.info(f"Setting cancellation flag for active download thread: {model_id}")
            thread_info["cancel"] = True
            cancelled = True
        else:
            logger.info(f"Cancellation flag already set for download thread: {model_id}")
        thread_found = True
    else:
        logger.info(f"No active download thread found in tracking for {model_id}. Will attempt cleanup based on registry status.")

    # 2. Update registry status immediately to 'failed' or remove entry
    registry = get_registry()
    download_entry = registry.get("downloads", {}).get(model_id)

    if download_entry:
        if download_entry.get("status") == 'downloading':
            logger.info(f"Updating download status to 'failed' due to cancellation for {model_id}")
            update_download_status(model_id, 'failed', error="Download cancelled by user.")
            # Keep the failed status for a bit so UI can see it was cancelled
        else:
             # If it wasn't downloading (e.g., already failed/completed), just remove it
             logger.info(f"Removing non-downloading status entry for cancelled model {model_id}")
             remove_download_status(model_id)
    else:
        logger.info(f"No download status found in registry for {model_id} during cancellation.")

    # 3. Attempt to clean up files (project dir and cache)
    cleanup_paths = []
    try:
        # Project's models directory
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        project_model_dir = os.path.join(project_dir, "models", "f5_tts", model_id)
        if os.path.exists(project_model_dir):
            cleanup_paths.append(project_model_dir)

        # Hugging Face cache (check for custom dir, less likely now but for safety)
        try:
            from huggingface_hub import get_cache_dir
            hf_cache_dir = get_cache_dir()
            custom_cache_dir = os.path.join(hf_cache_dir, "custom_models", model_id)
            if os.path.exists(custom_cache_dir):
                 cleanup_paths.append(custom_cache_dir)
        except Exception as e:
            logger.warning(f"Could not check standard Hugging Face cache dir: {e}")
            # Fallback check (less reliable)
            home_dir = os.path.expanduser("~")
            fallback_cache_dir = os.path.join(home_dir, ".cache", "huggingface", "hub", f"models--{model_id.replace('_', '--')}") # Example format
            # This fallback is highly speculative, better rely on project dir cleanup

    except Exception as e:
        logger.error(f"Error determining cleanup paths for {model_id}: {e}")

    # Perform deletion
    for path_to_delete in cleanup_paths:
        logger.info(f"Attempting to delete directory during cancellation: {path_to_delete}")
        try:
            if os.path.isdir(path_to_delete):
                 shutil.rmtree(path_to_delete)
                 logger.info(f"Successfully deleted directory: {path_to_delete}")
            elif os.path.exists(path_to_delete): # Might be a file if download failed early
                 os.remove(path_to_delete)
                 logger.info(f"Successfully deleted file: {path_to_delete}")
        except Exception as e:
            logger.error(f"Error deleting path {path_to_delete} during cancellation: {e}")

    # Also attempt cache deletion if it was a repo-based download
    model_info_from_registry = next((m for m in registry.get("models", []) if m.get("id") == model_id), None)
    repo_id_to_delete = None
    if download_entry and download_entry.get("repo_id"): # Check download entry first
         repo_id_to_delete = download_entry["repo_id"]
    elif model_info_from_registry and model_info_from_registry.get("repo_id"): # Check model registry
         repo_id_to_delete = model_info_from_registry["repo_id"]

    if repo_id_to_delete:
         logger.info(f"Attempting Hugging Face cache deletion for repo {repo_id_to_delete} associated with {model_id}")
         try:
             success, message = delete_huggingface_cache_model(repo_id_to_delete)
             if success:
                 logger.info(f"Successfully initiated deletion from Hugging Face cache for repo: {repo_id_to_delete}")
             else:
                 logger.warning(f"Failed to delete model from Hugging Face cache for repo {repo_id_to_delete}: {message}")
         except Exception as e:
             logger.error(f"Error calling delete_huggingface_cache_model for {repo_id_to_delete}: {e}")


    # 4. Clean up the thread tracking dictionary (after a delay to let the thread potentially exit)
    if thread_found:
        def cleanup_thread_entry():
            time.sleep(3) # Give thread time to see the flag
            if model_id in download_threads:
                logger.info(f"Cleaning up download thread entry for {model_id}")
                try:
                    # Optional: join the thread shortly before removing?
                    # thread_obj = download_threads[model_id].get("thread")
                    # if thread_obj and thread_obj.is_alive():
                    #    thread_obj.join(timeout=1.0) # Don't wait forever
                    del download_threads[model_id]
                except KeyError:
                    logger.warning(f"Thread entry for {model_id} already removed during cleanup.")
            else:
                logger.info(f"Thread entry for {model_id} already removed before cleanup function ran.")

        cleanup_thread = threading.Thread(target=cleanup_thread_entry, daemon=True)
        cleanup_thread.start()

    logger.info(f"Cancel request processing finished for model {model_id}. Cancel initiated: {cancelled}")
    return cancelled or bool(download_entry) # Return True if we did anything (flagged thread or modified registry)


# --- Active Model Management (unchanged) ---
def get_active_model():
    """Get the currently active model."""
    registry = get_registry()
    return registry.get("active_model")

def set_active_model(model_id):
    """Set the active model."""
    registry = get_registry()
    model_exists = any(model.get("id") == model_id for model in registry.get("models", []))

    if not model_exists and model_id != "f5tts-v1-base": # Allow setting default even if temporarily missing
         # Re-check default specifically
         initialize_registry() # Ensure default is added if missing
         registry = get_registry()
         model_exists = any(model.get("id") == model_id for model in registry.get("models", []))
         if not model_exists:
            return False, f"Model {model_id} not found in registry"

    if registry.get("active_model") == model_id:
        return True, f"Model {model_id} is already active"

    registry["active_model"] = model_id
    if save_registry(registry):
        return True, f"Active model set to {model_id}"
    else:
        # Revert if save failed? Depends on desired behavior.
        # registry["active_model"] = original_active_model # Need to store original before changing
        return False, "Failed to save registry after setting active model"

# --- Add/Delete Model (adjusted delete cleanup) ---
def add_model(model_info):
    """Add a new model to the registry."""
    if not isinstance(model_info, dict) or "id" not in model_info:
         return False, "Invalid model_info format: must be a dict with an 'id'"

    registry = get_registry()
    model_id = model_info["id"]

    # Check if model already exists
    if any(model.get("id") == model_id for model in registry.get("models", [])):
        # Optionally update existing model? For now, just report exists.
        logger.warning(f"Attempted to add model {model_id}, but it already exists.")
        return False, f"Model {model_id} already exists"

    # Add model to registry
    registry.setdefault("models", []).append(model_info)

    # If this is the first *non-default* model added, or if active is None, set it as active
    if registry.get("active_model") is None or registry.get("active_model") == "f5tts-v1-base":
         if model_id != "f5tts-v1-base": # Don't reset active to default if adding default
            registry["active_model"] = model_id
            logger.info(f"Setting newly added model {model_id} as active.")

    if save_registry(registry):
        return True, f"Model {model_id} added successfully"
    else:
        # Revert addition if save failed?
        # registry["models"] = [m for m in registry["models"] if m.get("id") != model_id]
        return False, "Failed to save registry after adding model"

def delete_model(model_id, delete_cache=False):
    """Delete a model from registry and optionally files."""
    if model_id == 'f5tts-v1-base':
        return False, "Cannot delete the default F5-TTS v1 Base model."

    registry = get_registry()
    original_models = list(registry.get("models", [])) # Copy for potential revert
    model_to_delete = None
    model_index = -1
    for i, model in enumerate(original_models):
        if model.get("id") == model_id:
            model_to_delete = model
            model_index = i
            break

    if model_to_delete is None:
        return False, f"Model {model_id} not found for deletion"

    # --- Prepare for Deletion ---
    repo_id_to_delete = model_to_delete.get("repo_id")
    source = model_to_delete.get("source")
    model_path_to_delete = model_to_delete.get("model_path")
    vocab_path_to_delete = model_to_delete.get("vocab_path")
    original_active_model = registry.get("active_model")

    # --- Update Registry ---
    registry["models"].pop(model_index)
    logger.info(f"Removed model {model_id} from registry list.")

    # If model was active, set active to default or None
    if original_active_model == model_id:
        # Check if default model exists, otherwise set to None
        default_exists = any(m.get("id") == 'f5tts-v1-base' for m in registry["models"])
        new_active_model = 'f5tts-v1-base' if default_exists else None
        registry["active_model"] = new_active_model
        logger.info(f"Active model was {model_id}, setting active model to {new_active_model}")

    # Remove any download status
    if model_id in registry.get("downloads", {}):
        logger.info(f"Removing download status for deleted model {model_id}")
        del registry["downloads"][model_id]

    # --- Save Registry Changes ---
    if not save_registry(registry):
        # Attempt to revert registry changes if save fails
        registry["models"] = original_models
        registry["active_model"] = original_active_model
        logger.error(f"Failed to save registry after preparing to delete {model_id}. Reverting registry changes.")
        return False, "Failed to save registry during model deletion"

    # --- Delete Files (after successful registry save) ---
    deleted_files_summary = []
    try:
        # 1. Delete specific model/vocab files if paths are absolute and exist
        if model_path_to_delete and os.path.isabs(model_path_to_delete) and os.path.exists(model_path_to_delete):
            logger.info(f"Deleting model file: {model_path_to_delete}")
            try:
                os.remove(model_path_to_delete)
                deleted_files_summary.append("Deleted model file.")
            except Exception as e:
                logger.error(f"Error deleting model file {model_path_to_delete}: {e}")
                deleted_files_summary.append(f"Error deleting model file: {e}")

        if vocab_path_to_delete and os.path.isabs(vocab_path_to_delete) and os.path.exists(vocab_path_to_delete):
             logger.info(f"Deleting vocab file: {vocab_path_to_delete}")
             try:
                 os.remove(vocab_path_to_delete)
                 deleted_files_summary.append("Deleted vocab file.")
             except Exception as e:
                 logger.error(f"Error deleting vocab file {vocab_path_to_delete}: {e}")
                 deleted_files_summary.append(f"Error deleting vocab file: {e}")

        # 2. Delete the model's directory within the project's models/f5_tts folder
        try:
            project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            project_model_dir = os.path.join(project_dir, "models", "f5_tts", model_id)
            if os.path.exists(project_model_dir) and os.path.isdir(project_model_dir):
                 logger.info(f"Deleting project model directory: {project_model_dir}")
                 try:
                     shutil.rmtree(project_model_dir)
                     deleted_files_summary.append("Deleted project model directory.")
                 except Exception as e:
                     logger.error(f"Error deleting project model directory {project_model_dir}: {e}")
                     deleted_files_summary.append(f"Error deleting project directory: {e}")
            elif os.path.exists(project_model_dir):
                 logger.warning(f"Expected project model directory, but found a file: {project_model_dir}. Skipping deletion.")

        except Exception as e:
            logger.error(f"Error accessing project models directory for deletion: {e}")


        # 3. Delete from Hugging Face cache if requested and applicable
        cache_deletion_result = None
        if delete_cache:
            if repo_id_to_delete:
                logger.info(f"Attempting Hugging Face cache deletion for repo: {repo_id_to_delete}")
                try:
                    success, message = delete_huggingface_cache_model(repo_id_to_delete)
                    if success:
                        logger.info(f"Successfully initiated deletion from Hugging Face cache for {repo_id_to_delete}")
                        cache_deletion_result = f"Initiated Hugging Face cache deletion for {repo_id_to_delete}."
                    else:
                        logger.warning(f"Failed to delete from Hugging Face cache for {repo_id_to_delete}: {message}")
                        cache_deletion_result = f"Failed Hugging Face cache deletion for {repo_id_to_delete}: {message}"
                except Exception as e:
                    logger.error(f"Error calling delete_huggingface_cache_model for {repo_id_to_delete}: {e}")
                    cache_deletion_result = f"Error during Hugging Face cache deletion for {repo_id_to_delete}: {e}"
            else:
                logger.info(f"delete_cache=True but model {model_id} has no associated repo_id. Skipping HF cache deletion.")
                cache_deletion_result = "Skipped Hugging Face cache deletion (no repo_id)."

        # Combine results
        final_message = f"Model {model_id} deleted from registry."
        if deleted_files_summary:
            final_message += " " + " ".join(deleted_files_summary)
        if cache_deletion_result:
            final_message += f" {cache_deletion_result}"

        return True, final_message

    except Exception as e:
        # This catch block is for unexpected errors during the file deletion phase
        logger.error(f"Unexpected error during file deletion phase for model {model_id}: {e}")
        return True, f"Model {model_id} deleted from registry, but encountered an error during file cleanup: {e}"


# --- Model Downloading (MODIFIED for progress reporting) ---

def _custom_download_file(url, output_path, model_id, progress_start_pct=0, progress_end_pct=100):
    """
    Custom download function with precise progress tracking and cancellation.

    Args:
        url (str): URL to download from.
        output_path (str): Path to save the downloaded file.
        model_id (str): Model ID for tracking cancellation.
        progress_start_pct (float): The starting percentage this file represents in the overall download.
        progress_end_pct (float): The ending percentage this file represents in the overall download.

    Returns:
        tuple: (success: bool, downloaded_size: int, total_size: int or None)
               success is False if cancelled or download failed.
    """
    import requests
    import os

    total_size = None
    downloaded_size = 0
    headers = {}
    # Optional: Add headers like User-Agent if needed
    # headers['User-Agent'] = 'MyTTSApp/1.0'

    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Get headers to find content length
        response_head = requests.head(url, allow_redirects=True, timeout=10, headers=headers)
        response_head.raise_for_status() # Check for errors like 404
        content_length = response_head.headers.get('Content-Length')
        if content_length and content_length.isdigit():
            total_size = int(content_length)
            logger.info(f"Determined file size for {os.path.basename(output_path)}: {total_size / (1024*1024):.2f} MB")
        else:
            logger.warning(f"Could not determine file size for {os.path.basename(output_path)} from headers.")

        # Start the download stream
        response = requests.get(url, stream=True, timeout=30, headers=headers) # Longer timeout for GET
        response.raise_for_status() # Check for errors during GET request

        # --- Download Loop ---
        chunk_size = 8192 * 4 # Adjust chunk size if needed (e.g., 32KB)
        last_update_time = time.time()
        update_interval = 0.5 # Update status at most every 0.5 seconds

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=chunk_size):
                # Check for cancellation before writing chunk
                if model_id in download_threads and download_threads[model_id].get("cancel"):
                    logger.warning(f"Download cancelled for model {model_id} during file download.")
                    # Close file handle before attempting delete
                    f.close()
                    # Try to delete partially downloaded file
                    try:
                        if os.path.exists(output_path):
                            os.remove(output_path)
                            logger.info(f"Deleted partially downloaded file: {output_path}")
                    except OSError as e:
                        logger.error(f"Error deleting partial file {output_path}: {e}")
                    return False, downloaded_size, total_size # Indicate cancellation

                if chunk: # Filter out keep-alive new chunks
                    f.write(chunk)
                    downloaded_size += len(chunk)

                    # Throttle status updates
                    current_time = time.time()
                    if current_time - last_update_time >= update_interval:
                        # Calculate overall progress percentage based on this file's contribution
                        overall_progress = None
                        if total_size is not None and total_size > 0:
                            file_progress_pct = (downloaded_size / total_size) * 100
                            progress_range = progress_end_pct - progress_start_pct
                            overall_progress = progress_start_pct + (file_progress_pct / 100) * progress_range
                            # Don't pass calculated overall_progress here, pass raw sizes
                            # Let update_download_status recalculate based on ALL files if needed
                            # For single file downloads, this is fine though.
                            update_download_status(
                                model_id=model_id,
                                status='downloading',
                                # progress=overall_progress, # Let update_download_status calculate from sizes
                                downloaded_size=downloaded_size,
                                total_size=total_size
                            )
                        else:
                             # If total size is unknown, just report bytes downloaded
                             update_download_status(
                                 model_id=model_id,
                                 status='downloading',
                                 downloaded_size=downloaded_size,
                                 total_size=None # Explicitly None
                             )

                        last_update_time = current_time


        logger.info(f"File downloaded successfully: {output_path} ({downloaded_size} bytes)")
        # Final update for this file - report exact downloaded size
        # Let the calling function decide the overall percentage completion
        update_download_status(
             model_id=model_id,
             status='downloading', # Still downloading overall if more files exist
             downloaded_size=downloaded_size,
             total_size=total_size
        )
        return True, downloaded_size, total_size # Indicate success

    except requests.exceptions.RequestException as e:
        logger.error(f"Download error for {url}: {e}")
        # Try to delete potentially corrupted file
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except OSError as rm_err:
                 logger.error(f"Error cleaning up failed download {output_path}: {rm_err}")
        update_download_status(model_id, 'failed', error=f"Network error: {e}")
        return False, downloaded_size, total_size
    except IOError as e:
         logger.error(f"File writing error for {output_path}: {e}")
         update_download_status(model_id, 'failed', error=f"File system error: {e}")
         return False, downloaded_size, total_size
    except Exception as e:
        logger.error(f"Unexpected error during download of {url}: {e}")
        update_download_status(model_id, 'failed', error=f"Unexpected error: {e}")
        return False, downloaded_size, total_size


def _download_model_from_hf_thread(repo_id, model_filename_in_repo, vocab_filename_in_repo, config=None, model_id=None, language_codes=None):
    """Thread function to download a model from Hugging Face Hub."""
    import os
    import time
    import shutil # Ensure shutil is imported

    if model_id is None: # Should be generated before calling thread now
        logger.error("Model ID is None in download thread, cannot proceed.")
        # Cannot update status without model_id
        return

    logger.info(f"Starting download thread for model_id: {model_id} from repo: {repo_id}")

    # Use the project's models/f5_tts directory
    download_dir = None
    try:
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        target_base_dir = os.path.join(project_dir, "models", "f5_tts")
        download_dir = os.path.join(target_base_dir, model_id) # Specific dir for this model
        logger.info(f"Target download directory: {download_dir}")
        os.makedirs(download_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"Error setting up download directory {download_dir}: {e}")
        update_download_status(model_id, 'failed', error=f"Directory setup error: {e}")
        return

    # Update status: Starting
    update_download_status(model_id, 'downloading', progress=0) # Initial status

    # --- Check for Cancellation ---
    if model_id in download_threads and download_threads[model_id].get("cancel"):
        logger.info(f"Download cancelled immediately upon starting thread for {model_id}")
        remove_download_status(model_id) # Clean up status
        # Attempt cleanup of the created directory
        try:
            if os.path.exists(download_dir):
                shutil.rmtree(download_dir)
        except Exception as e:
             logger.error(f"Error cleaning up directory after immediate cancel: {e}")
        return

    # --- Construct URLs ---
    # Use os.path.basename just in case full paths were passed
    model_file_basename = os.path.basename(model_filename_in_repo)
    vocab_file_basename = os.path.basename(vocab_filename_in_repo)

    model_url = f"https://huggingface.co/{repo_id}/resolve/main/{model_filename_in_repo}"
    vocab_url = f"https://huggingface.co/{repo_id}/resolve/main/{vocab_filename_in_repo}"
    logger.info(f"Model URL: {model_url}")
    logger.info(f"Vocab URL: {vocab_url}")

    # --- File Paths ---
    final_model_path = os.path.join(download_dir, model_file_basename)
    final_vocab_path = os.path.join(download_dir, vocab_file_basename)

    # --- Download Files ---
    total_download_size = 0
    known_total_size = 0
    files_to_download = [
        {"url": model_url, "path": final_model_path, "type": "model"},
        {"url": vocab_url, "path": final_vocab_path, "type": "vocab"}
    ]
    downloaded_sizes = {}

    # 1. Download Model File
    logger.info(f"Starting download of model file...")
    model_success, d_size, t_size = _custom_download_file(
        url=model_url,
        output_path=final_model_path,
        model_id=model_id,
        # Assume model is ~90% of total download effort/size for rough staging
        progress_start_pct=0,
        progress_end_pct=90
    )
    downloaded_sizes["model"] = d_size
    if t_size is not None: known_total_size += t_size

    if not model_success:
        logger.error(f"Model file download failed for {model_id}.")
        # _custom_download_file already updated status to 'failed' or handled cancellation
        # Attempt cleanup
        try:
            if os.path.exists(download_dir):
                shutil.rmtree(download_dir)
                logger.info(f"Cleaned up directory after failed model download: {download_dir}")
        except Exception as e:
             logger.error(f"Error cleaning up directory after failed model download: {e}")
        return # Exit thread

    # --- Check for Cancellation after model download ---
    if model_id in download_threads and download_threads[model_id].get("cancel"):
        logger.info(f"Download cancelled after model file download for {model_id}")
        remove_download_status(model_id)
        # Attempt cleanup
        try:
            if os.path.exists(download_dir):
                shutil.rmtree(download_dir)
                logger.info(f"Cleaned up directory after cancellation: {download_dir}")
        except Exception as e:
             logger.error(f"Error cleaning up directory after cancellation: {e}")
        return

    # 2. Download Vocab File
    logger.info(f"Starting download of vocab file...")
    vocab_success, d_size_v, t_size_v = _custom_download_file(
        url=vocab_url,
        output_path=final_vocab_path,
        model_id=model_id,
        # Assume vocab is the remaining 10%
        progress_start_pct=90,
        progress_end_pct=100
    )
    downloaded_sizes["vocab"] = d_size_v
    if t_size_v is not None: known_total_size += t_size_v

    if not vocab_success:
        logger.error(f"Vocab file download failed for {model_id}.")
        # Attempt cleanup
        try:
            if os.path.exists(download_dir):
                shutil.rmtree(download_dir)
                logger.info(f"Cleaned up directory after failed vocab download: {download_dir}")
        except Exception as e:
             logger.error(f"Error cleaning up directory after failed vocab download: {e}")
        return # Exit thread

    # --- Check for Cancellation after all downloads ---
    if model_id in download_threads and download_threads[model_id].get("cancel"):
        logger.info(f"Download cancelled after all files downloaded for {model_id}")
        remove_download_status(model_id)
        # Attempt cleanup
        try:
            if os.path.exists(download_dir):
                shutil.rmtree(download_dir)
                logger.info(f"Cleaned up directory after final cancellation check: {download_dir}")
        except Exception as e:
             logger.error(f"Error cleaning up directory after final cancellation check: {e}")
        return

    # --- Finalizing - Add to Registry ---
    logger.info(f"All files downloaded for {model_id}. Preparing registry entry.")

    # Determine language (using existing logic)
    primary_language = "unknown"
    supported_languages = []
    if language_codes and len(language_codes) > 0:
        supported_languages = language_codes
        primary_language = language_codes[0]
        logger.info(f"Using provided language codes: {language_codes}")
    else:
        # Fallback language detection logic (simplified for brevity)
        import re
        lang_pattern = r'(?:^|[-_])([a-z]{2})(?:$|[-_])'
        matches = re.findall(lang_pattern, model_id.lower())
        if not matches: matches = re.findall(lang_pattern, repo_id.lower())
        if matches:
            primary_language = matches[0]
            supported_languages = list(set(matches))
            logger.info(f"Detected languages: {supported_languages}")
        else:
            primary_language = "en"
            supported_languages = ["en"]
            logger.info("No language detected, defaulting to 'en'")

    model_info = {
        "id": model_id,
        "name": model_id.replace('_', ' ').replace('-', ' ').title(), # Basic naming
        "repo_id": repo_id,
        "model_path": final_model_path, # Direct path to downloaded file
        "vocab_path": final_vocab_path, # Direct path to downloaded file
        "config": config or {},
        "source": "huggingface",
        "language": primary_language,
        "languages": supported_languages,
        "is_symlink": False,
        "original_model_file": None,
        "original_vocab_file": None
    }

    # Add model to registry
    # Update status briefly to indicate completion before adding
    # Use the actual total downloaded size and known total size for final percentage before 'completed'
    update_download_status(
        model_id,
        'downloading',
        downloaded_size=sum(downloaded_sizes.values()),
        total_size=known_total_size if known_total_size > 0 else None,
        progress=99.9 # Indicate almost done before registry add
    )

    success, message = add_model(model_info)

    if success:
        # Status 'completed' will remove the entry from downloads
        update_download_status(model_id, 'completed')
        logger.info(f"Model {model_id} download complete and added to registry.")
    else:
        update_download_status(model_id, 'failed', error=f"Registry add failed: {message}")
        logger.error(f"Failed to add model {model_id} to registry: {message}")
        # Consider deleting downloaded files if registry add fails?
        # try:
        #    if os.path.exists(download_dir): shutil.rmtree(download_dir)
        # except Exception as e: logger.error(f"Error cleaning up after failed registry add: {e}")

    # Clean up thread entry (no longer needed after completion/failure)
    if model_id in download_threads:
        del download_threads[model_id]


def download_model_from_hf(repo_id, model_path, vocab_path, config=None, model_id=None, language_codes=None):
    """Initiates download of a model from Hugging Face Hub."""
    logger.info(f"Request to download HF model: repo={repo_id}, model={model_path}, vocab={vocab_path}")

    # Generate a model ID if not provided or invalid
    if not model_id:
        # Try to create a reasonably unique ID
        model_id = f"{repo_id.split('/')[-1]}_{os.path.splitext(os.path.basename(model_path))[0]}"
        # Sanitize ID (replace non-alphanumeric with underscore)
        model_id = re.sub(r'[^a-zA-Z0-9_-]+', '_', model_id)
        logger.info(f"Generated model_id: {model_id}")

    # --- Pre-download Checks ---
    registry = get_registry()
    # Check if already downloaded
    if any(m.get("id") == model_id for m in registry.get("models", [])):
        logger.warning(f"Model {model_id} already exists in the registry. Skipping download.")
        return False, f"Model {model_id} already exists.", model_id
    # Check if download is already in progress
    if model_id in registry.get("downloads", {}) and registry["downloads"][model_id].get("status") == "downloading":
        logger.warning(f"Download for model {model_id} is already in progress. Skipping new request.")
        return False, f"Download already in progress for {model_id}.", model_id
    if model_id in download_threads:
         logger.warning(f"Download thread for model {model_id} is already active. Skipping new request.")
         return False, f"Download thread already active for {model_id}.", model_id

    # Update status to 'downloading' (initial state)
    update_download_status(model_id, 'downloading', progress=0)

    # Create entry for cancellation flag and thread object
    download_threads[model_id] = {"cancel": False, "thread": None, "repo_id": repo_id} # Store repo_id here too

    # Start download in a separate thread
    thread = threading.Thread(
        target=_download_model_from_hf_thread,
        args=(repo_id, model_path, vocab_path, config, model_id, language_codes),
        daemon=True # Allows program exit even if thread hangs
    )

    download_threads[model_id]["thread"] = thread
    thread.start()
    logger.info(f"Download thread started for model {model_id}.")

    return True, f"Model download started for {model_id}", model_id

# --- URL Parsing and Downloading (MODIFIED for progress reporting) ---

def parse_hf_url(url):
    """Parse Hugging Face URL (unchanged)."""
    logger.info(f"Parsing Hugging Face URL: {url}")
    if not url: return None, None

    # Try hf:// format
    if url.startswith('hf://'):
        parts = url[5:].split('/', 1)
        if len(parts) == 2:
            repo_id, file_path = parts
            # Basic validation: repo_id should have one '/'
            if repo_id.count('/') == 1 and file_path:
                logger.info(f"Parsed hf:// URL -> repo_id: {repo_id}, file_path: {file_path}")
                return repo_id, file_path
            else:
                 logger.warning(f"Invalid hf:// format structure: {url}")
                 return None, None

    # Try https://huggingface.co format
    elif 'huggingface.co' in url:
        try:
            path_part = url.split('huggingface.co/', 1)[1]
            # Format: repo_id/resolve/branch/file_path
            if '/resolve/' in path_part:
                repo_id, branch_file = path_part.split('/resolve/', 1)
                if '/' in branch_file:
                    _, file_path = branch_file.split('/', 1) # Skip branch
                    if repo_id.count('/') == 1 and file_path:
                        logger.info(f"Parsed resolve URL -> repo_id: {repo_id}, file_path: {file_path}")
                        return repo_id, file_path
            # Format: repo_id/blob/branch/file_path
            elif '/blob/' in path_part:
                repo_id, branch_file = path_part.split('/blob/', 1)
                if '/' in branch_file:
                    _, file_path = branch_file.split('/', 1) # Skip branch
                    if repo_id.count('/') == 1 and file_path:
                        logger.info(f"Parsed blob URL -> repo_id: {repo_id}, file_path: {file_path}")
                        return repo_id, file_path
            # Add other potential formats if needed (e.g., direct file links without resolve/blob?)
            logger.warning(f"Could not extract repo_id/file_path from huggingface.co URL structure: {url}")
            return None, None
        except (IndexError, ValueError) as e:
            logger.error(f"Error parsing huggingface.co URL {url}: {e}")
            return None, None

    logger.error(f"URL format not recognized as Hugging Face: {url}")
    return None, None


def _download_model_from_url_thread(model_url, vocab_url=None, config=None, model_id=None, language_codes=None):
    """Thread function to download a model from direct URLs."""
    import os
    import time
    import shutil # Ensure shutil is imported
    import re # For sanitizing model_id

    if model_id is None:
        logger.error("Model ID is None in URL download thread, cannot proceed.")
        return

    logger.info(f"Starting URL download thread for model_id: {model_id}")

    # Setup download directory within project structure
    download_dir = None
    try:
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        target_base_dir = os.path.join(project_dir, "models", "f5_tts")
        download_dir = os.path.join(target_base_dir, model_id)
        logger.info(f"Target URL download directory: {download_dir}")
        os.makedirs(download_dir, exist_ok=True)
    except Exception as e:
        logger.error(f"Error setting up download directory {download_dir}: {e}")
        update_download_status(model_id, 'failed', error=f"Directory setup error: {e}")
        return

    # Update status: Starting
    update_download_status(model_id, 'downloading', progress=0)

    # --- Check for Cancellation ---
    if model_id in download_threads and download_threads[model_id].get("cancel"):
        logger.info(f"URL Download cancelled immediately upon starting thread for {model_id}")
        remove_download_status(model_id)
        try:
             if os.path.exists(download_dir): shutil.rmtree(download_dir)
        except Exception as e: logger.error(f"Error cleaning up directory after immediate cancel: {e}")
        return

    # --- Determine File Paths ---
    try:
        model_filename = os.path.basename(requests.utils.urlparse(model_url).path)
        if not model_filename: model_filename = f"{model_id}_model.file" # Fallback name
        final_model_path = os.path.join(download_dir, model_filename)

        final_vocab_path = None
        if vocab_url:
            vocab_filename = os.path.basename(requests.utils.urlparse(vocab_url).path)
            if not vocab_filename: vocab_filename = f"{model_id}_vocab.txt" # Fallback name
            final_vocab_path = os.path.join(download_dir, vocab_filename)
    except Exception as e:
        logger.error(f"Error parsing URLs to get filenames: {e}")
        update_download_status(model_id, 'failed', error="Invalid URL format")
        return

    # --- Download Files ---
    known_total_size = 0
    downloaded_sizes = {}

    # 1. Download Model File
    logger.info(f"Starting download of model file from URL: {model_url}")
    model_success, d_size, t_size = _custom_download_file(
        url=model_url,
        output_path=final_model_path,
        model_id=model_id,
        # If vocab exists, model is ~90%, else 100%
        progress_start_pct=0,
        progress_end_pct=90 if vocab_url else 100
    )
    downloaded_sizes["model"] = d_size
    if t_size is not None: known_total_size += t_size

    if not model_success:
        logger.error(f"Model file URL download failed for {model_id}.")
        # Cleanup handled by _custom_download_file or its caller
        try:
            if os.path.exists(download_dir): shutil.rmtree(download_dir)
        except Exception as e: logger.error(f"Error cleaning directory after failed URL model download: {e}")
        return # Exit thread

    # --- Check for Cancellation after model ---
    if model_id in download_threads and download_threads[model_id].get("cancel"):
        logger.info(f"URL Download cancelled after model file download for {model_id}")
        remove_download_status(model_id)
        try:
            if os.path.exists(download_dir): shutil.rmtree(download_dir)
        except Exception as e: logger.error(f"Error cleaning directory after cancel: {e}")
        return

    # 2. Download Vocab File (if applicable)
    if vocab_url:
        logger.info(f"Starting download of vocab file from URL: {vocab_url}")
        vocab_success, d_size_v, t_size_v = _custom_download_file(
            url=vocab_url,
            output_path=final_vocab_path,
            model_id=model_id,
            progress_start_pct=90, # Starts after model download percentage
            progress_end_pct=100
        )
        downloaded_sizes["vocab"] = d_size_v
        if t_size_v is not None: known_total_size += t_size_v

        if not vocab_success:
            logger.error(f"Vocab file URL download failed for {model_id}.")
            try:
                if os.path.exists(download_dir): shutil.rmtree(download_dir)
            except Exception as e: logger.error(f"Error cleaning directory after failed URL vocab download: {e}")
            return # Exit thread

        # --- Check for Cancellation after vocab ---
        if model_id in download_threads and download_threads[model_id].get("cancel"):
            logger.info(f"URL Download cancelled after vocab file download for {model_id}")
            remove_download_status(model_id)
            try:
                 if os.path.exists(download_dir): shutil.rmtree(download_dir)
            except Exception as e: logger.error(f"Error cleaning directory after cancel: {e}")
            return

    # --- Finalizing - Add to Registry ---
    logger.info(f"All URL files downloaded for {model_id}. Preparing registry entry.")

    # Determine language (using existing logic, checking ID and URL)
    primary_language = "unknown"
    supported_languages = []
    if language_codes and len(language_codes) > 0:
        supported_languages = language_codes
        primary_language = language_codes[0]
        logger.info(f"Using provided language codes: {language_codes}")
    else:
        # Fallback logic
        import re
        lang_pattern = r'(?:^|[-_])([a-z]{2})(?:$|[-_])'
        matches = re.findall(lang_pattern, model_id.lower())
        if not matches: matches = re.findall(lang_pattern, model_url.lower())
        if matches:
            primary_language = matches[0]
            supported_languages = list(set(matches))
            logger.info(f"Detected languages: {supported_languages}")
        else:
            primary_language = "en"
            supported_languages = ["en"]
            logger.info("No language detected, defaulting to 'en'")

    model_info = {
        "id": model_id,
        "name": model_id.replace('_', ' ').replace('-', ' ').title(),
        "model_path": final_model_path,
        "vocab_path": final_vocab_path, # Will be None if no vocab_url provided
        "config": config or {},
        "source": "url", # Indicate source is URL
        "language": primary_language,
        "languages": supported_languages,
        "is_symlink": False,
        "original_model_file": None,
        "original_vocab_file": None
    }

    # Update status before adding to registry
    update_download_status(
        model_id,
        'downloading',
        downloaded_size=sum(downloaded_sizes.values()),
        total_size=known_total_size if known_total_size > 0 else None,
        progress=99.9
    )

    success, message = add_model(model_info)

    if success:
        update_download_status(model_id, 'completed')
        logger.info(f"Model {model_id} from URL download complete and added to registry.")
    else:
        update_download_status(model_id, 'failed', error=f"Registry add failed: {message}")
        logger.error(f"Failed to add model {model_id} from URL to registry: {message}")
        # try:
        #     if os.path.exists(download_dir): shutil.rmtree(download_dir)
        # except Exception as e: logger.error(f"Error cleaning up after failed registry add: {e}")


    # Clean up thread entry
    if model_id in download_threads:
        del download_threads[model_id]


def download_model_from_url(model_url, vocab_url=None, config=None, model_id=None, language_codes=None):
    """Initiates download of a model from direct URLs."""
    logger.info(f"Request to download URL model: model={model_url}, vocab={vocab_url}")
    import re # For sanitizing

    # Generate model ID if not provided
    if not model_id:
        try:
            # Use filename from model URL as base for ID
            parsed_url = requests.utils.urlparse(model_url)
            base_name = os.path.splitext(os.path.basename(parsed_url.path))[0]
            if not base_name: # Handle cases like domain root download?
                base_name = parsed_url.netloc.replace('.', '_')
            model_id = base_name
        except Exception:
             model_id = f"url_model_{int(time.time())}" # Safe fallback ID

        # Sanitize ID
        model_id = re.sub(r'[^a-zA-Z0-9_-]+', '_', model_id)
        logger.info(f"Generated model_id for URL download: {model_id}")


    # --- Pre-download Checks ---
    registry = get_registry()
    if any(m.get("id") == model_id for m in registry.get("models", [])):
        logger.warning(f"Model {model_id} (from URL) already exists. Skipping download.")
        return False, f"Model {model_id} already exists.", model_id
    if model_id in registry.get("downloads", {}) and registry["downloads"][model_id].get("status") == "downloading":
        logger.warning(f"Download for model {model_id} (from URL) already in progress.")
        return False, f"Download already in progress for {model_id}.", model_id
    if model_id in download_threads:
         logger.warning(f"Download thread for model {model_id} (from URL) already active.")
         return False, f"Download thread already active for {model_id}.", model_id


    # Update status to 'downloading'
    update_download_status(model_id, 'downloading', progress=0)

    # Track thread
    download_threads[model_id] = {"cancel": False, "thread": None, "url": model_url}

    # Start download thread
    thread = threading.Thread(
        target=_download_model_from_url_thread,
        args=(model_url, vocab_url, config, model_id, language_codes),
        daemon=True
    )

    download_threads[model_id]["thread"] = thread
    thread.start()
    logger.info(f"URL download thread started for model {model_id}.")

    return True, f"Model download started for {model_id} from URL", model_id

# --- Initialize registry on module import ---
initialize_registry()
logger.info("Model manager initialized.")

# Example usage (for testing, remove in production)
if __name__ == '__main__':
    print("Model Manager Testing...")
    print("Current Registry:")
    # Use print instead of logger for direct output when run as script
    print(json.dumps(get_models(include_cache=False), indent=2))
