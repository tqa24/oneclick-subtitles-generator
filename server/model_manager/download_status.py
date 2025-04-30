"""
Download status management for F5-TTS models.
"""
import time
from .constants import logger
from .registry import get_registry, save_registry

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
