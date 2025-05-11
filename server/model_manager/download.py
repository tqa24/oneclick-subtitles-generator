"""
Download functionality for F5-TTS models.
"""
import os
import re
import time
import threading
import requests
from .constants import logger, download_threads
from .registry import get_registry, save_registry
from .download_status import update_download_status, remove_download_status
from .download_helpers import _custom_download_file, _download_model_from_hf_thread, _download_model_from_url_thread

try:
    from huggingface_hub import get_cache_dir
    from huggingFaceCache import delete_huggingface_cache_model
except ImportError:
    # Provide dummy function if the import fails
    logger.warning("huggingface_hub or huggingFaceCache module not found. Cache operations might be limited.")
    def get_cache_dir(): return None
    def delete_huggingface_cache_model(repo_id): return (False, "huggingFaceCache module not found")


def cancel_download(model_id):
    """Cancel an ongoing download and attempt cleanup."""

    cancelled = False
    thread_found = False

    # 1. Signal the download thread to stop
    if model_id in download_threads:
        thread_info = download_threads[model_id]
        if not thread_info.get("cancel", False): # Check if not already cancelled
            thread_info["cancel"] = True
            cancelled = True
        else:
            # Already cancelled, nothing to do
            pass

        thread_found = True
    else:
        # Thread not found for this model_id
        pass

    # 2. Update registry status immediately to 'failed' or remove entry
    registry = get_registry()
    download_entry = registry.get("downloads", {}).get(model_id)

    if download_entry:
        if download_entry.get("status") == 'downloading':

            update_download_status(model_id, 'failed', error="Download cancelled by user.")
            # Keep the failed status for a bit so UI can see it was cancelled
        else:
            # If it wasn't downloading (e.g., already failed/completed), just remove it
            remove_download_status(model_id)
    else:
        # No download entry found
        pass

    # 3. Attempt to clean up files (models dir and cache)
    cleanup_paths = []
    try:
        # Models directory
        from .constants import MODELS_DIR
        project_model_dir = os.path.join(MODELS_DIR, model_id)
        if os.path.exists(project_model_dir):
            cleanup_paths.append(project_model_dir)

        # Hugging Face cache (check for custom dir, less likely now but for safety)
        try:
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

        try:
            if os.path.isdir(path_to_delete):
                import shutil
                shutil.rmtree(path_to_delete)
            elif os.path.exists(path_to_delete): # Might be a file if download failed early
                os.remove(path_to_delete)

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
        try:
            success, message = delete_huggingface_cache_model(repo_id_to_delete)
            if success:
                logger.info(f"Successfully deleted model from Hugging Face cache for repo {repo_id_to_delete}")
            else:
                logger.warning(f"Failed to delete model from Hugging Face cache for repo {repo_id_to_delete}: {message}")
        except Exception as e:
            logger.error(f"Error calling delete_huggingface_cache_model for {repo_id_to_delete}: {e}")


    # 4. Clean up the thread tracking dictionary (after a delay to let the thread potentially exit)
    if thread_found:
        def cleanup_thread_entry():
            time.sleep(3) # Give thread time to see the flag
            if model_id in download_threads:

                try:
                    # Optional: join the thread shortly before removing?
                    # thread_obj = download_threads[model_id].get("thread")
                    # if thread_obj and thread_obj.is_alive():
                    #    thread_obj.join(timeout=1.0) # Don't wait forever
                    del download_threads[model_id]
                except KeyError:
                    logger.warning(f"Thread entry for {model_id} already removed during cleanup.")
            else:
                logger.debug(f"Thread entry for {model_id} already removed during cleanup check.")

        cleanup_thread = threading.Thread(target=cleanup_thread_entry, daemon=True)
        cleanup_thread.start()


    return cancelled or bool(download_entry) # Return True if we did anything (flagged thread or modified registry)


def download_model_from_hf(repo_id, model_path, vocab_path, config=None, model_id=None, language_codes=None):
    """Initiates download of a model from Hugging Face Hub."""


    # Generate a model ID if not provided or invalid
    if not model_id:
        # Try to create a reasonably unique ID
        model_id = f"{repo_id.split('/')[-1]}_{os.path.splitext(os.path.basename(model_path))[0]}"
        # Sanitize ID (replace non-alphanumeric with underscore)
        model_id = re.sub(r'[^a-zA-Z0-9_-]+', '_', model_id)


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


    return True, f"Model download started for {model_id}", model_id


def download_model_from_url(model_url, vocab_url=None, config=None, model_id=None, language_codes=None):
    """Initiates download of a model from direct URLs."""

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


    return True, f"Model download started for {model_id} from URL", model_id
