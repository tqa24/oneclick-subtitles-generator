import os
import logging
import torch
from .narration_config import HAS_F5TTS, device

logger = logging.getLogger(__name__)

def load_tts_model(model_id=None):
    """Loads or retrieves the specified F5-TTS model."""
    # This function encapsulates model loading logic.
    # Currently called within the /generate route per request.
    if not HAS_F5TTS:
        raise RuntimeError("F5-TTS is not available.")

    try:
        from f5_tts.api import F5TTS
        from model_manager import get_models, get_active_model

        # Determine which model to load
        target_model_id = model_id or get_active_model()
        if not target_model_id:
             logger.warning("No specific or active model set, attempting to load default F5-TTS model.")
             # Initialize default F5-TTS
             tts_instance = F5TTS(device=device)
             logger.info(f"Loaded default F5-TTS model instance on device: {device}")
             return tts_instance, "default" # Return instance and ID used

        # Find the model details from registry
        model_registry = get_models(include_cache=True) # Check both installed and cache
        all_known_models = model_registry.get('models', []) + model_registry.get('cached_models', [])
        model_info = next((m for m in all_known_models if m['id'] == target_model_id), None)

        if not model_info:
            logger.error(f"Model ID '{target_model_id}' not found in registry. Cannot load.")
            raise ValueError(f"Model ID '{target_model_id}' not found.")

        logger.info(f"Loading F5-TTS model: '{target_model_id}' on device: {device}")
        logger.debug(f"Model Info: {model_info}")

        # Handle the default model marker explicitly
        if model_info.get("source") == "default" or model_info.get("model_path") == "default":
             logger.info("Model identified as default, initializing F5TTS without explicit paths.")
             tts_instance = F5TTS(device=device)
        else:
             # Initialize with specific model paths
             model_path = model_info.get("model_path")
             vocab_path = model_info.get("vocab_path") # Can be None

             if not model_path or not os.path.exists(model_path):
                 logger.error(f"Model file path not found or invalid for '{target_model_id}': {model_path}")
                 raise FileNotFoundError(f"Model file not found for {target_model_id}")
             if vocab_path and not os.path.exists(vocab_path):
                  logger.warning(f"Vocabulary file path specified but not found for '{target_model_id}': {vocab_path}. Model might fail.")
                  # Depending on F5TTS, None might be acceptable if vocab is bundled or not needed

             # Only pass parameters that F5TTS actually accepts
             logger.info(f"Initializing F5-TTS with ckpt_file='{model_path}', vocab_file='{vocab_path}'")
             tts_instance = F5TTS(
                 device=device,
                 ckpt_file=model_path,
                 vocab_file=vocab_path # Pass None if vocab_path is None or empty
             )

        logger.info(f"Successfully loaded F5-TTS model '{target_model_id}'")
        return tts_instance, target_model_id

    except Exception as e:
        logger.exception(f"Error loading F5-TTS model (ID: {target_model_id if 'target_model_id' in locals() else 'unknown'}): {e}")
        # Re-raise a more specific error or handle appropriately
        raise RuntimeError(f"Failed to load TTS model '{target_model_id if 'target_model_id' in locals() else 'unknown'}': {str(e)}") from e
