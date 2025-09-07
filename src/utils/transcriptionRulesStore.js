/**
 * Store for transcription rules
 * This file is used to avoid circular dependencies between videoProcessor.js and geminiService.js
 * and to persist transcription rules for the current video
 */

import { API_BASE_URL } from '../config';

// Store transcription rules globally
let globalTranscriptionRules = null;

// LocalStorage key for transcription rules (legacy - will be removed)
const TRANSCRIPTION_RULES_KEY = 'transcription_rules';

// LocalStorage key for video-specific rules association
const RULES_VIDEO_ID_KEY = 'transcription_rules_video_id';

// Current cache ID for the video being processed
let currentCacheId = null;

/**
 * Set the current cache ID for the video being processed
 * @param {string} cacheId - Cache ID for the current video
 */
export const setCurrentCacheId = (cacheId) => {
  const previousCacheId = currentCacheId;
  currentCacheId = cacheId;
  
  // If the video has changed, clear in-memory rules to force reload
  if (previousCacheId && previousCacheId !== cacheId) {
    console.log('[TranscriptionRules] Video changed, clearing in-memory rules');
    globalTranscriptionRules = null;
  }
};

/**
 * Get the current cache ID
 * @returns {string} Current cache ID
 */
export const getCurrentCacheId = () => {
  return currentCacheId;
};

/**
 * Set global transcription rules
 * @param {Object} rules - Transcription rules
 */
export const setTranscriptionRules = async (rules) => {
  globalTranscriptionRules = rules;

  // Save to cache if we have a cache ID
  if (rules && currentCacheId) {
    try {
      const response = await fetch(`${API_BASE_URL}/save-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheId: currentCacheId,
          rules
        })
      });

      const result = await response.json();
      if (result.success) {
        // Also save the association between rules and video ID
        localStorage.setItem(RULES_VIDEO_ID_KEY, currentCacheId);
      } else {
        console.error('Failed to save transcription rules to cache:', result.error);
      }
    } catch (error) {
      console.error('Error saving transcription rules to cache:', error);
    }
  } else if (rules) {
    // Fallback to localStorage if no cache ID is available
    try {
      localStorage.setItem(TRANSCRIPTION_RULES_KEY, JSON.stringify(rules));
      // Save the video ID association if we have a cache ID
      if (currentCacheId) {
        localStorage.setItem(RULES_VIDEO_ID_KEY, currentCacheId);
      }
    } catch (error) {
      console.error('Error saving transcription rules to localStorage:', error);
    }
  } else {
    // If rules are null, remove from localStorage
    localStorage.removeItem(TRANSCRIPTION_RULES_KEY);
    localStorage.removeItem(RULES_VIDEO_ID_KEY);
  }

  // Dispatch event to notify components that transcription rules have been updated
  window.dispatchEvent(new CustomEvent('transcriptionRulesUpdated', {
    detail: { rules }
  }));
};

/**
 * Get global transcription rules
 * @returns {Object} Transcription rules
 */
export const getTranscriptionRules = async () => {
  // If rules are in memory, return them
  if (globalTranscriptionRules) {
    return globalTranscriptionRules;
  }

  // Try to load from cache if we have a cache ID
  if (currentCacheId) {
    try {
      const response = await fetch(`${API_BASE_URL}/rules/${currentCacheId}`);
      const data = await response.json();

      if (data.exists && data.rules) {
        globalTranscriptionRules = data.rules; // Update in-memory rules
        // Update the video ID association
        localStorage.setItem(RULES_VIDEO_ID_KEY, currentCacheId);
        return data.rules;
      }
    } catch (error) {
      console.error('Error loading transcription rules from cache:', error);
    }
  }

  // Check if the saved rules are for the current video
  const savedVideoId = localStorage.getItem(RULES_VIDEO_ID_KEY);
  const isMatchingVideo = savedVideoId && currentCacheId && savedVideoId === currentCacheId;
  
  // Only load rules if they match the current video or if we don't have video IDs to compare
  const shouldLoadRules = isMatchingVideo || (!savedVideoId && !currentCacheId);
  
  if (!shouldLoadRules) {
    console.log('[TranscriptionRules] Skipping rules load - different video detected');
    console.log('[TranscriptionRules] Saved video ID:', savedVideoId, 'Current video ID:', currentCacheId);
    return null;
  }

  // Fallback to localStorage
  try {
    const savedRules = localStorage.getItem(TRANSCRIPTION_RULES_KEY);
    if (savedRules) {
      const parsedRules = JSON.parse(savedRules);
      globalTranscriptionRules = parsedRules; // Update in-memory rules
      console.log('[TranscriptionRules] Loaded rules for matching video');
      return parsedRules;
    }
  } catch (error) {
    console.error('Error loading transcription rules from localStorage:', error);
  }

  return null;
};

/**
 * Get transcription rules synchronously (for components that can't use async/await)
 * @returns {Object} Transcription rules from memory or localStorage
 */
export const getTranscriptionRulesSync = () => {
  // If rules are in memory, return them
  if (globalTranscriptionRules) {
    return globalTranscriptionRules;
  }

  // Check if the saved rules are for the current video
  const savedVideoId = localStorage.getItem(RULES_VIDEO_ID_KEY);
  const isMatchingVideo = savedVideoId && currentCacheId && savedVideoId === currentCacheId;
  
  // Only load rules if they match the current video or if we don't have video IDs to compare
  // (backwards compatibility for when video ID wasn't tracked)
  const shouldLoadRules = isMatchingVideo || (!savedVideoId && !currentCacheId);
  
  if (!shouldLoadRules) {
    console.log('[TranscriptionRules] Skipping rules load - different video detected');
    console.log('[TranscriptionRules] Saved video ID:', savedVideoId, 'Current video ID:', currentCacheId);
    return null;
  }

  // Fallback to localStorage
  try {
    const savedRules = localStorage.getItem(TRANSCRIPTION_RULES_KEY);
    if (savedRules) {
      const parsedRules = JSON.parse(savedRules);
      globalTranscriptionRules = parsedRules; // Update in-memory rules
      console.log('[TranscriptionRules] Loaded rules for matching video');
      return parsedRules;
    }
  } catch (error) {
    console.error('Error loading transcription rules from localStorage:', error);
  }

  return null;
};

/**
 * Clear transcription rules from memory, cache, and localStorage
 */
export const clearTranscriptionRules = async () => {
  globalTranscriptionRules = null;

  // Clear from localStorage
  localStorage.removeItem(TRANSCRIPTION_RULES_KEY);
  localStorage.removeItem(RULES_VIDEO_ID_KEY);
  
  // Also clear the recommended preset since it's tied to the analysis
  sessionStorage.removeItem('current_session_preset_id');
  sessionStorage.removeItem('last_applied_recommendation');
  sessionStorage.removeItem('current_session_video_fingerprint');
  sessionStorage.removeItem('current_session_prompt');
  localStorage.removeItem('video_analysis_result');

  // Clear from cache if we have a cache ID
  if (currentCacheId) {
    try {
      // We don't have a direct API to delete a specific rule,
      // but we can overwrite it with an empty object
      const response = await fetch(`${API_BASE_URL}/save-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheId: currentCacheId,
          rules: {}
        })
      });

      const result = await response.json();
      if (result.success) {

      }
    } catch (error) {
      console.error('Error clearing transcription rules from cache:', error);
    }
  }

  // Dispatch event to notify components that transcription rules have been cleared
  window.dispatchEvent(new CustomEvent('transcriptionRulesUpdated', {
    detail: { rules: null }
  }));
};
