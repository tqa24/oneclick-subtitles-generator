/**
 * Utility functions for language code handling
 */

import { GEMINI_LANGUAGE_CODES } from '../constants/languageConstants';

/**
 * Convert a language code to a Gemini-compatible language code
 * @param {string} languageCode - Language code to convert
 * @returns {string} - Gemini-compatible language code
 */
export const getGeminiLanguageCode = (languageCode) => {
  if (!languageCode) {
    return 'en-US'; // Default to English (US) if no language code is provided
  }

  // Normalize the language code to lowercase
  const normalizedCode = languageCode.toLowerCase();

  // Check if the exact code exists in our mapping
  if (GEMINI_LANGUAGE_CODES[normalizedCode]) {
    return GEMINI_LANGUAGE_CODES[normalizedCode];
  }

  // If not, try to match just the language part (before the hyphen)
  const languagePart = normalizedCode.split('-')[0];
  if (GEMINI_LANGUAGE_CODES[languagePart]) {
    return GEMINI_LANGUAGE_CODES[languagePart];
  }

  // If all else fails, default to English (US)
  console.warn(`No Gemini language code found for "${languageCode}", defaulting to en-US`);
  return 'en-US';
};
