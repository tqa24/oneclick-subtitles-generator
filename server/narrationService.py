import os
import uuid
import logging
import base64
import requests
import json
import time
from flask import Blueprint, request, jsonify, send_file, Response
from werkzeug.utils import secure_filename
from io import BytesIO
# Import from model_manager package instead of modelManager.py
from model_manager import (
    get_models, get_active_model, set_active_model, add_model, delete_model,
    download_model_from_hf, download_model_from_url, parse_hf_url,
    get_download_status, update_download_status, remove_download_status,
    update_model_info, is_model_using_symlinks, initialize_registry, cancel_download
)

# Set up logging with UTF-8 encoding
import sys
import codecs

# Force UTF-8 encoding for stdout and stderr if not already set
# Note: This might not be necessary or could cause issues in some environments (e.g., Docker logs)
# Consider configuring logging handlers directly if problems arise.
try:
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
except Exception as e:
    print(f"Warning: Could not force UTF-8 encoding for stdout/stderr: {e}")

# Configure logging
# Use basicConfig only if no handlers are configured yet to avoid duplicate logs
if not logging.root.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        encoding='utf-8',
        handlers=[logging.StreamHandler(sys.stdout)] # Explicitly use the configured stdout
    )
logger = logging.getLogger(__name__)

# Create blueprint
narration_bp = Blueprint('narration', __name__)

# Constants
# Use absolute path relative to this file's location
SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_ROOT_DIR = os.path.dirname(SERVICE_DIR)
NARRATION_DIR = os.path.join(APP_ROOT_DIR, 'narration')
REFERENCE_AUDIO_DIR = os.path.join(NARRATION_DIR, 'reference')
OUTPUT_AUDIO_DIR = os.path.join(NARRATION_DIR, 'output')

# Create directories if they don't exist
os.makedirs(NARRATION_DIR, exist_ok=True)
os.makedirs(REFERENCE_AUDIO_DIR, exist_ok=True)
os.makedirs(OUTPUT_AUDIO_DIR, exist_ok=True)
logger.info(f"Reference audio directory: {REFERENCE_AUDIO_DIR}")
logger.info(f"Output audio directory: {OUTPUT_AUDIO_DIR}")

# Initialize variables
HAS_F5TTS = False
INIT_ERROR = None
device = None
# tts_model variable is removed, models are loaded on demand within generate route

# --- Helper Functions (Gemini, Language Detection) ---

