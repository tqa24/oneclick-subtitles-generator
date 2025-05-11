"""
Utilities for managing the Hugging Face cache directory
"""
import os
import shutil
import logging
import json
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_huggingface_cache_dir():
    """Get the Hugging Face cache directory path"""
    try:
        # Try the newer API first
        try:
            from huggingface_hub import get_cache_dir
            cache_dir = os.path.join(get_cache_dir(), "hub")

        except (ImportError, AttributeError):
            # Fallback to default paths if the import fails
            # Default cache directory is ~/.cache/huggingface/hub on Linux/Mac
            # and C:\Users\<username>\.cache\huggingface\hub on Windows
            home_dir = os.path.expanduser("~")
            cache_dir = os.path.join(home_dir, ".cache", "huggingface", "hub")


        # Make sure the parent directory exists
        parent_dir = os.path.dirname(cache_dir)
        if not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)

    except Exception as e:
        logger.error(f"Error setting up cache directory: {e}")
        # Still return the default path as a fallback
        home_dir = os.path.expanduser("~")
        cache_dir = os.path.join(home_dir, ".cache", "huggingface", "hub")
        logger.warning(f"Falling back to default path due to error: {cache_dir}")

    # Check if the directory exists
    if not os.path.exists(cache_dir):
        logger.warning(f"Hugging Face cache directory not found at {cache_dir}")
        return None

    # Log the directory contents for debugging
    try:
        if os.path.exists(cache_dir):

            contents = os.listdir(cache_dir)

    except Exception as e:
        logger.warning(f"Error listing cache directory contents: {e}")

    return cache_dir

def list_huggingface_cache_models():
    """List all models in the Hugging Face cache directory"""
    cache_dir = get_huggingface_cache_dir()
    if not cache_dir:
        return []

    models = []

    # The models directory structure is:
    # ~/.cache/huggingface/hub/models--<org>--<model>/snapshots/<hash>/
    try:
        # List all directories that start with "models--"
        model_dirs = [d for d in os.listdir(cache_dir) if d.startswith("models--")]

        for model_dir in model_dirs:
            # Extract org and model name from directory name
            parts = model_dir.split("--")
            if len(parts) >= 3:
                org = parts[1]
                model_name = "--".join(parts[2:])

                # Get the full path to the model directory
                full_path = os.path.join(cache_dir, model_dir)

                # Get size of the model directory
                size = get_directory_size(full_path)

                # Check if there are snapshots
                snapshots_dir = os.path.join(full_path, "snapshots")
                has_snapshots = os.path.exists(snapshots_dir)

                # Get snapshot hashes if they exist
                snapshots = []
                if has_snapshots:
                    try:
                        snapshot_hashes = os.listdir(snapshots_dir)
                        for hash_dir in snapshot_hashes:
                            snapshot_path = os.path.join(snapshots_dir, hash_dir)
                            if os.path.isdir(snapshot_path):
                                # Get files in the snapshot
                                files = []
                                try:
                                    for root, _, filenames in os.walk(snapshot_path):
                                        for filename in filenames:
                                            file_path = os.path.join(root, filename)
                                            rel_path = os.path.relpath(file_path, snapshot_path)
                                            file_size = os.path.getsize(file_path)
                                            files.append({
                                                "name": rel_path,
                                                "size": file_size
                                            })
                                except Exception as e:
                                    logger.error(f"Error listing files in snapshot {hash_dir}: {e}")

                                snapshots.append({
                                    "hash": hash_dir,
                                    "path": snapshot_path,
                                    "size": get_directory_size(snapshot_path),
                                    "files": files
                                })
                    except Exception as e:
                        logger.error(f"Error listing snapshots for {model_dir}: {e}")

                models.append({
                    "id": f"{org}/{model_name}",
                    "org": org,
                    "name": model_name,
                    "path": full_path,
                    "size": size,
                    "snapshots": snapshots
                })
    except Exception as e:
        logger.error(f"Error listing Hugging Face cache models: {e}")

    return models

def get_directory_size(path):
    """Get the total size of a directory in bytes"""
    total_size = 0
    for dirpath, _, filenames in os.walk(path):
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            if os.path.exists(file_path):
                total_size += os.path.getsize(file_path)
    return total_size

def delete_huggingface_cache_model(model_id):
    """Delete a model from the Hugging Face cache directory"""
    cache_dir = get_huggingface_cache_dir()
    if not cache_dir:
        return False, "Hugging Face cache directory not found"

    # Split model_id into org and model name
    parts = model_id.split("/")
    if len(parts) != 2:
        return False, f"Invalid model ID format: {model_id}. Expected format: org/model"

    org = parts[0]
    model_name = parts[1]

    # Construct the directory name
    dir_name = f"models--{org}--{model_name.replace('/', '--')}"
    model_dir = os.path.join(cache_dir, dir_name)

    # Check if the directory exists
    if not os.path.exists(model_dir):
        return False, f"Model directory not found: {model_dir}"

    # Delete the directory
    try:
        shutil.rmtree(model_dir)

        return True, f"Successfully deleted model {model_id} from Hugging Face cache"
    except Exception as e:
        logger.error(f"Error deleting Hugging Face cache model {model_id}: {e}")
        return False, f"Error deleting model: {str(e)}"
