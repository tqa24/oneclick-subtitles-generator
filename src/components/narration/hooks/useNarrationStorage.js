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
    console.log('useNarrationStorage - generationResults:', generationResults);
    console.log('useNarrationStorage - subtitleSource:', subtitleSource);

    if (generationResults.length > 0) {
      // Store full data in window object for immediate access
      if (subtitleSource === 'original') {
        // Create a new array to ensure reference changes trigger updates
        window.originalNarrations = [...generationResults];

        // For localStorage, only store essential data (filenames and IDs)
        try {
          // Extract only the necessary information to avoid localStorage quota issues
          const essentialData = generationResults.map(result => ({
            subtitle_id: result.subtitle_id,
            filename: result.filename,
            success: result.success,
            text: result.text
          }));
          localStorage.setItem('originalNarrations', JSON.stringify(essentialData));
        } catch (e) {
          console.error('Error storing originalNarrations in localStorage:', e);
        }
        console.log('useNarrationStorage - Setting window.originalNarrations:', window.originalNarrations);
      } else {
        // Create a new array to ensure reference changes trigger updates
        window.translatedNarrations = [...generationResults];

        // For localStorage, only store essential data (filenames and IDs)
        try {
          // Extract only the necessary information to avoid localStorage quota issues
          const essentialData = generationResults.map(result => ({
            subtitle_id: result.subtitle_id,
            filename: result.filename,
            success: result.success,
            text: result.text
          }));
          localStorage.setItem('translatedNarrations', JSON.stringify(essentialData));
        } catch (e) {
          console.error('Error storing translatedNarrations in localStorage:', e);
        }
        console.log('useNarrationStorage - Setting window.translatedNarrations:', window.translatedNarrations);
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

    console.log('useNarrationStorage - After update - window.originalNarrations:', window.originalNarrations);
    console.log('useNarrationStorage - After update - window.translatedNarrations:', window.translatedNarrations);
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
