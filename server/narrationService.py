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
from modelManager import get_models, get_active_model, set_active_model, add_model, delete_model, download_model_from_hf, download_model_from_url, parse_hf_url, get_download_status, update_download_status, remove_download_status, update_model_info, is_model_using_symlinks, initialize_registry, cancel_download

# Set up logging with UTF-8 encoding
import sys
import codecs

# Force UTF-8 encoding for stdout and stderr
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', encoding='utf-8')
logger = logging.getLogger(__name__)

# Create blueprint
narration_bp = Blueprint('narration', __name__)

# Constants
NARRATION_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'narration')
REFERENCE_AUDIO_DIR = os.path.join(NARRATION_DIR, 'reference')
OUTPUT_AUDIO_DIR = os.path.join(NARRATION_DIR, 'output')

# Create directories if they don't exist
os.makedirs(NARRATION_DIR, exist_ok=True)
os.makedirs(REFERENCE_AUDIO_DIR, exist_ok=True)
os.makedirs(OUTPUT_AUDIO_DIR, exist_ok=True)

# Initialize variables
HAS_F5TTS = False
INIT_ERROR = None
device = None
tts_model = None

# Function to get Gemini API key
def get_gemini_api_key():
    """Get Gemini API key from various sources"""
    # First try environment variable
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key:
        return api_key

    # Try to read from a config file
    try:
        # Check if there's a config.json file in the parent directory
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r') as config_file:
                config = json.load(config_file)
                api_key = config.get('gemini_api_key')
                if api_key:
                    return api_key
    except Exception as e:
        logger.error(f"Error reading config file: {e}")

    # Try to read from localStorage.json file (saved from browser localStorage)
    try:
        localStorage_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'localStorage.json')
        if os.path.exists(localStorage_path):
            with open(localStorage_path, 'r') as localStorage_file:
                localStorage_data = json.load(localStorage_file)
                api_key = localStorage_data.get('gemini_api_key')
                if api_key:
                    return api_key
    except Exception as e:
        logger.error(f"Error reading localStorage file: {e}")

    # If no API key found, return None
    return None

# Function to transcribe audio using Gemini API
def transcribe_with_gemini(audio_path, model="gemini-2.0-flash-lite"):
    """Transcribe audio using Gemini API and detect language"""
    try:
        logger.info(f"Transcribing audio with Gemini: {audio_path}")

        # Read the audio file as binary data
        with open(audio_path, 'rb') as audio_file:
            audio_data = audio_file.read()

        # Encode the audio data as base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        # Use the base64 transcription function
        return transcribe_with_gemini_base64(audio_base64, model)
    except Exception as e:
        logger.error(f"Error transcribing with Gemini: {e}")
        return {
            "text": "",
            "is_english": True,  # Default to True on error
            "language": "Unknown"
        }

# Function to transcribe audio directly from base64 data
def transcribe_with_gemini_base64(audio_base64, model="gemini-2.0-flash-lite"):
    """Transcribe audio using Gemini API from base64 data"""
    try:
        logger.info("Transcribing audio with Gemini from base64 data")

        # Get Gemini API key
        api_key = get_gemini_api_key()

        if not api_key:
            raise ValueError("Gemini API key not found")

        # Prepare the request to Gemini API
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        # Create a minimal prompt for audio transcription
        prompt = "Transcribe this audio."

        # Prepare the request payload with optimized parameters
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": "audio/wav",
                                "data": audio_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,  # Lower temperature for more deterministic output
                "topK": 1,          # More focused sampling
                "topP": 0.8,         # More focused sampling
                "maxOutputTokens": 1024  # Limit output size for faster response
            }
        }

        # Send the request to Gemini API with a timeout
        response = requests.post(url, json=payload, timeout=10)  # 10 second timeout for faster response

        # Check if the request was successful
        if response.status_code != 200:
            logger.error(f"Gemini API error: {response.status_code} {response.text}")
            raise Exception(f"Gemini API error: {response.status_code}")

        # Parse the response
        result = response.json()

        # Extract the transcription text
        transcription = ""
        if 'candidates' in result and len(result['candidates']) > 0:
            if 'content' in result['candidates'][0] and 'parts' in result['candidates'][0]['content']:
                parts = result['candidates'][0]['content']['parts']
                if len(parts) > 0 and 'text' in parts[0]:
                    transcription = parts[0]['text'].strip()
                    logger.info(f"Gemini transcription result: {transcription}")

        if not transcription:
            logger.warning("Unexpected Gemini API response format")
            return {
                "text": "",
                "is_english": True  # Default to True if we can't detect
            }

        # Simple language detection without making another API call
        # Check if the text contains mostly English characters and words
        is_english = is_text_english(transcription)

        return {
            "text": transcription,
            "is_english": is_english,
            "language": "English" if is_english else "Non-English"
        }

    except Exception as e:
        logger.error(f"Error transcribing with Gemini base64: {e}")
        return {
            "text": "",
            "is_english": True,  # Default to True on error
            "language": "Unknown"
        }

# Function to detect if text is in English without using API
def is_text_english(text):
    """Detect if the text is in English using simple heuristics"""
    try:
        if not text:
            return True  # Default to True for empty text

        # Import here to avoid circular imports
        import re
        import string

        # Common English words
        common_english_words = {
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
            'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
            'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
            'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
            'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
            'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
            'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give',
            'day', 'most', 'us'
        }

        # Clean the text
        text = text.lower()
        text = re.sub(r'[^\w\s]', '', text)  # Remove punctuation
        words = text.split()

        if not words:
            return True

        # Count English words
        english_word_count = sum(1 for word in words if word in common_english_words)

        # Check if at least 30% of words are common English words
        english_ratio = english_word_count / len(words)

        # Check for non-Latin characters
        non_latin_chars = sum(1 for char in text if char not in string.ascii_lowercase + string.digits + ' ')
        non_latin_ratio = non_latin_chars / len(text) if text else 0

        logger.info(f"English word ratio: {english_ratio:.2f}, Non-Latin char ratio: {non_latin_ratio:.2f}")

        # If many non-Latin characters, probably not English
        if non_latin_ratio > 0.2:
            return False

        # If reasonable number of English words, probably English
        return english_ratio >= 0.15

    except Exception as e:
        logger.error(f"Error in is_text_english: {e}")
        return True  # Default to True on error

