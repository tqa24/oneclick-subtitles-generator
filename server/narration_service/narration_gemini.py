import os
import json
import base64
import logging
import requests
import time
from .narration_language import is_text_english
from .narration_config import APP_ROOT_DIR

logger = logging.getLogger(__name__)

def get_gemini_api_key():
    """Get Gemini API key from various sources"""
    # First try environment variable
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key:

        return api_key

    # Try to read from a config file
    try:
        config_path = os.path.join(APP_ROOT_DIR, 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as config_file:
                config = json.load(config_file)
                api_key = config.get('gemini_api_key')
                if api_key:

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

                    return api_key
    except Exception as e:
        logger.error(f"Error reading localStorage file ({localStorage_path}): {e}")

    logger.warning("Gemini API key not found in environment variable, config.json, or localStorage.json.")
    return None

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
