import os
import json
import logging
import time
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


