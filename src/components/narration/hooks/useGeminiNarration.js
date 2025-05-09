import { SERVER_URL } from '../../../config';
import {
  generateGeminiNarrations,
  cancelGeminiNarrations,
  getGeminiLanguageCode
} from '../../../services/gemini/geminiNarrationService';

/**
 * Custom hook for Gemini narration generation
 * @param {Object} params - Parameters
 * @param {Function} params.setIsGenerating - Function to set generating state
 * @param {Function} params.setGenerationStatus - Function to set generation status
 * @param {Function} params.setError - Function to set error message
 * @param {Function} params.setGenerationResults - Function to set generation results
 * @param {Array} params.generationResults - Current generation results
 * @param {string} params.subtitleSource - Selected subtitle source
 * @param {Array} params.originalSubtitles - Original subtitles
 * @param {Array} params.translatedSubtitles - Translated subtitles
 * @param {Array} params.subtitles - Fallback subtitles
 * @param {Object} params.originalLanguage - Original language
 * @param {Object} params.translatedLanguage - Translated language
 * @param {number} params.sleepTime - Sleep time between requests
 * @param {string} params.selectedVoice - Selected voice
 * @param {Function} params.t - Translation function
 * @param {Function} params.setRetryingSubtitleId - Function to set the ID of the subtitle being retried
 * @returns {Object} - Gemini narration handlers
 */
