"""
Utility functions for managing narration directories in the Python service
"""

import os
import logging

# Import configuration
from .narration_config import OUTPUT_AUDIO_DIR

logger = logging.getLogger(__name__)

def get_subtitle_directory(subtitle_id):
    """
    Get the directory path for a specific subtitle ID
    
    Args:
        subtitle_id: The subtitle ID
        
    Returns:
        str: The directory path for the subtitle ID
    """
    return os.path.join(OUTPUT_AUDIO_DIR, f"subtitle_{subtitle_id}")

def ensure_subtitle_directory(subtitle_id):
    """
    Ensure a subtitle-specific directory exists
    
    Args:
        subtitle_id: The subtitle ID
        
    Returns:
        str: The directory path that was created
    """
    subtitle_dir = get_subtitle_directory(subtitle_id)
    if not os.path.exists(subtitle_dir):
        os.makedirs(subtitle_dir, exist_ok=True)
        logger.debug(f"Created subtitle directory: {subtitle_dir}")
    return subtitle_dir

def get_next_file_number(subtitle_dir):
    """
    Get the next file number for a subtitle directory
    
    Args:
        subtitle_dir: The subtitle directory path
        
    Returns:
        int: The next file number
    """
    if not os.path.exists(subtitle_dir):
        return 1
        
    existing_files = os.listdir(subtitle_dir)
    return len(existing_files) + 1