# Keep the original function for compatibility
def detect_language(text, api_key=None, model=None):
    """Detect if the text is in English (compatibility function)"""
    # Ignore api_key and model parameters, they're kept for backward compatibility
    return is_text_english(text)

# Function to process base64 audio data for reference
def process_base64_audio_reference():
    """Process base64 audio data for reference"""
    try:
        # Get base64 audio data and reference text
        data = request.get_json(force=True)  # Force parsing even if content-type is incorrect
        logger.info(f"Request JSON keys: {list(data.keys()) if data else 'None'}")

        audio_data = data.get('audio_data') if data else None
        reference_text = data.get('reference_text', '')
        should_transcribe = data.get('transcribe', '').lower() == 'true'

        logger.info(f"Reference text from JSON: {reference_text}")
        logger.info(f"Should transcribe flag: {should_transcribe}")

        # Validate audio data
        if not audio_data:
            logger.error("No audio_data in request.json or audio_data is empty")
            return jsonify({'error': 'No audio data'}), 400

        # Log audio data details
        audio_data_length = len(audio_data)
        logger.info(f"Audio data received, length: {audio_data_length}")

        # Check if audio_data is valid base64
        try:
            # Check if the string contains only valid base64 characters
            import re
            if not re.match('^[A-Za-z0-9+/]+={0,2}$', audio_data):
                logger.error("Audio data is not valid base64 format")
                # Log a sample of the data
                sample = audio_data[:100] + '...' if len(audio_data) > 100 else audio_data
                logger.error(f"Invalid base64 sample: {sample}")
                return jsonify({'error': 'Invalid base64 format'}), 400
        except Exception as e:
            logger.error(f"Error validating base64 format: {e}")
            return jsonify({'error': f'Error validating base64 format: {str(e)}'}), 400

        # Generate a unique filename
        unique_id = str(uuid.uuid4())
        filename = f"recorded_{unique_id}.wav"
        filepath = os.path.join(REFERENCE_AUDIO_DIR, filename)

        # Ensure directory exists
        os.makedirs(REFERENCE_AUDIO_DIR, exist_ok=True)

        # Save the base64 data to a file
        try:
            # Decode base64 data
            try:
                # Try to decode the base64 data
                audio_bytes = base64.b64decode(audio_data)
                logger.info(f"Successfully decoded base64 data, size: {len(audio_bytes)} bytes")
            except Exception as decode_error:
                logger.error(f"Error decoding base64 data: {decode_error}")
                # Log a sample of the data to help diagnose the issue
                sample = audio_data[:100] + '...' if len(audio_data) > 100 else audio_data
                logger.error(f"Base64 data sample: {sample}")
                return jsonify({'error': f'Invalid base64 data: {str(decode_error)}'}), 400

            # Save to file
            with open(filepath, 'wb') as f:
                f.write(audio_bytes)
            logger.info(f"Saved base64 audio to {filepath}")
        except Exception as e:
            logger.error(f"Error saving base64 audio to file: {e}")
            return jsonify({'error': f'Error saving audio: {str(e)}'}), 500

        # Verify file was saved
        if not os.path.exists(filepath):
            logger.error(f"Failed to save file to {filepath}")
            return jsonify({'error': 'Failed to save audio file'}), 500

        logger.info(f"File saved successfully: {filepath}")

        # Transcribe the audio if requested or if reference text is not provided
        is_english = True  # Default to True
        language = "Unknown"

        if should_transcribe or not reference_text:
            logger.info("Transcription requested or no reference text provided")
            try:
                # Transcribe directly from base64 data for faster response
                logger.info("Transcribing audio with Gemini directly from base64 data")
                transcription_result = transcribe_with_gemini_base64(audio_data)
                reference_text = transcription_result.get("text", "")
                is_english = transcription_result.get("is_english", True)
                language = transcription_result.get("language", "Unknown")
                logger.info(f"Gemini transcription result: {reference_text}, Language: {language}, Is English: {is_english}")
            except Exception as e:
                logger.error(f"Error transcribing with Gemini base64: {e}")

                # Fallback to F5-TTS if available
                if HAS_F5TTS:
                    try:
                        logger.info("Attempting to transcribe audio with F5-TTS")
                        reference_text = tts_model.transcribe(filepath)
                        logger.info(f"F5-TTS transcription result: {reference_text}")
                    except Exception as e:
                        logger.error(f"Error transcribing audio with F5-TTS: {e}")
                        reference_text = ""
        else:
            logger.info("Skipping transcription as per request")

        response_data = {
            'success': True,
            'filepath': filepath,
            'filename': filename,
            'reference_text': reference_text,
            'is_english': is_english,
            'language': language
        }
        logger.info(f"Returning success response: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in process_base64_audio_reference: {e}")
        return jsonify({'error': str(e)}), 500