const useGeminiNarration = ({
  setIsGenerating,
  setGenerationStatus,
  setError,
  setGenerationResults,
  generationResults,
  subtitleSource,
  originalSubtitles,
  translatedSubtitles,
  subtitles,
  originalLanguage,
  translatedLanguage,
  sleepTime,
  selectedVoice,
  t,
  setRetryingSubtitleId
}) => {
  // Handle Gemini narration generation
  const handleGeminiNarration = async () => {
    if (!subtitleSource) {
      setError(t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)'));
      return;
    }

    // Get the appropriate subtitles based on the selected source
    const selectedSubtitles = subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0
      ? translatedSubtitles
      : originalSubtitles || subtitles;

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      // If translated subtitles are selected but not available, show a specific error
      if (subtitleSource === 'translated' && (!translatedSubtitles || translatedSubtitles.length === 0)) {
        setError(t('narration.noTranslatedSubtitlesError', 'No translated subtitles available. Please translate the subtitles first or select original subtitles.'));
      } else {
        setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      }
      return;
    }

    // Get the language code for the selected subtitles
    const detectedLanguageCode = subtitleSource === 'original'
      ? (originalLanguage?.languageCode || 'en')
      : (translatedLanguage?.languageCode || 'en');

    // Convert to Gemini-compatible language code
    const language = getGeminiLanguageCode(detectedLanguageCode);

    console.log(`Using language: ${detectedLanguageCode} (Gemini format: ${language}) for Gemini narration`);

    setIsGenerating(true);
    setGenerationStatus(t('narration.preparingGeminiGeneration', 'Preparing to generate narration with Gemini...'));
    setError('');

    try {
      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = selectedSubtitles.map((subtitle, index) => ({
        ...subtitle,
        id: subtitle.id || index + 1
      }));

      // Initialize generationResults with placeholder objects for all subtitles
      const initialResults = subtitlesWithIds.map(subtitle => ({
        subtitle_id: subtitle.id,
        text: subtitle.text,
        success: false,
        pending: true, // Flag to indicate this subtitle is pending generation
        audioData: null,
        filename: null
      }));
      setGenerationResults(initialResults);

      // Generate narration with Gemini
      console.log(`Using Gemini API for narration with sleep time: ${sleepTime}ms and voice: ${selectedVoice}`);

      const response = await generateGeminiNarrations(
        subtitlesWithIds,
        language,
        (message) => setGenerationStatus(message),
        (result, progress, total) => {
          // Update the existing result in the array
          setGenerationResults(prev => {
            return prev.map(item =>
              item.subtitle_id === result.subtitle_id ? { ...result, pending: false } : item
            );
          });

          // Update the status
          setGenerationStatus(
            t(
              'narration.geminiGeneratingProgress',
              'Generated {{progress}} of {{total}} narrations with Gemini...',
              {
                progress,
                total
              }
            )
          );
        },
        (error) => {
          console.error('Error in Gemini narration generation:', error);
          setError(`${t('narration.geminiGenerationError', 'Error generating narration with Gemini')}: ${error.message || error}`);
        },
        (results) => {
          // Update the generation results, marking any pending items as failed
          setGenerationResults(prev => {
            return prev.map(item => {
              // If this item is in the results, use that result
              const resultItem = results.find(r => r.subtitle_id === item.subtitle_id);
              if (resultItem) {
                return { ...resultItem, pending: false };
              }

              // If this item is still pending, mark it as failed
              if (item.pending) {
                return {
                  ...item,
                  pending: false,
                  success: false,
                  error: 'Generation was interrupted'
                };
              }

              // Otherwise, keep the item as is
              return item;
            });
          });

          if (results.length < subtitlesWithIds.length) {
            // Generation was incomplete
            setGenerationStatus(
              t(
                'narration.geminiGenerationIncomplete',
                'Gemini narration generation incomplete. Generated {{generated}} of {{total}} narrations.',
                {
                  generated: results.length,
                  total: subtitlesWithIds.length
                }
              )
            );
            setError(
              t(
                'narration.geminiConnectionError',
                'Connection to Gemini was interrupted. You can retry the failed narrations individually.'
              )
            );
          } else {
            setGenerationStatus(t('narration.geminiGenerationComplete', 'Gemini narration generation complete'));
          }
        },
        null, // Use default model
        sleepTime, // Use the configured sleep time
        selectedVoice // Use the selected voice
      );

      // If the response indicates an incomplete generation, set an error
      if (response && response.incomplete) {
        setError(
          t(
            'narration.geminiConnectionError',
            'Connection to Gemini was interrupted. You can retry the failed narrations individually.'
          )
        );
      }
    } catch (error) {
      console.error('Error generating Gemini narration:', error);
      setError(t('narration.geminiGenerationError', 'Error generating narration with Gemini'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Cancel Gemini narration generation
  const cancelGeminiGeneration = () => {
    // Call the cancel function from the service
    cancelGeminiNarrations();

    // Update UI
    setGenerationStatus(t('narration.geminiGenerationCancelling', 'Cancelling Gemini narration generation...'));

    // We don't set isGenerating to false here because the service will call the completion callback
    // which will set isGenerating to false when it's done
  };

  // Retry Gemini narration generation for a specific subtitle
  const retryGeminiNarration = async (subtitleId) => {
    if (!subtitleSource) {
      setError(t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)'));
      return;
    }

    // Get the appropriate subtitles based on the selected source
    const selectedSubtitles = subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0
      ? translatedSubtitles
      : originalSubtitles || subtitles;

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      return;
    }

    // Find the subtitle with the given ID
    const subtitleToRetry = selectedSubtitles.find(subtitle =>
      (subtitle.id || subtitle.index) === subtitleId
    );

    if (!subtitleToRetry) {
      console.error(`Subtitle with ID ${subtitleId} not found`);
      return;
    }

    // Set retrying state using the function passed from the parent component
    setRetryingSubtitleId(subtitleId);

    // Clear any previous errors
    setError('');

    // Get the language code for the selected subtitles
    const detectedLanguageCode = subtitleSource === 'original'
      ? (originalLanguage?.languageCode || 'en')
      : (translatedLanguage?.languageCode || 'en');

    // Convert to Gemini-compatible language code
    const language = getGeminiLanguageCode(detectedLanguageCode);

    console.log(`Retrying narration for subtitle ${subtitleId} with language: ${language}`);

    // Set status for this specific retry
    setGenerationStatus(t('narration.retryingGeminiGeneration', 'Retrying narration generation for subtitle {{id}}...', { id: subtitleId }));

    try {
      // Prepare subtitle with ID for tracking
      const subtitleWithId = {
        ...subtitleToRetry,
        id: subtitleToRetry.id || subtitleToRetry.index || subtitleId
      };

      // Generate narration with Gemini for this single subtitle
      console.log(`Retrying Gemini narration for subtitle ${subtitleId} with voice: ${selectedVoice}`);

      // Import the generateGeminiNarration function for a single subtitle
      const { generateGeminiNarration } = await import('../../../services/gemini/geminiNarrationService');

      // Generate narration for the single subtitle
      const result = await generateGeminiNarration(subtitleWithId, language, null, selectedVoice);

      // If the result has audio data, save it to the server to get a filename
      if (result.success && result.audioData) {
        try {
          console.log(`Saving retried audio for subtitle ${result.subtitle_id} to server...`);

          // Send the audio data to the server
          const response = await fetch(`${SERVER_URL}/api/narration/save-gemini-audio`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audioData: result.audioData,
              subtitle_id: result.subtitle_id,
              sampleRate: result.sampleRate || 24000,
              mimeType: result.mimeType || 'audio/pcm' // Include MIME type
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              console.log(`Successfully saved retried audio to server: ${data.filename}`);
              // Update the result with the filename
              result.filename = data.filename;
            } else {
              console.error(`Error saving retried audio to server: ${data.error}`);
              setError(t('narration.saveError', 'Error saving audio to server: {{error}}', { error: data.error }));
            }
          } else {
            console.error(`Server returned ${response.status}: ${response.statusText}`);
            setError(t('narration.serverError', 'Server error: {{status}} {{statusText}}', {
              status: response.status,
              statusText: response.statusText
            }));
          }
        } catch (error) {
          console.error(`Error saving retried audio to server for subtitle ${result.subtitle_id}:`, error);
          setError(t('narration.saveError', 'Error saving audio to server: {{error}}', { error: error.message }));
        }
      }

      // Update the results array by replacing the old result with the new one
      setGenerationResults(prevResults => {
        const updatedResults = prevResults.map(prevResult =>
          prevResult.subtitle_id === subtitleId ? result : prevResult
        );

        // Update the global narration references to ensure video player uses the latest version
        if (subtitleSource === 'original') {
          // Update window.originalNarrations
          window.originalNarrations = [...updatedResults];

          // Also update the global narrations array if it exists
          if (window.subtitlesData && window.narrations) {
            // Find and update the narration in the global narrations array
            const globalIndex = window.narrations.findIndex(n => n.subtitle_id === result.subtitle_id);
            if (globalIndex !== -1) {
              window.narrations[globalIndex] = result;
              console.log('Updated window.narrations with retried narration:', result);
            }
          }

          // Also update localStorage
          try {
            // Extract only the necessary information to avoid localStorage quota issues
            const essentialData = updatedResults.map(result => ({
              subtitle_id: result.subtitle_id,
              filename: result.filename,
              success: result.success,
              text: result.text
            }));
            localStorage.setItem('originalNarrations', JSON.stringify(essentialData));
          } catch (e) {
            console.error('Error storing updated originalNarrations in localStorage:', e);
          }
          console.log('Updated window.originalNarrations with retried narration:', result);
        } else {
          // Update window.translatedNarrations
          window.translatedNarrations = [...updatedResults];

          // Also update the global narrations array if it exists
          if (window.subtitlesData && window.narrations) {
            // Find and update the narration in the global narrations array
            const globalIndex = window.narrations.findIndex(n => n.subtitle_id === result.subtitle_id);
            if (globalIndex !== -1) {
              window.narrations[globalIndex] = result;
              console.log('Updated window.narrations with retried narration:', result);
            }
          }

          // Also update localStorage
          try {
            // Extract only the necessary information to avoid localStorage quota issues
            const essentialData = updatedResults.map(result => ({
              subtitle_id: result.subtitle_id,
              filename: result.filename,
              success: result.success,
              text: result.text
            }));
            localStorage.setItem('translatedNarrations', JSON.stringify(essentialData));
          } catch (e) {
            console.error('Error storing updated translatedNarrations in localStorage:', e);
          }
          console.log('Updated window.translatedNarrations with retried narration:', result);
        }

        // Add a timestamp to the result to help identify retried narrations
        result.retriedAt = Date.now();

        // Dispatch a custom event to notify other components about the updated narration
        const event = new CustomEvent('narration-retried', {
          detail: {
            source: subtitleSource,
            narration: result,
            narrations: updatedResults,
            timestamp: Date.now() // Add timestamp to ensure the event is treated as new
          }
        });
        window.dispatchEvent(event);

        // Also dispatch a subtitle-timing-changed event to ensure aligned narration is regenerated
        // This provides a backup mechanism in case the narration-retried event isn't handled
        window.dispatchEvent(new CustomEvent('subtitle-timing-changed', {
          detail: {
            action: 'narration-retry',
            timestamp: Date.now(),
            subtitleId: result.subtitle_id
          }
        }));

        return updatedResults;
      });

      setGenerationStatus(t('narration.retryComplete', 'Retry complete for subtitle {{id}}', { id: subtitleId }));
    } catch (error) {
      console.error(`Error retrying Gemini narration for subtitle ${subtitleId}:`, error);
      setError(t('narration.retryError', 'Error retrying narration for subtitle {{id}}', { id: subtitleId }));
    } finally {
      // Clear retrying state regardless of success or failure
      setRetryingSubtitleId(null);
    }
  };

  return {
    handleGeminiNarration,
    cancelGeminiGeneration,
    retryGeminiNarration
  };
};

export default useGeminiNarration;
