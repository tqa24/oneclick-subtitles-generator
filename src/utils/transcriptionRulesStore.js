/**
 * Store for transcription rules
 * This file is used to avoid circular dependencies between videoProcessor.js and geminiService.js
 * and to persist transcription rules across sessions
 */

// Store transcription rules globally
let globalTranscriptionRules = null;

// LocalStorage key for transcription rules
const TRANSCRIPTION_RULES_KEY = 'transcription_rules';

/**
 * Set global transcription rules
 * @param {Object} rules - Transcription rules
 */
export const setTranscriptionRules = (rules) => {
  globalTranscriptionRules = rules;

  // Save to localStorage for persistence across sessions
  if (rules) {
    try {
      localStorage.setItem(TRANSCRIPTION_RULES_KEY, JSON.stringify(rules));
      console.log('Transcription rules saved to localStorage');
    } catch (error) {
      console.error('Error saving transcription rules to localStorage:', error);
    }
  } else {
    // If rules are null, remove from localStorage
    localStorage.removeItem(TRANSCRIPTION_RULES_KEY);
    console.log('Transcription rules removed from localStorage');
  }
};

/**
 * Get global transcription rules
 * @returns {Object} Transcription rules
 */
export const getTranscriptionRules = () => {
  // If rules are in memory, return them
  if (globalTranscriptionRules) {
    return globalTranscriptionRules;
  }

  // Otherwise, try to load from localStorage
  try {
    const savedRules = localStorage.getItem(TRANSCRIPTION_RULES_KEY);
    if (savedRules) {
      const parsedRules = JSON.parse(savedRules);
      globalTranscriptionRules = parsedRules; // Update in-memory rules
      console.log('Transcription rules loaded from localStorage');
      return parsedRules;
    }
  } catch (error) {
    console.error('Error loading transcription rules from localStorage:', error);
  }

  return null;
};

/**
 * Clear transcription rules from both memory and localStorage
 */
export const clearTranscriptionRules = () => {
  globalTranscriptionRules = null;
  localStorage.removeItem(TRANSCRIPTION_RULES_KEY);
  console.log('Transcription rules cleared from memory and localStorage');
};