# Initialize F5-TTS device settings only
try:
    import torch
    from f5_tts.api import F5TTS

    # Check if CUDA is available
    cuda_available = torch.cuda.is_available()
    logger.info(f"CUDA available: {cuda_available}")

    if cuda_available:
        # Set environment variable to force CUDA
        os.environ['CUDA_VISIBLE_DEVICES'] = '0'
        # Force CUDA device
        device = "cuda:0"  # Explicitly use first CUDA device
        torch.cuda.set_device(0)  # Set to first CUDA device
        logger.info(f"Using CUDA device: {torch.cuda.get_device_name(0)}")
        logger.info(f"CUDA device count: {torch.cuda.device_count()}")
        logger.info(f"Current CUDA device: {torch.cuda.current_device()}")
    else:
        logger.warning("CUDA not available, falling back to CPU")
        device = "cpu"

    logger.info(f"Using device: {device}")

    # Initialize registry to ensure default model is registered
    initialize_registry()
    logger.info("Model registry initialized")

    # We don't load any model at startup - models will be loaded on-demand
    tts_model = None

    # Set flag to indicate F5-TTS is available
    HAS_F5TTS = True
    INIT_ERROR = None
    logger.info("F5-TTS device settings initialized successfully")
except ImportError as e:
    logger.warning(f"F5-TTS not found. Narration features will be disabled. Error: {e}")
    HAS_F5TTS = False
    INIT_ERROR = f"F5-TTS not found: {str(e)}"
except Exception as e:
    logger.error(f"Error initializing F5-TTS device settings: {e}")
    HAS_F5TTS = False
    INIT_ERROR = f"Error initializing F5-TTS device settings: {str(e)}"

