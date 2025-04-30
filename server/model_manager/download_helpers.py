"""
Helper functions for downloading F5-TTS models.
"""
import os
import re
import time
import shutil
import requests
from .constants import logger, download_threads
from .registry import get_registry
from .models import add_model
from .download_status import update_download_status, remove_download_status

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


def _download_model_from_url_thread(model_url, vocab_url=None, config=None, model_id=None, language_codes=None):
    """Thread function to download a model from direct URLs."""
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
