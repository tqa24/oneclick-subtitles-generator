"""
Registry management for F5-TTS models.
"""
import os
import json
from .constants import MODELS_REGISTRY_FILE, logger

try:
    from huggingFaceCache import list_huggingface_cache_models
except ImportError:
    # Provide dummy function if the import fails, to avoid crashing
    logger.warning("huggingFaceCache module not found. Cache operations might be limited.")
    def list_huggingface_cache_models(): return []


def initialize_registry():
    """Initialize the models registry if it doesn't exist."""
    if not os.path.exists(MODELS_REGISTRY_FILE):
        with open(MODELS_REGISTRY_FILE, 'w') as f:
            json.dump({
                "active_model": None,
                "models": [],
                "downloads": {}
            }, f, indent=2)


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


    except (json.JSONDecodeError, ValueError, TypeError, KeyError) as e:
        logger.error(f"Error reading or validating registry: {e}. Resetting registry.")
        # Reset registry if invalid
        with open(MODELS_REGISTRY_FILE, 'w') as f:
            json.dump({
                "active_model": None,
                "models": [],
                "downloads": {}
            }, f, indent=2)

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
