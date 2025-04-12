/**
 * Store for transcription rules
 * This file is used to avoid circular dependencies between videoProcessor.js and geminiService.js
 */

// Store transcription rules globally
let globalTranscriptionRules = null;

/**
 * Set global transcription rules
 * @param {Object} rules - Transcription rules
 */
export const setTranscriptionRules = (rules) => {
  globalTranscriptionRules = rules;
};

/**
 * Get global transcription rules
 * @returns {Object} Transcription rules
 */
export const getTranscriptionRules = () => {
  return globalTranscriptionRules;
};
