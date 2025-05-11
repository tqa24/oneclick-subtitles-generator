import { useEffect } from 'react';

/**
 * Custom hook for storing narration results
 * @param {Object} params - Parameters
 * @param {Array} params.generationResults - Generation results
 * @param {string} params.subtitleSource - Selected subtitle source
 * @returns {void}
 */
const useNarrationStorage = ({
  generationResults,
  subtitleSource
}) => {
  // Store narration results in window object for access by other components
  useEffect(() => {



    if (generationResults.length > 0) {
      // Store full data in window object for immediate access
      if (subtitleSource === 'original') {
        // Create a new array to ensure reference changes trigger updates
        window.originalNarrations = [...generationResults];

        // No longer storing in localStorage to avoid quota issues

      } else {
        // Create a new array to ensure reference changes trigger updates
        window.translatedNarrations = [...generationResults];

        // No longer storing in localStorage to avoid quota issues

      }

      // Dispatch a custom event to notify other components
      const event = new CustomEvent('narrations-updated', {
        detail: {
          source: subtitleSource,
          narrations: generationResults
        }
      });
      window.dispatchEvent(event);
    }



  }, [generationResults, subtitleSource]);

  // Load previously detected language from localStorage
  const loadDetectedLanguage = () => {
    try {
      const savedLanguageData = localStorage.getItem('detected_language');
      if (savedLanguageData) {
        return JSON.parse(savedLanguageData);
      }
    } catch (error) {
      // Silently fail if data can't be loaded
      console.error('Error loading detected language from localStorage:', error);
    }
    return null;
  };

  return {
    loadDetectedLanguage
  };
};

export default useNarrationStorage;
