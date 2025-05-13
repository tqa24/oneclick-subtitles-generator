import os
import json
import base64
import logging
import requests
import time
from .narration_language import is_text_english
from .narration_config import APP_ROOT_DIR

logger = logging.getLogger(__name__)

# Dictionary to track failed API keys and their retry times
_failed_api_keys = {}
# Blacklist duration in seconds (5 minutes)
_BLACKLIST_DURATION = 5 * 60

def get_gemini_api_key():
    """Get Gemini API key from various sources with failover support"""
    # Get all available keys
    all_keys = get_all_gemini_api_keys()

    if not all_keys:
        logger.warning("No Gemini API keys found in any source.")
        return None

    # Filter out recently failed keys
    current_time = time.time()
    valid_keys = [key for key in all_keys if key not in _failed_api_keys or
                 current_time > _failed_api_keys[key]]

    # If all keys are blacklisted but we have keys, clear the blacklist and use them anyway
    if not valid_keys and all_keys:
        logger.warning("All Gemini API keys are blacklisted. Clearing blacklist and retrying.")
        _failed_api_keys.clear()
        valid_keys = all_keys

    # Return the first valid key
    if valid_keys:
        return valid_keys[0]

    return None

def blacklist_api_key(api_key):
    """Temporarily blacklist an API key that has failed"""
    if not api_key:
        return

    _failed_api_keys[api_key] = time.time() + _BLACKLIST_DURATION
    logger.warning(f"Blacklisted Gemini API key for {_BLACKLIST_DURATION} seconds")

def get_all_gemini_api_keys():
    """Get all available Gemini API keys from various sources"""
    keys = []

    # First try environment variable
    env_key = os.environ.get('GEMINI_API_KEY')
    if env_key:
        keys.append(env_key)

    # Try to read from a config file
    try:
        config_path = os.path.join(APP_ROOT_DIR, 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as config_file:
                config = json.load(config_file)
                # Check for single key
                if config.get('gemini_api_key'):
                    keys.append(config.get('gemini_api_key'))
                # Check for multiple keys
                if config.get('gemini_api_keys') and isinstance(config.get('gemini_api_keys'), list):
                    keys.extend(config.get('gemini_api_keys'))
    except Exception as e:
        logger.error(f"Error reading config file ({config_path}): {e}")

    # Try to read from localStorage.json file (saved from browser localStorage)
    try:
        localStorage_path = os.path.join(APP_ROOT_DIR, 'localStorage.json')
        if os.path.exists(localStorage_path):
            with open(localStorage_path, 'r', encoding='utf-8') as localStorage_file:
                localStorage_data = json.load(localStorage_file)
                # Check for single key (legacy)
                if localStorage_data.get('gemini_api_key'):
                    keys.append(localStorage_data.get('gemini_api_key'))
                # Check for multiple keys
                if localStorage_data.get('gemini_api_keys'):
                    try:
                        multi_keys = json.loads(localStorage_data.get('gemini_api_keys'))
                        if isinstance(multi_keys, list):
                            keys.extend(multi_keys)
                    except json.JSONDecodeError:
                        logger.error("Error parsing gemini_api_keys from localStorage.json")
    except Exception as e:
        logger.error(f"Error reading localStorage file ({localStorage_path}): {e}")

    # Remove duplicates while preserving order
    unique_keys = []
    for key in keys:
        if key and key not in unique_keys:
            unique_keys.append(key)

    return unique_keys

def transcribe_with_gemini(audio_path, model="gemini-1.5-flash-latest"):
    """Transcribe audio using Gemini API and detect language"""
    try:


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

            # Blacklist the API key for certain error types
            if (response.status_code in [400, 401, 403, 429, 503] or
                any(err in error_message.lower() for err in
                    ['api key', 'invalid key', 'unauthorized', 'permission',
                     'quota', 'rate limit', 'overloaded', 'unavailable'])):
                logger.warning(f"Blacklisting API key due to error: {error_message}")
                blacklist_api_key(api_key)

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

                    # Simple extraction: assume the first part is transcription,
                    # might need refinement if Gemini includes language ID explicitly.
                    # Let's assume the transcription is the main part of the text.
                    transcription = full_response_text # May need parsing if language is included


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


        return {
            "text": transcription,
            "is_english": is_english,
            "language": language
        }

    except requests.exceptions.Timeout:
        logger.error("Error transcribing with Gemini base64: Request timed out.")
        # Blacklist the API key on timeout
        blacklist_api_key(api_key)
        return { "text": "", "is_english": True, "language": "Error: Timeout" }
    except requests.exceptions.RequestException as e:
        logger.error(f"Error transcribing with Gemini base64: Network error - {e}")
        # Blacklist the API key on network errors
        blacklist_api_key(api_key)
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