@narration_bp.route('/status', methods=['GET'])
def get_status():
    """Check if F5-TTS is available"""
    # Additional runtime check for CUDA status
    runtime_device = device
    if HAS_F5TTS and device == "cuda:0":
        try:
            import torch
            if not torch.cuda.is_available():
                logger.warning("CUDA was previously available but now reports as unavailable!")
                runtime_device = "cuda_error"
        except Exception as e:
            logger.error(f"Error checking CUDA status: {e}")

    # Only log status checks once every 60 seconds to reduce log spam
    current_time = time.time()
    if not hasattr(get_status, 'last_log_time') or current_time - get_status.last_log_time > 60:
        logger.info(f"Status check: F5-TTS available: {HAS_F5TTS}, device: {runtime_device if HAS_F5TTS else 'None'}")
        get_status.last_log_time = current_time

    # Get GPU info if available
    gpu_info = {}
    if HAS_F5TTS and "cuda" in str(device):
        try:
            import torch
            if torch.cuda.is_available():
                gpu_info = {
                    'cuda_available': True,
                    'device_name': torch.cuda.get_device_name(0),
                    'device_count': torch.cuda.device_count(),
                    'current_device': torch.cuda.current_device(),
                    'memory_allocated': f"{torch.cuda.memory_allocated(0) / 1024**2:.2f} MB",
                    'memory_reserved': f"{torch.cuda.memory_reserved(0) / 1024**2:.2f} MB"
                }

                # Add model device info
                if hasattr(tts_model, 'device'):
                    gpu_info['model_device'] = str(tts_model.device)
                elif hasattr(tts_model, 'model') and hasattr(tts_model.model, 'device'):
                    gpu_info['model_device'] = str(tts_model.model.device)
            else:
                gpu_info = {'cuda_available': False, 'error': 'CUDA not available at runtime'}
        except Exception as e:
            gpu_info = {'cuda_available': False, 'error': str(e)}

    # Get model info
    model_info = get_models()

    return jsonify({
        'available': HAS_F5TTS,
        'device': runtime_device if HAS_F5TTS else None,
        'error': INIT_ERROR,
        'gpu_info': gpu_info,
        'source': 'direct',
        'models': model_info
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
        # We no longer load the model immediately - it will be loaded on-demand
        logger.info(f"Active model set to {model_id} (will be loaded on-demand when needed)")
        return jsonify({'success': True, 'message': f'Active model set to {model_id} (will be loaded on-demand when needed)'})
    else:
        return jsonify({'error': message}), 400

@narration_bp.route('/models', methods=['POST'])
def add_new_model():
    """Add a new model"""
    data = request.json

    # Check if we're adding from Hugging Face or direct URL
    source_type = data.get('source_type', 'huggingface')

    if source_type == 'huggingface':
        # Handle Hugging Face model
        model_url = data.get('model_url')
        vocab_url = data.get('vocab_url')
        config = data.get('config', {})
        model_id = data.get('model_id')

        if not model_url:
            return jsonify({'error': 'No model_url provided'}), 400

        # Parse URLs if they're in hf:// format
        repo_id, model_path = parse_hf_url(model_url)
        _, vocab_path = parse_hf_url(vocab_url) if vocab_url else (None, None)

        if not repo_id or not model_path:
            return jsonify({'error': 'Invalid Hugging Face URL format'}), 400

        # Get language codes if provided
        language_codes = data.get('languageCodes', [])

        # Download the model
        success, message, model_id = download_model_from_hf(repo_id, model_path, vocab_path, config, model_id, language_codes)

    elif source_type == 'url':
        # Handle direct URL model
        model_url = data.get('model_url')
        vocab_url = data.get('vocab_url')
        config = data.get('config', {})
        model_id = data.get('model_id')

        if not model_url:
            return jsonify({'error': 'No model_url provided'}), 400

        # Get language codes if provided
        language_codes = data.get('languageCodes', [])

        # Download the model
        success, message, model_id = download_model_from_url(model_url, vocab_url, config, model_id, language_codes)

    else:
        return jsonify({'error': f'Invalid source_type: {source_type}'}), 400

    if success:
        return jsonify({
            'success': True,
            'message': message,
            'model_id': model_id
        })
    else:
        return jsonify({'error': message}), 400

@narration_bp.route('/models/download-status/<model_id>', methods=['GET'])
def get_model_download_status(model_id):
    """Get the download status of a model"""
    status = get_download_status(model_id)

    if status:
        # Return the status directly, not nested under 'status'
        return jsonify({
            'model_id': model_id,
            'status': status['status'],
            'progress': status['progress'],
            'error': status['error'] if 'error' in status else None,
            'timestamp': status['timestamp']
        })
    else:
        return jsonify({
            'model_id': model_id,
            'status': None
        }), 404

@narration_bp.route('/models/<model_id>', methods=['DELETE'])
def remove_model(model_id):
    """Delete a model"""
    delete_cache = request.args.get('delete_cache', 'false').lower() == 'true'
    success, message = delete_model(model_id, delete_cache)

    if success:
        return jsonify({'success': True, 'message': message})
    else:
        return jsonify({'error': message}), 400

@narration_bp.route('/models/<model_id>', methods=['PUT'])
def update_model(model_id):
    """Update model information"""
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    success, message = update_model_info(model_id, data)

    if success:
        return jsonify({'success': True, 'message': message})
    else:
        return jsonify({'error': message}), 400

@narration_bp.route('/models/<model_id>/storage', methods=['GET'])
def get_model_storage_info(model_id):
    """Get information about how a model is stored (symlink or copy)"""
    is_symlink, original_model_file, original_vocab_file = is_model_using_symlinks(model_id)

    return jsonify({
        'model_id': model_id,
        'is_symlink': is_symlink,
        'original_model_file': original_model_file,
        'original_vocab_file': original_vocab_file
    })

@narration_bp.route('/models/cancel-download/<model_id>', methods=['POST'])
def cancel_model_download(model_id):
    """Cancel an ongoing model download"""
    logger.info(f"Received request to cancel download for model: {model_id}")

    success = cancel_download(model_id)

    if success:
        return jsonify({
            'success': True,
            'message': f'Download cancelled for model {model_id}'
        })
    else:
        return jsonify({
            'error': f'No active download found for model {model_id}'
        }), 404

@narration_bp.route('/upload-reference', methods=['POST'])
def upload_reference_audio():
    """Upload reference audio file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Generate a unique filename
    filename = secure_filename(file.filename)
    unique_id = str(uuid.uuid4())
    base, ext = os.path.splitext(filename)
    unique_filename = f"{base}_{unique_id}{ext}"

    # Save the file
    filepath = os.path.join(REFERENCE_AUDIO_DIR, unique_filename)
    file.save(filepath)

    # Transcribe the audio if reference text is not provided
    reference_text = request.form.get('reference_text', '')

    # Only attempt transcription if reference text is not provided
    if not reference_text:
        # First try with F5-TTS if available
        if HAS_F5TTS:
            try:
                logger.info("Attempting to transcribe uploaded audio with F5-TTS")
                reference_text = tts_model.transcribe(filepath)
                logger.info(f"F5-TTS transcription result: {reference_text}")
            except Exception as e:
                logger.error(f"Error transcribing uploaded audio with F5-TTS: {e}")
                reference_text = ""

        # If F5-TTS failed or is not available, try with Gemini
        is_english = True  # Default to True
        if not reference_text:
            try:
                logger.info("Attempting to transcribe uploaded audio with Gemini Flash Lite")
                transcription_result = transcribe_with_gemini(filepath, "gemini-2.0-flash-lite")
                reference_text = transcription_result["text"]
                is_english = transcription_result["is_english"]
                logger.info(f"Gemini transcription result: {reference_text}, is_english: {is_english}")
            except Exception as e:
                logger.error(f"Error transcribing uploaded audio with Gemini: {e}")
                reference_text = ""

    return jsonify({
        'success': True,
        'filepath': filepath,
        'filename': unique_filename,
        'reference_text': reference_text,
        'is_english': is_english
    })

@narration_bp.route('/record-reference', methods=['POST'])
def record_reference_audio():
    """Save recorded audio as reference"""
    try:
        # Log detailed request information
        logger.info(f"Received record-reference request")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Content-Type: {request.headers.get('Content-Type')}")
        logger.info(f"Content-Length: {request.headers.get('Content-Length')}")
        logger.info(f"Request files: {list(request.files.keys()) if request.files else 'None'}")
        logger.info(f"Request form: {list(request.form.keys()) if request.form else 'None'}")

        # Check if the request has JSON content type
        content_type = request.headers.get('Content-Type', '')
        is_json_request = 'application/json' in content_type.lower()
        logger.info(f"Is JSON request based on Content-Type: {is_json_request}")

        # Try to parse request data in different ways
        request_data = None

        # Try to get JSON data
        try:
            if is_json_request:
                request_data = request.get_json(silent=True)
                logger.info(f"Parsed JSON data: {type(request_data)}")
                if request_data:
                    logger.info(f"JSON keys: {list(request_data.keys())}")
                    if 'audio_data' in request_data:
                        audio_data_length = len(request_data.get('audio_data', ''))
                        logger.info(f"Found audio_data in JSON, length: {audio_data_length}")
                        if audio_data_length > 0:
                            return process_base64_audio_reference()
                        else:
                            logger.error("audio_data is empty")
                            return jsonify({'error': 'Empty audio data'}), 400
                    else:
                        logger.error("JSON data missing 'audio_data' field")
                        return jsonify({'error': 'No audio_data field in JSON'}), 400
                else:
                    logger.error("Failed to parse JSON data")
                    return jsonify({'error': 'Invalid JSON data'}), 400
        except Exception as e:
            logger.error(f"Error parsing JSON: {e}")
            return jsonify({'error': f'Error parsing JSON: {str(e)}'}), 400

        # Traditional file upload
        if 'audio_data' not in request.files:
            logger.error("No audio_data in request.files")
            return jsonify({'error': 'No audio data'}), 400

        audio_file = request.files['audio_data']
        logger.info(f"Received audio file: {audio_file.filename}, size: {audio_file.content_length}")
    except Exception as e:
        logger.error(f"Error in record_reference_audio: {e}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

    try:
        # Generate a unique filename
        unique_id = str(uuid.uuid4())
        filename = f"recorded_{unique_id}.wav"
        filepath = os.path.join(REFERENCE_AUDIO_DIR, filename)

        # Ensure directory exists
        os.makedirs(REFERENCE_AUDIO_DIR, exist_ok=True)

        # Save the file
        logger.info(f"Saving audio file to {filepath}")
        audio_file.save(filepath)

        # Verify file was saved
        if not os.path.exists(filepath):
            logger.error(f"Failed to save file to {filepath}")
            return jsonify({'error': 'Failed to save audio file'}), 500

        logger.info(f"File saved successfully: {filepath}")

        # Get reference text and transcribe flag
        reference_text = request.form.get('reference_text', '')
        should_transcribe = request.form.get('transcribe', '').lower() == 'true'

        logger.info(f"Reference text from form: {reference_text}")
        logger.info(f"Should transcribe flag: {should_transcribe}")

        # Attempt transcription if explicitly requested or if reference text is not provided
        if should_transcribe or not reference_text:
            # First try with F5-TTS if available
            if HAS_F5TTS:
                try:
                    logger.info("Attempting to transcribe audio with F5-TTS")
                    reference_text = tts_model.transcribe(filepath)
                    logger.info(f"F5-TTS transcription result: {reference_text}")
                except Exception as e:
                    logger.error(f"Error transcribing audio with F5-TTS: {e}")
                    reference_text = ""

            # If F5-TTS failed or is not available, try with Gemini
            is_english = True  # Default to True
            if not reference_text:
                try:
                    logger.info("Attempting to transcribe audio with Gemini Flash Lite")
                    transcription_result = transcribe_with_gemini(filepath, "gemini-2.0-flash-lite")
                    reference_text = transcription_result["text"]
                    is_english = transcription_result["is_english"]
                    logger.info(f"Gemini transcription result: {reference_text}, is_english: {is_english}")
                except Exception as e:
                    logger.error(f"Error transcribing audio with Gemini: {e}")
                    reference_text = ""

        response_data = {
            'success': True,
            'filepath': filepath,
            'filename': filename,
            'reference_text': reference_text,
            'is_english': is_english
        }
        logger.info(f"Returning success response: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in record_reference_audio: {e}")
        return jsonify({'error': str(e)}), 500

@narration_bp.route('/extract-segment', methods=['POST'])
def extract_audio_segment():
    """Extract audio segment from video"""
    data = request.json
    video_path = data.get('video_path')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    should_transcribe = data.get('transcribe', True)  # Default to True for backward compatibility

    logger.info(f"Extract segment request: video_path={video_path}, start_time={start_time}, end_time={end_time}, should_transcribe={should_transcribe}")

    if not video_path or start_time is None or end_time is None:
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Use ffmpeg to extract audio segment
        unique_id = str(uuid.uuid4())
        output_path = os.path.join(REFERENCE_AUDIO_DIR, f"segment_{unique_id}.wav")

        # Convert start and end times to seconds if they're in format "00:00:00"
        if isinstance(start_time, str) and ":" in start_time:
            parts = start_time.split(":")
            start_time = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

        if isinstance(end_time, str) and ":" in end_time:
            parts = end_time.split(":")
            end_time = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

        duration = end_time - start_time

        # Use ffmpeg to extract the segment
        import subprocess
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-ss', str(start_time),
            '-t', str(duration),
            '-vn',  # No video
            '-acodec', 'pcm_s16le',  # PCM 16-bit little-endian format
            '-ar', '44100',  # 44.1kHz sample rate
            '-ac', '1',  # Mono
            output_path
        ]

        subprocess.run(cmd, check=True)

        # Transcribe the audio segment if requested
        reference_text = ""
        is_english = True  # Default to True
        language = "Unknown"

        if should_transcribe:
            logger.info("Transcription requested for audio segment")

            # First try with F5-TTS if available
            if HAS_F5TTS:
                try:
                    logger.info("Attempting to transcribe audio segment with F5-TTS")
                    reference_text = tts_model.transcribe(output_path)
                    logger.info(f"F5-TTS transcription result: {reference_text}")
                except Exception as e:
                    logger.error(f"Error transcribing audio segment with F5-TTS: {e}")
                    reference_text = ""

            # If F5-TTS failed or is not available, try with Gemini
            if not reference_text:
                try:
                    logger.info("Attempting to transcribe audio segment with Gemini Flash Lite")
                    transcription_result = transcribe_with_gemini(output_path, "gemini-2.0-flash-lite")
                    reference_text = transcription_result["text"]
                    is_english = transcription_result["is_english"]
                    language = transcription_result.get("language", "Unknown")
                    logger.info(f"Gemini transcription result: {reference_text}, language: {language}, is_english: {is_english}")
                except Exception as e:
                    logger.error(f"Error transcribing audio segment with Gemini: {e}")
                    reference_text = ""
        else:
            logger.info("Transcription not requested for audio segment")

        return jsonify({
            'success': True,
            'filepath': output_path,
            'filename': os.path.basename(output_path),
            'reference_text': reference_text,
            'is_english': is_english,
            'language': language
        })

    except Exception as e:
        logger.error(f"Error extracting audio segment: {e}")
        return jsonify({'error': str(e)}), 500

@narration_bp.route('/generate', methods=['POST', 'HEAD'])
def generate_narration():
    """Generate narration for subtitles"""
    if not HAS_F5TTS:
        return jsonify({'error': 'F5-TTS is not available'}), 503

    # Handle HEAD request to check if streaming is supported
    if request.method == 'HEAD':
        response = Response()
        response.headers['Content-Type'] = 'text/event-stream'
        return response

    data = request.json
    reference_audio = data.get('reference_audio')
    reference_text = data.get('reference_text', '')
    subtitles = data.get('subtitles', [])
    settings = data.get('settings', {})

    # Extract settings with defaults
    # Only use parameters that are actually supported by F5-TTS
    remove_silence = settings.get('removeSilence', True)
    speed = float(settings.get('speechRate', 1.0))
    batch_size = settings.get('batchSize', 10)

    # Handle nfeStep parameter safely
    nfe_step_value = settings.get('nfeStep')
    nfe_step = 32  # Default value
    if nfe_step_value is not None:
        try:
            nfe_step = int(nfe_step_value)
        except (ValueError, TypeError):
            logger.warning(f"Invalid nfeStep value: {nfe_step_value}, using default: 32")

    # Handle swayCoef parameter safely
    sway_coef_value = settings.get('swayCoef')
    sway_coef = -1.0  # Default value
    if sway_coef_value is not None:
        try:
            sway_coef = float(sway_coef_value)
        except (ValueError, TypeError):
            logger.warning(f"Invalid swayCoef value: {sway_coef_value}, using default: -1.0")

    # Handle cfgStrength parameter safely
    cfg_strength_value = settings.get('cfgStrength')
    cfg_strength = 2.0  # Default value
    if cfg_strength_value is not None:
        try:
            cfg_strength = float(cfg_strength_value)
        except (ValueError, TypeError):
            logger.warning(f"Invalid cfgStrength value: {cfg_strength_value}, using default: 2.0")

    # Handle seed parameter
    seed = settings.get('seed')  # None means random seed

    # Log the settings being used
    logger.info(f"Using settings: remove_silence={remove_silence}, speed={speed}, batch_size={batch_size}, nfe_step={nfe_step}, sway_coef={sway_coef}, cfg_strength={cfg_strength}, seed={seed}")

    logger.info(f"Advanced settings: {settings}")

    if not reference_audio or not subtitles:
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Log the received references to help with debugging
        logger.info(f"Generating narration with reference_audio: {reference_audio}")
        logger.info(f"Reference text: {reference_text}")
        logger.info(f"Number of subtitles: {len(subtitles)}")

        # Verify the reference audio file exists
        if not os.path.exists(reference_audio):
            logger.error(f"Reference audio file does not exist: {reference_audio}")
            return jsonify({'error': f'Reference audio file not found: {reference_audio}'}), 404

        # Create a new model instance to avoid any cached state from previous references
        logger.info("Creating new F5TTS instance to avoid cached references")
        import torch
        from f5_tts.api import F5TTS

        # Use the same device as the global model
        current_device = device

        # Initialize request_model variable
        request_model = None

        try:
            # Get model registry
            model_registry = get_models()

            # Check if a specific model ID was provided in the request
            model_id = settings.get('modelId')

            if model_id and any(model["id"] == model_id for model in model_registry["models"]):
                # Get the requested model info
                requested_model = next(model for model in model_registry["models"] if model["id"] == model_id)
                logger.info(f"Using requested model for generation: {requested_model['id']}")

                # Check if this is the default model with special markers
                if requested_model.get("source") == "default" or requested_model.get("model_path") == "default":
                    logger.info("Requested model is the default model, initializing without paths")
                    request_model = F5TTS(device=current_device)
                else:
                    # Initialize with custom model paths
                    model_path = requested_model.get("model_path")
                    vocab_path = requested_model.get("vocab_path")
                    config = requested_model.get("config", {})

                    logger.info(f"Initializing F5-TTS with requested model: {model_path}")
                    # Only pass parameters that F5TTS actually accepts
                    logger.info(f"Model config (not passed to constructor): {config}")
                    request_model = F5TTS(
                        device=current_device,
                        ckpt_file=model_path,
                        vocab_file=vocab_path
                    )
            else:
                # If no specific model was requested or the requested model doesn't exist,
                # fall back to the default model
                logger.info(f"No specific model requested or model not found, using default F5-TTS model")
                request_model = F5TTS(device=current_device)

                # Make sure the default model is in the registry
                if not hasattr(get_status, 'default_model_checked'):
                    initialize_registry()
                    get_status.default_model_checked = True

            # Log the device being used
            logger.info(f"New F5TTS instance created with device: {current_device}")

            # Verify the model was created successfully
            if request_model is None:
                error_msg = "F5-TTS model initialization failed"
                logger.error(error_msg)
                return jsonify({'error': error_msg}), 500
        except Exception as e:
            logger.error(f"Error creating F5TTS instance: {e}")
            return jsonify({'error': f'Error initializing F5-TTS: {str(e)}'}), 500

        # Create a local copy of the model for the generator function
        model_for_generator = request_model

        # Use Flask's streaming response to send results incrementally
        def generate_narration_stream(model=model_for_generator, ref_text=reference_text, ref_audio=reference_audio):
            # Initialize results list
            results = []
            # Store reference text locally to avoid scope issues
            reference_text = ref_text

            # Check if the model was successfully created
            if model is None:
                error_msg = "F5-TTS model initialization failed"
                logger.error(error_msg)

                # Ensure proper UTF-8 encoding in JSON
                error_data = {'type': 'error', 'error': error_msg}
                try:
                    json_data = json.dumps(error_data, ensure_ascii=False)
                    yield f"data: {json_data}\n\n"
                except UnicodeEncodeError as ue:
                    logger.warning(f"Unicode error in JSON serialization: {ue}. Using ASCII fallback.")
                    json_data = json.dumps(error_data)
                    yield f"data: {json_data}\n\n"
                return

            # Process each subtitle one by one
            for subtitle in subtitles:
                subtitle_id = subtitle.get('id')
                text = subtitle.get('text', '')

                if not text:
                    # Skip empty subtitles but still send a response
                    result = {
                        'subtitle_id': subtitle_id,
                        'text': '',
                        'success': True,
                        'skipped': True
                    }
                    results.append(result)

                    # Send the current result as a JSON string followed by a special delimiter
                    skip_data = {'type': 'result', 'result': result, 'progress': len(results), 'total': len(subtitles)}
                    try:
                        json_data = json.dumps(skip_data, ensure_ascii=False)
                        yield f"data: {json_data}\n\n"
                    except UnicodeEncodeError as ue:
                        logger.warning(f"Unicode error in JSON serialization: {ue}. Using ASCII fallback.")
                        json_data = json.dumps(skip_data)
                        yield f"data: {json_data}\n\n"
                    continue

                # Generate a unique filename for this subtitle
                unique_id = str(uuid.uuid4())
                output_filename = f"narration_{subtitle_id}_{unique_id}.wav"
                output_path = os.path.join(OUTPUT_AUDIO_DIR, output_filename)

                # Send progress update with more detailed message
                progress_message = f'Generating narration for subtitle {subtitle_id} ({len(results) + 1}/{len(subtitles)})'
                logger.info(progress_message)

                # Ensure proper UTF-8 encoding in JSON
                progress_data = {'type': 'progress', 'message': progress_message, 'current': len(results) + 1, 'total': len(subtitles)}
                try:
                    json_data = json.dumps(progress_data, ensure_ascii=False)
                    yield f"data: {json_data}\n\n"
                except UnicodeEncodeError as ue:
                    logger.warning(f"Unicode error in JSON serialization: {ue}. Using ASCII fallback.")
                    json_data = json.dumps(progress_data)
                    yield f"data: {json_data}\n\n"

                try:
                    # Generate narration and save to file
                    logger.info(f"Generating narration for subtitle {subtitle_id} using device: {current_device}")
                    logger.info(f"Using reference audio: {ref_audio}")
                    logger.info(f"Using reference text: {reference_text}")
                    logger.info(f"Generating for text: {text}")

                    # Double-check that the model is still valid
                    if model is None:
                        raise ValueError("Model is not available for generation")

                    # Log the text we're generating for
                    logger.info(f"Cleaned text for subtitle {subtitle_id}: {text}")

                    # No need to clean Unicode characters as F5-TTS should support them
                    # We'll only clean control characters that might cause issues
                    import re
                    # Remove control characters but preserve Unicode characters (including Vietnamese)
                    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)

                    # Ensure text is properly encoded as UTF-8
                    if isinstance(text, str):
                        text_bytes = text.encode('utf-8')
                        text = text_bytes.decode('utf-8')

                    # Log text in a way that won't cause encoding issues
                    try:
                        logger.info(f"Final text after cleaning for subtitle {subtitle_id}: {text}")
                    except UnicodeEncodeError:
                        logger.info(f"Final text after cleaning for subtitle {subtitle_id}: [Contains special characters]")

                    # Ensure reference text is properly encoded as UTF-8
                    if isinstance(reference_text, str):
                        reference_text_bytes = reference_text.encode('utf-8')
                        reference_text = reference_text_bytes.decode('utf-8')

                    # Force CUDA if available
                    import torch
                    if torch.cuda.is_available():
                        logger.info(f"Using CUDA for subtitle {subtitle_id} generation")
                        with torch.cuda.device(0):
                            # Use the model instance with supported settings
                            try:
                                # Try to log the text we're generating (safely)
                                try:
                                    logger.info(f"Generating with text: {text}")
                                except UnicodeEncodeError:
                                    logger.info("Generating with text containing special characters")

                                model.infer(
                                    ref_file=ref_audio,
                                    ref_text=reference_text,
                                    gen_text=text,
                                    file_wave=output_path,
                                    remove_silence=remove_silence,
                                    speed=speed,
                                    nfe_step=nfe_step,
                                    sway_sampling_coef=sway_coef,
                                    cfg_strength=cfg_strength,
                                    seed=seed
                                )
                            except UnicodeEncodeError as ue:
                                # If we get a Unicode error, try with a different encoding approach
                                logger.warning(f"Unicode error: {ue}. Trying with explicit encoding.")

                                # Convert to bytes and back with explicit UTF-8 encoding
                                if isinstance(text, str):
                                    text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')

                                if isinstance(reference_text, str):
                                    reference_text = reference_text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')

                                # Try again with the cleaned text
                                model.infer(
                                    ref_file=ref_audio,
                                    ref_text=reference_text,
                                    gen_text=text,
                                    file_wave=output_path,
                                    remove_silence=remove_silence,
                                    speed=speed,
                                    nfe_step=nfe_step,
                                    sway_sampling_coef=sway_coef,
                                    cfg_strength=cfg_strength,
                                    seed=seed
                                )
                    else:
                        logger.warning(f"CUDA not available for subtitle {subtitle_id} generation, using CPU")
                        # Use the model instance with supported settings
                        try:
                            # Try to log the text we're generating (safely)
                            try:
                                logger.info(f"Generating with text: {text}")
                            except UnicodeEncodeError:
                                logger.info("Generating with text containing special characters")

                            model.infer(
                                ref_file=ref_audio,
                                ref_text=reference_text,
                                gen_text=text,
                                file_wave=output_path,
                                remove_silence=remove_silence,
                                speed=speed,
                                nfe_step=nfe_step,
                                sway_sampling_coef=sway_coef,
                                cfg_strength=cfg_strength,
                                seed=seed
                            )
                        except UnicodeEncodeError as ue:
                            # If we get a Unicode error, try with a different encoding approach
                            logger.warning(f"Unicode error: {ue}. Trying with explicit encoding.")

                            # Convert to bytes and back with explicit UTF-8 encoding
                            if isinstance(text, str):
                                text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')

                            if isinstance(reference_text, str):
                                reference_text = reference_text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')

                            # Try again with the cleaned text
                            model.infer(
                                ref_file=ref_audio,
                                ref_text=reference_text,
                                gen_text=text,
                                file_wave=output_path,
                                remove_silence=remove_silence,
                                speed=speed,
                                nfe_step=nfe_step,
                                sway_sampling_coef=sway_coef,
                                cfg_strength=cfg_strength,
                                seed=seed
                            )
                    logger.info(f"Successfully generated narration for subtitle {subtitle_id}")

                    # Create result object
                    result = {
                        'subtitle_id': subtitle_id,
                        'text': text,
                        'audio_path': output_path,
                        'filename': output_filename,
                        'success': True
                    }
                    results.append(result)

                    # Send the current result as a JSON string followed by a special delimiter
                    result_data = {'type': 'result', 'result': result, 'progress': len(results), 'total': len(subtitles)}
                    logger.info(f"Sending result for subtitle {subtitle_id} ({len(results)}/{len(subtitles)})")

                    # Ensure proper UTF-8 encoding in JSON
                    try:
                        json_data = json.dumps(result_data, ensure_ascii=False)
                        yield f"data: {json_data}\n\n"
                    except UnicodeEncodeError as ue:
                        logger.warning(f"Unicode error in JSON serialization: {ue}. Using ASCII fallback.")
                        json_data = json.dumps(result_data)
                        yield f"data: {json_data}\n\n"

                    # Free memory after each generation
                    try:
                        if torch.cuda.is_available():
                            # Force garbage collection
                            import gc
                            gc.collect()

                            # Empty CUDA cache
                            torch.cuda.empty_cache()
                            logger.info(f"Cleared CUDA cache after generating subtitle {subtitle_id}")
                    except Exception as mem_error:
                        logger.error(f"Error freeing memory: {mem_error}")

                except Exception as e:
                    logger.error(f"Error generating narration for subtitle {subtitle_id}: {e}")
                    result = {
                        'subtitle_id': subtitle_id,
                        'text': text,
                        'error': str(e),
                        'success': False
                    }
                    results.append(result)

                    # Send the error result
                    error_data = {'type': 'error', 'result': result, 'progress': len(results), 'total': len(subtitles)}
                    logger.info(f"Sending error for subtitle {subtitle_id} ({len(results)}/{len(subtitles)})")

                    # Ensure proper UTF-8 encoding in JSON
                    try:
                        json_data = json.dumps(error_data, ensure_ascii=False)
                        yield f"data: {json_data}\n\n"
                    except UnicodeEncodeError as ue:
                        logger.warning(f"Unicode error in JSON serialization: {ue}. Using ASCII fallback.")
                        json_data = json.dumps(error_data)
                        yield f"data: {json_data}\n\n"

            # Clean up the model to free memory if it exists
            try:
                # Force garbage collection
                import gc
                gc.collect()

                # Import torch here to avoid scope issues
                import torch
                if torch.cuda.is_available():
                    # Empty CUDA cache
                    torch.cuda.empty_cache()

                    # Log memory usage
                    allocated = torch.cuda.memory_allocated(0)
                    reserved = torch.cuda.memory_reserved(0)
                    logger.info(f"Cleared CUDA cache after generation. Memory allocated: {allocated/1024**2:.2f}MB, reserved: {reserved/1024**2:.2f}MB")
            except Exception as e:
                logger.error(f"Error cleaning up resources: {e}")

            # Send final completion message
            complete_data = {'type': 'complete', 'results': results, 'total': len(results)}
            logger.info(f"Sending completion message with {len(results)} results")

            # Ensure proper UTF-8 encoding in JSON
            try:
                json_data = json.dumps(complete_data, ensure_ascii=False)
                yield f"data: {json_data}\n\n"
            except UnicodeEncodeError as ue:
                logger.warning(f"Unicode error in JSON serialization: {ue}. Using ASCII fallback.")
                json_data = json.dumps(complete_data)
                yield f"data: {json_data}\n\n"

        # Return a streaming response with error handling
        try:
            # Pass the model and reference text explicitly to the generator function
            return Response(
                generate_narration_stream(
                    model=model_for_generator,
                    ref_text=reference_text,
                    ref_audio=reference_audio
                ),
                mimetype='text/event-stream'
            )
        except Exception as e:
            logger.error(f"Unexpected error in streaming response: {e}")
            return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"Error generating narration: {e}")
        return jsonify({'error': str(e)}), 500

@narration_bp.route('/audio/<path:filename>', methods=['GET'])
def get_audio_file(filename):
    """Serve audio files"""
    # Check if the file is in the reference directory
    reference_path = os.path.join(REFERENCE_AUDIO_DIR, filename)
    if os.path.exists(reference_path):
        return send_file(reference_path, mimetype='audio/wav')

    # Check if the file is in the output directory
    output_path = os.path.join(OUTPUT_AUDIO_DIR, filename)
    if os.path.exists(output_path):
        return send_file(output_path, mimetype='audio/wav')

    return jsonify({'error': 'File not found'}), 404
