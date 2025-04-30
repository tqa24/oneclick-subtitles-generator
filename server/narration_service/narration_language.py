import logging
import re
import string

logger = logging.getLogger(__name__)

def is_text_english(text):
    """Detect if the text is likely English using simple heuristics"""
    try:
        if not text or not isinstance(text, str):
            return True  # Default to True for empty or non-string input

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