def get_gemini_api_key():
    """Get Gemini API key from various sources"""
    # First try environment variable
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key:
        logger.info("Found Gemini API key in environment variable.")
        return api_key

    # Try to read from a config file
    try:
        config_path = os.path.join(APP_ROOT_DIR, 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as config_file:
                config = json.load(config_file)
                api_key = config.get('gemini_api_key')
                if api_key:
                    logger.info("Found Gemini API key in config.json.")
                    return api_key
    except Exception as e:
        logger.error(f"Error reading config file ({config_path}): {e}")

    # Try to read from localStorage.json file (saved from browser localStorage)
    try:
        localStorage_path = os.path.join(APP_ROOT_DIR, 'localStorage.json')
        if os.path.exists(localStorage_path):
            with open(localStorage_path, 'r', encoding='utf-8') as localStorage_file:
                localStorage_data = json.load(localStorage_file)
                api_key = localStorage_data.get('gemini_api_key')
                if api_key:
                    logger.info("Found Gemini API key in localStorage.json.")
                    return api_key
    except Exception as e:
        logger.error(f"Error reading localStorage file ({localStorage_path}): {e}")

    logger.warning("Gemini API key not found in environment variable, config.json, or localStorage.json.")
    return None

def transcribe_with_gemini(audio_path, model="gemini-1.5-flash-latest"):
    """Transcribe audio using Gemini API and detect language"""
    try:
        logger.info(f"Transcribing audio with Gemini: {audio_path}, Model: {model}")

        # Read the audio file as binary data
        with open(audio_path, 'rb') as audio_file:
            audio_data = audio_file.read()

        # Encode the audio data as base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        # Use the base64 transcription function
        return transcribe_with_gemini_base64(audio_base64, model)
    except FileNotFoundError:
        logger.error(f"Audio file not found for Gemini transcription: {audio_path}")
        return {
            "text": "",
            "is_english": True,
            "language": "Error: File Not Found"
        }
    except Exception as e:
        logger.error(f"Error transcribing with Gemini (file: {audio_path}): {e}")
        return {
            "text": "",
            "is_english": True,  # Default to True on error
            "language": f"Error: {type(e).__name__}"
        }

def transcribe_with_gemini_base64(audio_base64, model="gemini-1.5-flash-latest"):
    """Transcribe audio using Gemini API from base64 data"""
    try:
        logger.info(f"Transcribing audio with Gemini from base64 data, Model: {model}")

        # Get Gemini API key
        api_key = get_gemini_api_key()

        if not api_key:
            logger.error("Gemini API key not found, cannot transcribe.")
            raise ValueError("Gemini API key not found")

        # Prepare the request to Gemini API
        # Use v1beta as it often has latest features like audio input
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        # Create a more specific prompt for transcription and language ID
        prompt = "Please transcribe the following audio accurately. Also, identify the primary language spoken."

        # Prepare the request payload with optimized parameters
        payload = {
            "contents": [
                {
                    # No role needed for simple inference with inline data
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                # Assuming WAV, adjust if needed or detect mime type
                                "mimeType": "audio/wav",
                                "data": audio_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,  # Lower temperature for more deterministic transcription
                "maxOutputTokens": 1024 # Generous limit for transcription
            }
        }

        # Send the request to Gemini API with a reasonable timeout
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=30)  # Increased timeout for potentially longer audio
        duration = time.time() - start_time
        logger.info(f"Gemini API request completed in {duration:.2f} seconds.")

        # Check if the request was successful
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Gemini API error: {response.status_code} {error_text}")
            # Try to parse error details if JSON
            try:
                error_json = response.json()
                error_message = error_json.get('error', {}).get('message', 'Unknown API Error')
            except json.JSONDecodeError:
                error_message = error_text or 'Unknown API Error'
            raise Exception(f"Gemini API error ({response.status_code}): {error_message}")

        # Parse the response
        result = response.json()
        # logger.debug(f"Full Gemini Response: {json.dumps(result, indent=2)}") # Potentially large

        # Extract the transcription text
        transcription = ""
        if 'candidates' in result and len(result['candidates']) > 0:
            candidate = result['candidates'][0]
            if 'content' in candidate and 'parts' in candidate['content']:
                parts = candidate['content']['parts']
                if len(parts) > 0 and 'text' in parts[0]:
                    full_response_text = parts[0]['text'].strip()
                    logger.info(f"Raw Gemini response text: {full_response_text}")
                    # Simple extraction: assume the first part is transcription,
                    # might need refinement if Gemini includes language ID explicitly.
                    # Let's assume the transcription is the main part of the text.
                    transcription = full_response_text # May need parsing if language is included
                    logger.info(f"Extracted Gemini transcription: {transcription}")

        if not transcription:
            logger.warning("Gemini API returned response but no transcription text found.")
            return {
                "text": "",
                "is_english": True,
                "language": "Unknown (No text)"
            }

        # Simple language detection based on the transcription
        is_english = is_text_english(transcription)
        language = "English" if is_english else "Non-English"
        logger.info(f"Detected language based on transcription: {language}")

        return {
            "text": transcription,
            "is_english": is_english,
            "language": language
        }

    except requests.exceptions.Timeout:
        logger.error("Error transcribing with Gemini base64: Request timed out.")
        return { "text": "", "is_english": True, "language": "Error: Timeout" }
    except requests.exceptions.RequestException as e:
        logger.error(f"Error transcribing with Gemini base64: Network error - {e}")
        return { "text": "", "is_english": True, "language": f"Error: Network ({type(e).__name__})" }
    except ValueError as e: # Specific catch for API key error
        logger.error(f"Error transcribing with Gemini base64: {e}")
        return { "text": "", "is_english": True, "language": f"Error: {e}" }
    except Exception as e:
        logger.exception(f"Unexpected error transcribing with Gemini base64: {e}") # Log stack trace
        return {
            "text": "",
            "is_english": True,
            "language": f"Error: {type(e).__name__}"
        }

def is_text_english(text):
    """Detect if the text is likely English using simple heuristics"""
    try:
        if not text or not isinstance(text, str):
            return True  # Default to True for empty or non-string input

        # Avoid circular imports - ensure re and string are imported
        import re
        import string

        # Common English words (more comprehensive list could be used)
        common_english_words = {
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
            'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
            'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
            'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
            'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
            'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
            'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give',
            'day', 'most', 'us', 'is', 'are', 'was', 'were'
        }

        # Basic Latin alphabet + digits + space
        basic_latin_chars = string.ascii_lowercase + string.digits + ' '
        text_lower = text.lower()

        # 1. Character Set Analysis
        total_chars = len(text_lower)
        if total_chars == 0:
            return True

        latin_char_count = sum(1 for char in text_lower if char in basic_latin_chars)
        non_latin_ratio = (total_chars - latin_char_count) / total_chars

        # If a significant portion (> 30%) is non-basic-Latin, assume non-English
        if non_latin_ratio > 0.3:
            # logger.debug(f"Non-Latin ratio {non_latin_ratio:.2f} > 0.3 for text: '{text[:50]}...' -> Non-English")
            return False

        # 2. Common Word Analysis (if predominantly Latin chars)
        # Remove punctuation more carefully
        text_cleaned = re.sub(r'[^\w\s]', '', text_lower)
        words = text_cleaned.split()
        total_words = len(words)

        if total_words == 0:
            return True # Treat as English if only punctuation/spaces

        english_word_count = sum(1 for word in words if word in common_english_words)
        english_word_ratio = english_word_count / total_words

        # logger.debug(f"Text: '{text[:50]}...', Non-Latin Ratio: {non_latin_ratio:.2f}, Eng Word Ratio: {english_word_ratio:.2f}")

        # Require at least a few common English words (e.g., 15% ratio)
        # Adjust threshold based on typical text length if needed
        return english_word_ratio >= 0.15

    except Exception as e:
        logger.error(f"Error in is_text_english: {e}", exc_info=True)
        return True  # Default to True on error

# --- F5-TTS Initialization ---

try:
    import torch
    from f5_tts.api import F5TTS

    # Check if CUDA is available
    cuda_available = torch.cuda.is_available()
    logger.info(f"CUDA available: {cuda_available}")

    if cuda_available:
        try:
            # Explicitly set to device 0 if multiple GPUs exist
            if torch.cuda.device_count() > 1:
                torch.cuda.set_device(0)
                logger.info(f"Multiple CUDA devices found ({torch.cuda.device_count()}), using device 0.")
            device = "cuda:0"
            logger.info(f"Attempting to use CUDA device: {torch.cuda.get_device_name(0)}")
            # Small test allocation to confirm CUDA is working
            _ = torch.tensor([1.0, 2.0]).to(device)
            logger.info("CUDA device confirmed working.")
        except Exception as e:
            logger.error(f"CUDA available but failed to initialize/use: {e}. Falling back to CPU.", exc_info=True)
            device = "cpu"
            cuda_available = False # Update flag
    else:
        logger.warning("CUDA not available, using CPU.")
        device = "cpu"

    logger.info(f"F5-TTS will use device: {device}")

    # Initialize registry to ensure default model is registered
    initialize_registry()
    logger.info("Model registry initialized")

    # Set flag to indicate F5-TTS is available
    HAS_F5TTS = True
    INIT_ERROR = None
    logger.info("F5-TTS environment checks completed successfully.")

except ImportError as e:
    logger.warning(f"F5-TTS library or dependencies not found. Narration features will be disabled. Error: {e}")
    HAS_F5TTS = False
    INIT_ERROR = f"F5-TTS or dependency not found: {str(e)}"
    device = None # No device relevant if library missing
except Exception as e:
    logger.error(f"Error during F5-TTS initialization checks: {e}", exc_info=True)
    HAS_F5TTS = False
    INIT_ERROR = f"Error initializing F5-TTS environment: {str(e)}"
    device = None

# --- Flask Routes ---

@narration_bp.route('/status', methods=['GET'])
def get_status():
    """Check if F5-TTS is available and other system status"""
    runtime_device = device
    runtime_cuda_available = False
    gpu_info = {'cuda_available': False}

    if HAS_F5TTS:
        # Perform runtime CUDA check as it might change (e.g., driver issues)
        try:
            import torch
            runtime_cuda_available = torch.cuda.is_available()
            if device == "cuda:0" and not runtime_cuda_available:
                logger.warning("Runtime Check: CUDA was previously detected but is now unavailable!")
                runtime_device = "cuda_error" # Indicate discrepancy
            elif runtime_cuda_available and device != "cuda:0":
                 logger.warning(f"Runtime Check: CUDA is available but service is configured for {device}. Check initialization.")
                 # Don't change runtime_device here, reflect configured state unless error

            if runtime_cuda_available:
                gpu_info['cuda_available'] = True
                current_dev_index = torch.cuda.current_device()
                gpu_info['device_name'] = torch.cuda.get_device_name(current_dev_index)
                gpu_info['device_count'] = torch.cuda.device_count()
                gpu_info['current_device_index'] = current_dev_index
                try:
                    # Report memory for the current device F5TTS is likely using
                    gpu_info['memory_allocated'] = f"{torch.cuda.memory_allocated(current_dev_index) / 1024**2:.2f} MB"
                    gpu_info['memory_reserved'] = f"{torch.cuda.memory_reserved(current_dev_index) / 1024**2:.2f} MB"
                    total_memory = torch.cuda.get_device_properties(current_dev_index).total_memory
                    gpu_info['total_memory'] = f"{total_memory / 1024**2:.2f} MB"
                except Exception as mem_e:
                    logger.warning(f"Could not get detailed CUDA memory info: {mem_e}")
                    gpu_info['memory_info'] = "Error retrieving memory details"

        except Exception as e:
            logger.error(f"Error during runtime status check for CUDA: {e}")
            gpu_info['error'] = f"Runtime check error: {str(e)}"
            if device == "cuda:0": # If we expected CUDA but check failed
                runtime_device = "cuda_error"

    # Get model info from modelManager
    model_info = get_models()

    return jsonify({
        'available': HAS_F5TTS,
        'device': runtime_device, # Reflects intended device or error state
        'runtime_cuda_available': runtime_cuda_available, # Actual current state
        'initialization_error': INIT_ERROR, # Error during startup
        'gpu_info': gpu_info,
        'models': model_info,
        'reference_audio_dir': REFERENCE_AUDIO_DIR,
        'output_audio_dir': OUTPUT_AUDIO_DIR,
        'gemini_api_key_found': bool(get_gemini_api_key()), # Check if key is discoverable
    })

@narration_bp.route('/models', methods=['GET'])
def list_models():
    """Get list of available models"""
    include_cache = request.args.get('include_cache', 'false').lower() == 'true'
    models = get_models(include_cache)
    return jsonify(models)

@narration_bp.route('/models/active', methods=['GET'])
def get_current_model():
    """Get the currently active model"""
    active_model_id = get_active_model()
    return jsonify({'active_model': active_model_id})

@narration_bp.route('/models/active', methods=['POST'])
def set_current_model():
    """Set the active model"""
    data = request.json
    model_id = data.get('model_id')

    if not model_id:
        return jsonify({'error': 'No model_id provided'}), 400

    success, message = set_active_model(model_id)

    if success:
        logger.info(f"Active model set to '{model_id}' (will be loaded on-demand)")
        return jsonify({'success': True, 'message': f'Active model set to {model_id}'})
    else:
        logger.error(f"Failed to set active model to '{model_id}': {message}")
        return jsonify({'error': message}), 400

@narration_bp.route('/models', methods=['POST'])
def add_new_model():
    """Add a new model from Hugging Face or URL"""
    data = request.json
    if not data:
        return jsonify({'error': 'No JSON data received'}), 400

    source_type = data.get('source_type', 'huggingface').lower()
    model_id_req = data.get('model_id') # User-provided preferred ID
    config = data.get('config', {})
    language_codes = data.get('languageCodes', [])

    logger.info(f"Request to add model: type={source_type}, id={model_id_req}, languages={language_codes}, config={config}")

    try:
        if source_type == 'huggingface':
            model_url = data.get('model_url') # Can be hf:// protocol or just repo_id/path
            vocab_url = data.get('vocab_url') # Optional

            if not model_url:
                return jsonify({'error': 'Missing Hugging Face model_url'}), 400

            # Use parse_hf_url for robustness
            repo_id, model_path = parse_hf_url(model_url)
            vocab_repo_id, vocab_path = parse_hf_url(vocab_url) if vocab_url else (None, None)

            if not repo_id or not model_path:
                 # Fallback: maybe model_url is just repo_id? Assume standard filenames? Less robust.
                 logger.warning(f"Could not parse '{model_url}' as standard hf:// or path. Trying as repo_id.")
                 # This part needs clarification based on expected F5-TTS model structure on HF
                 # For now, enforce parsing success.
                 return jsonify({'error': 'Invalid Hugging Face URL format for model_url'}), 400

            # Ensure vocab comes from the same repo if specified without one
            if vocab_path and not vocab_repo_id:
                vocab_repo_id = repo_id

            logger.info(f"Parsed HF info: Repo={repo_id}, ModelPath={model_path}, VocabPath={vocab_path}")

            success, message, downloaded_model_id = download_model_from_hf(
                repo_id=repo_id,
                model_path=model_path,
                vocab_path=vocab_path, # Pass None if not provided
                config=config,
                model_id=model_id_req,
                language_codes=language_codes
            )

        elif source_type == 'url':
            model_url = data.get('model_url')
            vocab_url = data.get('vocab_url') # Optional

            if not model_url:
                return jsonify({'error': 'Missing model_url for direct download'}), 400

            success, message, downloaded_model_id = download_model_from_url(
                model_url=model_url,
                vocab_url=vocab_url, # Pass None if not provided
                config=config,
                preferred_model_id=model_id_req,
                language_codes=language_codes
            )
        else:
            return jsonify({'error': f'Invalid source_type: {source_type}. Must be "huggingface" or "url".'}), 400

        if success:
            logger.info(f"Successfully added model '{downloaded_model_id}': {message}")
            return jsonify({
                'success': True,
                'message': message,
                'model_id': downloaded_model_id
            }), 201 # 201 Created status
        else:
            # Handle specific HF private repo error if applicable
            if source_type == 'huggingface' and "401" in message or "private" in message.lower():
                 logger.warning(f"Failed to download from Hugging Face (potentially private repo {repo_id}): {message}")
                 return jsonify({
                     'error': message,
                     'private_repo': True,
                     'repo_id': repo_id
                 }), 401 # Unauthorized
            else:
                logger.error(f"Failed to add model: {message}")
                return jsonify({'error': message}), 400

    except Exception as e:
        logger.exception(f"Unexpected error in add_new_model: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@narration_bp.route('/models/download-status/<path:model_id>', methods=['GET'])
def get_model_download_status(model_id):
    """Get the download status of a model (handles potential slashes in ID)"""
    # Decode model_id in case it contains URL-encoded characters like slashes
    from urllib.parse import unquote
    decoded_model_id = unquote(model_id)
    logger.debug(f"Checking download status for model_id: '{decoded_model_id}' (raw: '{model_id}')")
    status = get_download_status(decoded_model_id)

    if status:
        # Return a consistent structure, including progress if available
        response = {
            'model_id': decoded_model_id,
            'status': status.get('status'),
            'progress': status.get('progress', None), # Percentage
            'downloaded_size': status.get('downloaded_size', None), # Bytes
            'total_size': status.get('total_size', None), # Bytes
            'error': status.get('error', None),
            'timestamp': status.get('timestamp')
        }
        return jsonify(response)
    else:
        # Check if the model exists at all (even if not downloading)
        all_models = get_models(include_cache=True)
        model_exists = any(m['id'] == decoded_model_id for m in all_models.get('models', [])) or \
                       any(m['id'] == decoded_model_id for m in all_models.get('cached_models', []))

        if model_exists:
             # Model exists but no active download status found
             return jsonify({
                 'model_id': decoded_model_id,
                 'status': 'not_downloading' # Indicate it's not actively downloading
             }), 200
        else:
             # Model ID not found anywhere
             return jsonify({
                 'model_id': decoded_model_id,
                 'status': None,
                 'error': 'Model ID not found'
             }), 404


@narration_bp.route('/models/<path:model_id>', methods=['DELETE'])
def remove_model(model_id):
    """Delete a model (handles potential slashes in ID)"""
    from urllib.parse import unquote
    decoded_model_id = unquote(model_id)
    delete_cache = request.args.get('delete_cache', 'false').lower() == 'true'
    logger.info(f"Request to delete model: '{decoded_model_id}', delete_cache={delete_cache}")

    success, message = delete_model(decoded_model_id, delete_cache)

    if success:
        logger.info(f"Successfully deleted model '{decoded_model_id}': {message}")
        return jsonify({'success': True, 'message': message})
    else:
        logger.error(f"Failed to delete model '{decoded_model_id}': {message}")
        # Distinguish between 'not found' and other errors if possible
        if "not found" in message.lower():
            return jsonify({'error': message}), 404
        else:
            return jsonify({'error': message}), 400

@narration_bp.route('/models/<path:model_id>', methods=['PUT'])
def update_model(model_id):
    """Update model information (e.g., name, config)"""
    from urllib.parse import unquote
    decoded_model_id = unquote(model_id)
    data = request.json

    if not data:
        return jsonify({'error': 'No update data provided'}), 400

    logger.info(f"Request to update model '{decoded_model_id}' with data: {data}")
    success, message = update_model_info(decoded_model_id, data)

    if success:
        logger.info(f"Successfully updated model '{decoded_model_id}': {message}")
        return jsonify({'success': True, 'message': message})
    else:
        logger.error(f"Failed to update model '{decoded_model_id}': {message}")
        if "not found" in message.lower():
            return jsonify({'error': message}), 404
        else:
            return jsonify({'error': message}), 400

@narration_bp.route('/models/<path:model_id>/storage', methods=['GET'])
def get_model_storage_info(model_id):
    """Get information about how a model is stored (symlink or copy)"""
    from urllib.parse import unquote
    decoded_model_id = unquote(model_id)
    logger.debug(f"Request for storage info for model: '{decoded_model_id}'")

    try:
        is_symlink, original_model_file, original_vocab_file = is_model_using_symlinks(decoded_model_id)
        return jsonify({
            'model_id': decoded_model_id,
            'is_symlink': is_symlink,
            'original_model_file': original_model_file,
            'original_vocab_file': original_vocab_file
        })
    except FileNotFoundError:
         logger.warning(f"Storage info requested for non-existent model: '{decoded_model_id}'")
         return jsonify({'error': 'Model not found'}), 404
    except Exception as e:
        logger.exception(f"Error getting storage info for model '{decoded_model_id}': {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@narration_bp.route('/models/cancel-download/<path:model_id>', methods=['POST'])
def cancel_model_download(model_id):
    """Cancel an ongoing model download"""
    from urllib.parse import unquote
    decoded_model_id = unquote(model_id)
    logger.info(f"Received request to cancel download for model: {decoded_model_id}")

    success = cancel_download(decoded_model_id)

    if success:
        logger.info(f"Successfully initiated download cancellation for model '{decoded_model_id}'")
        return jsonify({
            'success': True,
            'message': f'Download cancellation requested for model {decoded_model_id}'
        })
    else:
        logger.warning(f"Could not cancel download for model '{decoded_model_id}': No active download found.")
        # 404 is appropriate as the specific resource (the download task) wasn't found
        return jsonify({
            'error': f'No active download found for model {decoded_model_id}'
        }), 404

@narration_bp.route('/process-base64-reference', methods=['POST'])
def process_base64_audio_reference():
    """Process base64 encoded audio data as reference"""
    try:
        # Use force=True cautiously, but good for flexibility if client Content-Type is wrong
        data = request.get_json(force=True, silent=True)

        if not data:
            # Try getting raw data if JSON parsing failed but content looks like JSON
            raw_data = request.get_data(as_text=True)
            logger.warning(f"Request content-type was {request.content_type}, but failed to parse as JSON. Raw data starts with: {raw_data[:100]}...")
            return jsonify({'error': 'Invalid JSON data received'}), 400

        # Log keys safely
        logger.info(f"Received base64 reference request with keys: {list(data.keys()) if isinstance(data, dict) else 'Invalid data format'}")

        audio_data_base64 = data.get('audio_data') if isinstance(data, dict) else None
        reference_text = data.get('reference_text', '') if isinstance(data, dict) else ''
        should_transcribe = str(data.get('transcribe', 'false')).lower() == 'true' if isinstance(data, dict) else False

        logger.info(f"Base64 Ref: Transcribe={should_transcribe}, Provided Text='{reference_text[:50]}...'")

        if not audio_data_base64 or not isinstance(audio_data_base64, str):
            logger.error("No 'audio_data' string found in request JSON.")
            return jsonify({'error': 'Missing or invalid audio_data (must be a base64 string)'}), 400

        # Basic base64 format check (padding and characters)
        import re
        if not re.match(r'^[A-Za-z0-9+/]*={0,2}$', audio_data_base64.strip()):
             logger.error("Audio data does not appear to be valid base64.")
             sample = audio_data_base64[:100] + ('...' if len(audio_data_base64) > 100 else '')
             logger.error(f"Invalid base64 sample: {sample}")
             return jsonify({'error': 'Invalid base64 format in audio_data'}), 400

        # Generate a unique filename
        unique_id = str(uuid.uuid4())
        # Assume WAV format based on typical web audio recording
        filename = f"recorded_b64_{unique_id}.wav"
        filepath = os.path.join(REFERENCE_AUDIO_DIR, filename)

        # Decode and save the audio data
        try:
            audio_bytes = base64.b64decode(audio_data_base64)
            logger.info(f"Successfully decoded base64 data, size: {len(audio_bytes)} bytes")
            with open(filepath, 'wb') as f:
                f.write(audio_bytes)
            logger.info(f"Saved base64 audio to {filepath}")
        except base64.binascii.Error as decode_error:
            logger.error(f"Error decoding base64 data: {decode_error}")
            sample = audio_data_base64[:100] + '...' if len(audio_data_base64) > 100 else audio_data_base64
            logger.error(f"Base64 data sample: {sample}")
            return jsonify({'error': f'Invalid base64 data: {str(decode_error)}'}), 400
        except IOError as e:
             logger.error(f"Error saving decoded audio to file {filepath}: {e}", exc_info=True)
             return jsonify({'error': f'Error saving audio file: {str(e)}'}), 500
        except Exception as e:
            logger.exception(f"Unexpected error saving base64 audio: {e}")
            return jsonify({'error': f'Internal server error saving audio: {str(e)}'}), 500

        # Verify file was saved (redundant check, but useful for debugging)
        if not os.path.exists(filepath):
            logger.error(f"File saving failed unexpectedly for {filepath}")
            return jsonify({'error': 'Failed to save audio file after decoding'}), 500

        # --- Transcription Logic ---
        final_reference_text = reference_text
        is_english = True # Default assumption
        language = "Unknown" # Default

        # Transcribe if requested OR if no reference text was provided
        if should_transcribe or not final_reference_text:
            logger.info("Transcription needed (requested or text empty). Attempting with Gemini...")
            # Use the already decoded base64 data for speed
            transcription_result = transcribe_with_gemini_base64(audio_data_base64)

            final_reference_text = transcription_result.get("text", "")
            is_english = transcription_result.get("is_english", True)
            language = transcription_result.get("language", "Error during transcription") # Provide feedback

            if not final_reference_text and "Error" not in language:
                 logger.warning("Gemini transcription returned empty text.")
                 language = "Unknown (Empty Transcription)"
            elif "Error" in language:
                 logger.error(f"Gemini transcription failed: {language}")
                 # Keep provided text if any, otherwise it remains empty
                 final_reference_text = reference_text
            else:
                 logger.info(f"Gemini transcription successful: Lang={language}, Text='{final_reference_text[:50]}...'")

        else:
            logger.info("Using provided reference text, skipping transcription.")
            # Estimate language from provided text
            is_english = is_text_english(final_reference_text)
            language = "English" if is_english else "Non-English"
            logger.info(f"Language estimated from provided text: {language}")


        response_data = {
            'success': True,
            'filepath': filepath,
            'filename': filename,
            'reference_text': final_reference_text,
            'is_english': is_english,
            'language': language
        }
        logger.info(f"Returning success response for base64 reference: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        logger.exception(f"Error in process_base64_audio_reference: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@narration_bp.route('/upload-reference', methods=['POST'])
def upload_reference_audio():
    """Upload reference audio file and optionally transcribe"""
    try:
        if 'file' not in request.files:
            logger.error("Upload request missing 'file' part.")
            return jsonify({'error': 'No file part in the request'}), 400

        file = request.files['file']
        if not file or file.filename == '':
            logger.error("Upload request received with no selected file.")
            return jsonify({'error': 'No selected file'}), 400

        # Sanitize filename and make unique
        original_filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        base, ext = os.path.splitext(original_filename)
        # Ensure extension is reasonable, default to .wav if missing/odd
        ext = ext if ext else '.wav'
        unique_filename = f"{base}_{unique_id}{ext}"
        filepath = os.path.join(REFERENCE_AUDIO_DIR, unique_filename)

        logger.info(f"Saving uploaded file '{original_filename}' as '{unique_filename}'")
        file.save(filepath)
        logger.info(f"File saved successfully to {filepath}")

        # Get reference text from form data
        reference_text = request.form.get('reference_text', '')
        # Allow explicit 'transcribe' flag from form data as well
        should_transcribe_form = request.form.get('transcribe', 'false').lower() == 'true'
        logger.info(f"Upload Ref: Provided Text='{reference_text[:50]}...', Transcribe Flag={should_transcribe_form}")

        # --- Transcription Logic ---
        final_reference_text = reference_text
        is_english = True
        language = "Unknown"

        # Transcribe if flag set OR if no text provided
        if should_transcribe_form or not final_reference_text:
            logger.info("Transcription needed for uploaded file. Attempting with Gemini...")
            # Transcribe using the saved file path
            transcription_result = transcribe_with_gemini(filepath)

            final_reference_text = transcription_result.get("text", "")
            is_english = transcription_result.get("is_english", True)
            language = transcription_result.get("language", "Error during transcription")

            if not final_reference_text and "Error" not in language:
                 logger.warning("Gemini transcription returned empty text for uploaded file.")
                 language = "Unknown (Empty Transcription)"
            elif "Error" in language:
                 logger.error(f"Gemini transcription failed for uploaded file: {language}")
                 final_reference_text = reference_text # Fallback to provided text if any
            else:
                 logger.info(f"Gemini transcription successful for uploaded file: Lang={language}, Text='{final_reference_text[:50]}...'")
        else:
            logger.info("Using provided reference text for uploaded file, skipping transcription.")
            is_english = is_text_english(final_reference_text)
            language = "English" if is_english else "Non-English"
            logger.info(f"Language estimated from provided text: {language}")

        return jsonify({
            'success': True,
            'filepath': filepath,
            'filename': unique_filename,
            'reference_text': final_reference_text,
            'is_english': is_english,
            'language': language
        })

    except Exception as e:
        logger.exception(f"Error handling uploaded reference file: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# This route seems redundant if /process-base64-reference handles JSON correctly.
# Kept for backward compatibility or specific form-data scenarios.
@narration_bp.route('/record-reference', methods=['POST'])
def record_reference_audio():
    """Handle reference audio potentially sent as form data (e.g., from recorder.js)"""
    logger.info("Received request at /record-reference endpoint.")

    # Check if content type suggests base64 JSON first
    content_type = request.headers.get('Content-Type', '').lower()
    if 'application/json' in content_type:
        logger.info("/record-reference received JSON content type, attempting to process as base64...")
        # Use the dedicated base64 handler
        return process_base64_audio_reference()

    # Fallback: Handle as form data file upload ('audio_data' field expected)
    logger.info("/record-reference assuming form-data audio file upload.")
    try:
        if 'audio_data' not in request.files:
            # Check form fields as fallback if file isn't present
            if 'audio_data' in request.form:
                 logger.warning("/record-reference: 'audio_data' found in form fields, not files. Might be base64 string?")
                 # Attempt to handle as if it were base64 JSON payload
                 try:
                     mock_json_payload = {
                         'audio_data': request.form['audio_data'],
                         'reference_text': request.form.get('reference_text', ''),
                         'transcribe': request.form.get('transcribe', 'false')
                     }
                     # Temporarily replace request data for the handler function
                     # This is a bit hacky; ideally client sends consistent format.
                     original_json = request.json
                     request.json_data_override = mock_json_payload # Custom attribute to pass data
                     response = process_base64_audio_reference_from_override()
                     request.json_data_override = None # Clean up
                     return response
                 except Exception as form_b64_err:
                     logger.error(f"Failed to process 'audio_data' from form field as base64: {form_b64_err}")
                     return jsonify({'error': 'Received audio_data in form, but failed to process as base64'}), 400

            logger.error("/record-reference: No 'audio_data' found in request files.")
            return jsonify({'error': 'Missing audio_data file part'}), 400

        audio_file = request.files['audio_data']
        logger.info(f"Received audio file via form data: {audio_file.filename}, size: {audio_file.content_length}")

        # Generate unique filename, save, and transcribe (similar to /upload-reference)
        unique_id = str(uuid.uuid4())
        # Assume WAV format for recordings
        filename = f"recorded_form_{unique_id}.wav"
        filepath = os.path.join(REFERENCE_AUDIO_DIR, filename)

        logger.info(f"Saving recorded form data file as '{filename}'")
        audio_file.save(filepath)
        logger.info(f"File saved successfully to {filepath}")

        reference_text = request.form.get('reference_text', '')
        should_transcribe = request.form.get('transcribe', 'false').lower() == 'true'
        logger.info(f"Record Ref (form): Provided Text='{reference_text[:50]}...', Transcribe Flag={should_transcribe}")

        # --- Transcription Logic ---
        final_reference_text = reference_text
        is_english = True
        language = "Unknown"

        if should_transcribe or not final_reference_text:
            logger.info("Transcription needed for recorded form data. Attempting with Gemini...")
            transcription_result = transcribe_with_gemini(filepath)
            final_reference_text = transcription_result.get("text", "")
            is_english = transcription_result.get("is_english", True)
            language = transcription_result.get("language", "Error during transcription")
            # Logging handled within transcribe function
        else:
            logger.info("Using provided text for recorded form data, skipping transcription.")
            is_english = is_text_english(final_reference_text)
            language = "English" if is_english else "Non-English"
            logger.info(f"Language estimated from provided text: {language}")

        return jsonify({
            'success': True,
            'filepath': filepath,
            'filename': filename,
            'reference_text': final_reference_text,
            'is_english': is_english,
            'language': language
        })

    except Exception as e:
        logger.exception(f"Error in /record-reference (form data handling): {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# Helper to allow record_reference to call the base64 logic with mocked data
def process_base64_audio_reference_from_override():
     # This function assumes request.json_data_override is set
     if not hasattr(request, 'json_data_override') or not request.json_data_override:
         logger.error("process_base64_audio_reference_from_override called without override data")
         return jsonify({'error': 'Internal server error: missing override data'}), 500
     data = request.json_data_override
     # Now reuse the logic, but source data from the override dict
     # This duplicates the core logic of process_base64_audio_reference.
     # Consider refactoring process_base64_audio_reference to accept a dict?
     # For now, keep it simple:
     audio_data_base64 = data.get('audio_data')
     reference_text = data.get('reference_text', '')
     should_transcribe = str(data.get('transcribe', 'false')).lower() == 'true'

     # (Paste the core decoding, saving, and transcription logic from process_base64_audio_reference here)
     # ... [omitted for brevity - this needs careful copy/paste or refactoring] ...
     # This approach is fragile. Better to refactor the core logic into a helper function.

     # --- Simplified Placeholder - Requires full logic implementation ---
     logger.warning("Executing simplified logic in process_base64_audio_reference_from_override. Needs full implementation.")
     if not audio_data_base64: return jsonify({'error': 'Missing audio_data in override'}), 400
     try:
        # (Placeholder for Decode, Save, Transcribe logic)
        unique_id = str(uuid.uuid4())
        filename = f"recorded_override_{unique_id}.wav"
        filepath = os.path.join(REFERENCE_AUDIO_DIR, filename)
        audio_bytes = base64.b64decode(audio_data_base64)
        with open(filepath, 'wb') as f: f.write(audio_bytes)
        logger.info(f"Saved override audio to {filepath}")
        # (Placeholder for Transcription logic)
        final_reference_text = reference_text or "Transcription Placeholder"
        is_english = True
        language = "Unknown (Placeholder)"

        response_data = {
            'success': True, 'filepath': filepath, 'filename': filename,
            'reference_text': final_reference_text, 'is_english': is_english, 'language': language
        }
        return jsonify(response_data)
     except Exception as e:
         logger.error(f"Error processing override data: {e}")
         return jsonify({'error': f'Error processing override data: {str(e)}'}), 500
     # --- End Placeholder ---


@narration_bp.route('/extract-segment', methods=['POST'])
def extract_audio_segment():
    """Extract audio segment from video using ffmpeg"""
    try:
        data = request.json
        video_path = data.get('video_path')
        start_time_raw = data.get('start_time') # Can be seconds or HH:MM:SS.ms
        end_time_raw = data.get('end_time')     # Can be seconds or HH:MM:SS.ms
        should_transcribe = data.get('transcribe', True)

        logger.info(f"Extract segment request: video={video_path}, start={start_time_raw}, end={end_time_raw}, transcribe={should_transcribe}")

        if not video_path or start_time_raw is None or end_time_raw is None:
            return jsonify({'error': 'Missing required parameters (video_path, start_time, end_time)'}), 400

        # Ensure video path exists
        if not os.path.exists(video_path):
             logger.error(f"Video file not found for extraction: {video_path}")
             return jsonify({'error': f'Video file not found: {video_path}'}), 404

        # Convert times to seconds if needed (handle HH:MM:SS.ms format)
        def parse_time(time_raw):
            if isinstance(time_raw, (int, float)):
                return float(time_raw)
            if isinstance(time_raw, str):
                try:
                    parts = time_raw.split(':')
                    if len(parts) == 3:
                        h, m, s_ms = parts
                        s = float(s_ms) # Handles seconds with milliseconds
                        return int(h) * 3600 + int(m) * 60 + s
                    elif len(parts) == 2: # MM:SS.ms
                        m, s_ms = parts
                        s = float(s_ms)
                        return int(m) * 60 + s
                    else: # Assume seconds
                        return float(time_raw)
                except ValueError:
                     raise ValueError(f"Invalid time format: {time_raw}")
            raise ValueError(f"Unsupported time type: {type(time_raw)}")

        try:
            start_time = parse_time(start_time_raw)
            end_time = parse_time(end_time_raw)
        except ValueError as e:
            logger.error(f"Error parsing time values: {e}")
            return jsonify({'error': str(e)}), 400

        if start_time < 0 or end_time <= start_time:
             return jsonify({'error': 'Invalid time range (start must be non-negative, end must be after start)'}), 400

        duration = end_time - start_time

        # Generate unique output path
        unique_id = str(uuid.uuid4())
        output_filename = f"segment_{unique_id}.wav"
        output_path = os.path.join(REFERENCE_AUDIO_DIR, output_filename)

        # Construct ffmpeg command
        # -vn: no video
        # -acodec pcm_s16le: Standard WAV format
        # -ar 44100: Sample rate (adjust if F5TTS prefers different)
        # -ac 1: Mono channel (adjust if needed)
        # -ss before -i for faster seeking on keyframes (usually good)
        # -t for duration
        cmd = [
            'ffmpeg', '-y', # Overwrite output without asking
            '-ss', str(start_time), # Seek to start time
            '-i', video_path,
            '-t', str(duration), # Specify duration
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '44100', # Consider making this configurable or detecting source rate
            '-ac', '1',
            output_path
        ]
        logger.info(f"Running ffmpeg command: {' '.join(cmd)}")

        # Execute ffmpeg
        import subprocess
        try:
            # Use capture_output=True to get stderr for debugging if needed
            result = subprocess.run(cmd, check=True, capture_output=True, text=True, encoding='utf-8')
            logger.info("ffmpeg completed successfully.")
            logger.debug(f"ffmpeg stdout:\n{result.stdout}")
            logger.debug(f"ffmpeg stderr:\n{result.stderr}")
        except FileNotFoundError:
             logger.error("ffmpeg command not found. Ensure ffmpeg is installed and in the system PATH.")
             return jsonify({'error': 'ffmpeg not found. Please install ffmpeg.'}), 500
        except subprocess.CalledProcessError as e:
            logger.error(f"ffmpeg command failed with exit code {e.returncode}")
            logger.error(f"ffmpeg stderr:\n{e.stderr}")
            # Try to delete potentially incomplete output file
            if os.path.exists(output_path): os.remove(output_path)
            return jsonify({'error': f'ffmpeg failed: {e.stderr[:200]}...'}), 500

        # --- Transcription Logic ---
        reference_text = ""
        is_english = True
        language = "Unknown"

        if should_transcribe:
            logger.info("Transcription requested for extracted segment. Attempting with Gemini...")
            transcription_result = transcribe_with_gemini(output_path)
            reference_text = transcription_result.get("text", "")
            is_english = transcription_result.get("is_english", True)
            language = transcription_result.get("language", "Error during transcription")
            # Logging handled within transcribe function
        else:
            logger.info("Transcription not requested for extracted segment.")
            # Cannot determine language without transcription

        return jsonify({
            'success': True,
            'filepath': output_path,
            'filename': output_filename,
            'reference_text': reference_text,
            'is_english': is_english,
            'language': language
        })

    except Exception as e:
        logger.exception(f"Error extracting audio segment: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# --- Narration Generation ---

# Global variable to hold the loaded model instance (if caching is desired)
# However, the current logic re-loads per request for isolation.
# Consider a caching mechanism if model loading time is significant and state isn't an issue.
# loaded_tts_model_cache = {}

def load_tts_model(model_id=None):
    """Loads or retrieves the specified F5-TTS model."""
    # This function encapsulates model loading logic.
    # Currently called within the /generate route per request.
    if not HAS_F5TTS:
        raise RuntimeError("F5-TTS is not available.")

    try:
        import torch
        from f5_tts.api import F5TTS

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
        logger.exception(f"Error loading F5-TTS model (ID: {target_model_id}): {e}")
        # Re-raise a more specific error or handle appropriately
        raise RuntimeError(f"Failed to load TTS model '{target_model_id}': {str(e)}") from e


@narration_bp.route('/generate', methods=['POST', 'HEAD'])
def generate_narration():
    """Generate narration for subtitles using F5-TTS (Streaming Response)"""
    if not HAS_F5TTS:
        logger.error("Generate request received but F5-TTS is not available.")
        return jsonify({'error': 'F5-TTS service is not available'}), 503

    # Handle HEAD request for capability check (e.g., by streaming clients)
    if request.method == 'HEAD':
        logger.debug("Received HEAD request for /generate")
        response = Response()
        # Indicate streaming capability
        response.headers['Content-Type'] = 'text/event-stream'
        response.headers['Cache-Control'] = 'no-cache'
        return response

    # --- Process POST Request ---
    try:
        data = request.json
        if not data:
             return jsonify({'error': 'No JSON data received'}), 400

        reference_audio = data.get('reference_audio')
        reference_text = data.get('reference_text', '')
        subtitles = data.get('subtitles', [])
        settings = data.get('settings', {})
        requested_model_id = settings.get('modelId') # User can override active model

        logger.info(f"Generate request: RefAudio={reference_audio}, #Subtitles={len(subtitles)}, Model={requested_model_id or 'active/default'}")
        logger.debug(f"Reference Text: '{reference_text[:100]}...'")
        logger.debug(f"Settings: {settings}")

        if not reference_audio or not subtitles:
            return jsonify({'error': 'Missing required parameters (reference_audio, subtitles)'}), 400

        # Verify reference audio file exists *before* loading model
        if not os.path.exists(reference_audio):
            logger.error(f"Reference audio file does not exist: {reference_audio}")
            return jsonify({'error': f'Reference audio file not found: {reference_audio}'}), 404

        # --- Load Model ---
        # Load model instance specifically for this request to ensure isolation
        try:
            tts_model_instance, loaded_model_id = load_tts_model(requested_model_id)
            logger.info(f"Using TTS model '{loaded_model_id}' for this generation request.")
        except Exception as model_load_error:
             logger.error(f"Failed to load TTS model for generation: {model_load_error}", exc_info=True)
             # Return error before starting stream
             return jsonify({'error': f'Failed to load TTS model: {model_load_error}'}), 500

        # --- Prepare Settings ---
        remove_silence = settings.get('removeSilence', True)
        speed = float(settings.get('speechRate', 1.0))
        # Batch size isn't directly used by F5TTS.infer for single text, remove unless needed
        # batch_size = settings.get('batchSize', 10) # This seems unused for item-by-item generation
        nfe_step = int(settings.get('nfeStep', 32)) # Default from F5TTS if not specified
        sway_coef = float(settings.get('swayCoef', -1.0)) # Default from F5TTS
        cfg_strength = float(settings.get('cfgStrength', 2.0)) # Default from F5TTS
        seed_val = settings.get('seed') # Can be None, int, or string convertible to int
        seed = int(seed_val) if seed_val is not None and str(seed_val).isdigit() else None

        logger.info(f"Effective Generation Settings: model={loaded_model_id}, remove_silence={remove_silence}, speed={speed}, nfe_step={nfe_step}, sway_coef={sway_coef}, cfg_strength={cfg_strength}, seed={seed}")

        # --- Define Streaming Generator ---
        def generate_narration_stream():
            # Make the model instance accessible in this scope
            nonlocal tts_model_instance, loaded_model_id

            results = []
            total_subtitles = len(subtitles)
            processed_count = 0
            start_time_generation = time.time()

            # Language mismatch check (simple version)
            ref_lang_is_english = is_text_english(reference_text)
            logger.info(f"Reference text language heuristics: {'English' if ref_lang_is_english else 'Non-English'}")
            mismatch_warning_sent = False

            try:
                for i, subtitle in enumerate(subtitles):
                    subtitle_id = subtitle.get('id', f"index_{i}") # Use index if ID missing
                    text = subtitle.get('text', '').strip()
                    processed_count += 1

                    # --- Send Progress Update ---
                    progress_data = {
                        'type': 'progress',
                        'message': f'Processing subtitle {processed_count}/{total_subtitles} (ID: {subtitle_id})',
                        'current': processed_count,
                        'total': total_subtitles
                    }
                    yield f"data: {json.dumps(progress_data)}\n\n"

                    if not text:
                        logger.info(f"Skipping empty subtitle (ID: {subtitle_id})")
                        result = {'subtitle_id': subtitle_id, 'text': '', 'success': True, 'skipped': True}
                        results.append(result)
                        # Send skip result immediately
                        skip_data = {'type': 'result', 'result': result, 'progress': processed_count, 'total': total_subtitles}
                        yield f"data: {json.dumps(skip_data)}\n\n"
                        continue

                    # --- Language Mismatch Check ---
                    if not mismatch_warning_sent:
                         target_lang_is_english = is_text_english(text)
                         if ref_lang_is_english != target_lang_is_english:
                             logger.warning(f"Potential language mismatch! Reference is {'English' if ref_lang_is_english else 'Non-English'}, "
                                            f"first target subtitle (ID: {subtitle_id}) seems {'English' if target_lang_is_english else 'Non-English'}. "
                                            f"Model '{loaded_model_id}' might not support this cross-lingual generation.")
                             mismatch_warning_sent = True # Send warning only once

                    # --- Prepare for Generation ---
                    unique_id = str(uuid.uuid4())
                    output_filename = f"narration_{subtitle_id}_{unique_id}.wav"
                    output_path = os.path.join(OUTPUT_AUDIO_DIR, output_filename)

                    # Clean text: Remove control characters, ensure UTF-8
                    import re
                    cleaned_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
                    # Ensure string type and UTF-8 encoding (though F5TTS might handle bytes too)
                    # cleaned_text = cleaned_text.encode('utf-8').decode('utf-8')
                    # Ensure reference text is also clean string
                    cleaned_ref_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', reference_text or "")
                    # cleaned_ref_text = cleaned_ref_text.encode('utf-8').decode('utf-8')

                    # Log parameters clearly before calling infer
                    log_params = {
                        'ref_file': reference_audio, 'ref_text': cleaned_ref_text, 'gen_text': cleaned_text,
                        'file_wave': output_path, 'remove_silence': remove_silence, 'speed': speed,
                        'nfe_step': nfe_step, 'sway_sampling_coef': sway_coef, 'cfg_strength': cfg_strength, 'seed': seed
                    }
                    logger.info(f"Calling model.infer for subtitle ID {subtitle_id} with text: '{cleaned_text[:100]}...'")
                    logger.debug(f"Infer params: { {k: v for k, v in log_params.items() if k not in ['ref_text', 'gen_text']} }") # Avoid logging long texts at debug


                    # --- Perform Inference ---
                    try:
                        # Use the loaded model instance
                        # Ensure device context if needed (though F5TTS internal handling might suffice)
                        import torch
                        context_manager = torch.cuda.device(device) if device.startswith("cuda") and torch.cuda.is_available() else torch.device(device)
                        with context_manager:
                             tts_model_instance.infer(**log_params)

                        logger.info(f"Successfully generated narration for subtitle ID {subtitle_id}")
                        result = {
                            'subtitle_id': subtitle_id,
                            'text': cleaned_text, # Return the cleaned text used for generation
                            'audio_path': output_path,
                            'filename': output_filename,
                            'success': True
                        }
                        results.append(result)

                        # Send success result
                        result_data = {'type': 'result', 'result': result, 'progress': processed_count, 'total': total_subtitles}
                        yield f"data: {json.dumps(result_data)}\n\n"

                    except Exception as infer_error:
                        # Log the specific error and the text that caused it
                        logger.error(f"Error generating narration for subtitle ID {subtitle_id} with text '{cleaned_text[:100]}...': {infer_error}", exc_info=True) # Log stack trace
                        error_message = f"{type(infer_error).__name__}: {str(infer_error)}"
                        result = {
                            'subtitle_id': subtitle_id,
                            'text': cleaned_text,
                            'error': error_message,
                            'success': False
                        }
                        results.append(result)

                        # Send error result
                        error_data = {'type': 'error', 'result': result, 'progress': processed_count, 'total': total_subtitles}
                        # Use ensure_ascii=False for better Unicode in JSON, but handle errors
                        try:
                            json_payload = json.dumps(error_data, ensure_ascii=False)
                        except UnicodeEncodeError:
                            logger.warning("Falling back to ASCII JSON encoding due to Unicode error.")
                            json_payload = json.dumps(error_data, ensure_ascii=True)
                        yield f"data: {json_payload}\n\n"

                    finally:
                         # --- Memory Management ---
                         # Try to free memory after each item, especially important for GPU
                         try:
                             import torch
                             import gc
                             gc.collect() # Force Python garbage collection
                             if device.startswith("cuda") and torch.cuda.is_available():
                                 torch.cuda.empty_cache()
                                 # logger.debug(f"CUDA cache cleared after subtitle ID {subtitle_id}")
                         except Exception as mem_error:
                              logger.warning(f"Error during memory cleanup after subtitle ID {subtitle_id}: {mem_error}")

            except Exception as stream_err:
                 # Catch errors within the generator loop itself
                 logger.error(f"Error during narration stream generation: {stream_err}", exc_info=True)
                 error_data = {'type': 'fatal_error', 'error': f'Stream generation failed: {str(stream_err)}'}
                 yield f"data: {json.dumps(error_data)}\n\n"

            finally:
                # --- Signal Completion ---
                total_time = time.time() - start_time_generation
                logger.info(f"Narration generation stream completed in {total_time:.2f} seconds. Results: {len(results)} processed.")
                complete_data = {'type': 'complete', 'results': results, 'total': len(results), 'duration_seconds': total_time}
                try:
                    json_payload = json.dumps(complete_data, ensure_ascii=False)
                except UnicodeEncodeError:
                    json_payload = json.dumps(complete_data, ensure_ascii=True)
                yield f"data: {json_payload}\n\n"

                # --- Resource Cleanup ---
                # Explicitly delete model instance to release resources if loaded per-request
                if tts_model_instance is not None:
                    logger.info(f"Cleaning up TTS model instance '{loaded_model_id}' after request.")
                    del tts_model_instance
                    try:
                         import torch, gc
                         gc.collect()
                         if device.startswith("cuda") and torch.cuda.is_available():
                             torch.cuda.empty_cache()
                             logger.info(f"Final CUDA cache clear. Mem allocated: {torch.cuda.memory_allocated(0)/1024**2:.2f}MB")
                    except Exception as final_clean_err:
                        logger.warning(f"Error during final resource cleanup: {final_clean_err}")


        # --- Return Streaming Response ---
        logger.info("Starting narration generation stream response.")
        return Response(generate_narration_stream(), mimetype='text/event-stream', headers={'Cache-Control': 'no-cache'})

    except Exception as e:
        # Catch errors before starting the stream (e.g., request parsing)
        logger.exception(f"Error setting up narration generation: {e}")
        return jsonify({'error': f'Failed to start generation: {str(e)}'}), 500

@narration_bp.route('/audio/<path:filename>', methods=['GET'])
def get_audio_file(filename):
    """Serve audio files from reference or output directories"""
    # Prevent directory traversal attacks
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': 'Invalid filename'}), 400

    # Check reference directory first
    reference_path = os.path.join(REFERENCE_AUDIO_DIR, filename)
    # Use safe join and check existence within the intended directory
    safe_ref_path = os.path.abspath(reference_path)
    if safe_ref_path.startswith(os.path.abspath(REFERENCE_AUDIO_DIR)) and os.path.exists(safe_ref_path):
        logger.debug(f"Serving reference audio: {safe_ref_path}")
        return send_file(safe_ref_path, mimetype='audio/wav') # Assume WAV, adjust if needed

    # Check output directory
    output_path = os.path.join(OUTPUT_AUDIO_DIR, filename)
    safe_output_path = os.path.abspath(output_path)
    if safe_output_path.startswith(os.path.abspath(OUTPUT_AUDIO_DIR)) and os.path.exists(safe_output_path):
        logger.debug(f"Serving output audio: {safe_output_path}")
        return send_file(safe_output_path, mimetype='audio/wav') # Assume WAV

    logger.warning(f"Audio file not found in reference or output dirs: {filename}")
    return jsonify({'error': 'File not found'}), 404