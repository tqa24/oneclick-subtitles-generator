"""
Model management functions for F5-TTS models.
"""
import os
import shutil
from .constants import logger
from .registry import get_registry, save_registry

try:
    from huggingFaceCache import delete_huggingface_cache_model
except ImportError:
    # Provide dummy function if the import fails, to avoid crashing
    logger.warning("huggingFaceCache module not found. Cache operations might be limited.")
    def delete_huggingface_cache_model(repo_id): return (False, "huggingFaceCache module not found")


def is_model_using_symlinks(model_id):
    """
    Check if a model is using symbolic links and get model size information.

    Args:
        model_id: The ID of the model to check

    Returns:
        Tuple of (is_symlink, original_model_file, original_vocab_file, size)
        where size is the total size of the model files in bytes
    """
    # Get model info from registry
    registry = get_registry()
    model = None
    for m in registry.get("models", []):
        if m.get("id") == model_id:
            model = m
            break

    if not model:
        raise FileNotFoundError(f"Model {model_id} not found in registry")

    # Get model and vocab paths
    model_path = model.get("model_path")
    vocab_path = model.get("vocab_path")

    # Calculate total size
    size = 0
    if model_path and os.path.exists(model_path):
        try:
            size += os.path.getsize(model_path)
        except Exception as e:
            logger.error(f"Error getting size of model file {model_path}: {e}")

    if vocab_path and os.path.exists(vocab_path):
        try:
            size += os.path.getsize(vocab_path)
        except Exception as e:
            logger.error(f"Error getting size of vocab file {vocab_path}: {e}")

    # Check for symlinks (always False in current implementation)
    is_symlink = False
    original_model_file = None
    original_vocab_file = None

    return is_symlink, original_model_file, original_vocab_file, size


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
         from .registry import initialize_registry
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


    # If model was active, set active to default or None
    if original_active_model == model_id:
        # Check if default model exists, otherwise set to None
        default_exists = any(m.get("id") == 'f5tts-v1-base' for m in registry["models"])
        new_active_model = 'f5tts-v1-base' if default_exists else None
        registry["active_model"] = new_active_model


    # Remove any download status
    if model_id in registry.get("downloads", {}):

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

            try:
                os.remove(model_path_to_delete)
                deleted_files_summary.append("Deleted model file.")
            except Exception as e:
                logger.error(f"Error deleting model file {model_path_to_delete}: {e}")
                deleted_files_summary.append(f"Error deleting model file: {e}")

        if vocab_path_to_delete and os.path.isabs(vocab_path_to_delete) and os.path.exists(vocab_path_to_delete):

             try:
                 os.remove(vocab_path_to_delete)
                 deleted_files_summary.append("Deleted vocab file.")
             except Exception as e:
                 logger.error(f"Error deleting vocab file {vocab_path_to_delete}: {e}")
                 deleted_files_summary.append(f"Error deleting vocab file: {e}")

        # 2. Delete the model's directory within the models/f5_tts folder
        try:
            from .constants import MODELS_DIR
            project_model_dir = os.path.join(MODELS_DIR, model_id)
            if os.path.exists(project_model_dir) and os.path.isdir(project_model_dir):

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

                try:
                    success, message = delete_huggingface_cache_model(repo_id_to_delete)
                    if success:

                        cache_deletion_result = f"Initiated Hugging Face cache deletion for {repo_id_to_delete}."
                    else:
                        logger.warning(f"Failed to delete from Hugging Face cache for {repo_id_to_delete}: {message}")
                        cache_deletion_result = f"Failed Hugging Face cache deletion for {repo_id_to_delete}: {message}"
                except Exception as e:
                    logger.error(f"Error calling delete_huggingface_cache_model for {repo_id_to_delete}: {e}")
                    cache_deletion_result = f"Error during Hugging Face cache deletion for {repo_id_to_delete}: {e}"
            else:

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
