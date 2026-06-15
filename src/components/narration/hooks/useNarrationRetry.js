import { generateNarration } from '../../../services/narrationService';
import ISO6391 from 'iso-639-1';
import { deriveSubtitleId } from '../../../utils/subtitle/idUtils';

/**
 * Narration retry handlers: single retry, retry-all-failed, generate-all-pending.
 * @param {Object} params - Parameters
 * @returns {Object} - Retry handlers
 */
const useNarrationRetry = ({
  referenceAudio,
  referenceText,
  setError,
  getSelectedSubtitles,
  advancedSettings,
  setGenerationStatus,
  setGenerationResults,
  generationResults,
  t,
  subtitleSource,
  selectedNarrationModel,
  originalLanguage,
  translatedLanguage,
  setRetryingSubtitleId
}) => {
  // Retry narration generation for a specific subtitle
  const retryF5TTSNarration = async (subtitleId) => {
    if (!referenceAudio) {
      setError(t('narration.noReferenceAudioError', 'Please upload or record reference audio first'));
      return;
    }

    // Get the appropriate subtitles based on the selected source
    // If grouped subtitles are available and enabled, use them instead
    const useGrouped = window.useGroupedSubtitles && window.groupedSubtitles && window.groupedSubtitles.length > 0;
    const selectedSubtitles = useGrouped ? window.groupedSubtitles : getSelectedSubtitles();

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      return;
    }

    // Find the subtitle with the given ID
    const subtitleToRetry = selectedSubtitles.find((subtitle, index) =>
      deriveSubtitleId(subtitle, index) === subtitleId
    );

    if (!subtitleToRetry) {
      console.error(`Subtitle with ID ${subtitleId} not found`);
      return;
    }

    // Set retrying state
    setRetryingSubtitleId(subtitleId);

    // Clear any previous errors
    setError('');

    // Set status for this specific retry
    setGenerationStatus(t('narration.retryingGeneration', 'Retrying narration generation for subtitle {{id}}...', { id: subtitleId }));

    try {
      // CRITICAL FIX: Force reset the aligned narration before retrying
      // This ensures that the aligned narration will be regenerated with the new audio

      if (window.resetAlignedNarration) {
        window.resetAlignedNarration();
      }

      // Prepare subtitle with ID for tracking
      const subtitleWithId = {
        ...subtitleToRetry,
        id: subtitleId, // Use the derived ID which is what's passed in
        // Add a flag to force regeneration of aligned narration
        forceRegenerate: true
      };

      // Get the language code for the selected subtitles
      const detectedLanguageCode = subtitleSource === 'original'
        ? (originalLanguage?.languageCode || 'en')
        : (translatedLanguage?.languageCode || 'en');

      // Convert language code to language name for backend
      const detectedLanguageName = ISO6391.getName(detectedLanguageCode) || 'English';

      // Prepare advanced settings for the API - only include supported parameters
      const apiSettings = {
        // Convert string values to appropriate types
        speechRate: parseFloat(advancedSettings.speechRate),
        nfeStep: parseInt(advancedSettings.nfeStep),
        swayCoef: parseFloat(advancedSettings.swayCoef),
        cfgStrength: parseFloat(advancedSettings.cfgStrength),
        removeSilence: advancedSettings.removeSilence,
        // Include the selected model ID
        modelId: selectedNarrationModel,
        // CRITICAL FIX: Add a flag to skip clearing the output directory
        skipClearOutput: true,
        // Include Gemini API key for text normalization
        gemini_api_key: localStorage.getItem('gemini_api_key'),
        // Include detected language name for text normalization
        language: detectedLanguageName
      };

      // Handle seed
      if (!advancedSettings.useRandomSeed) {
        apiSettings.seed = advancedSettings.seed;
      }

      // Define callbacks for the streaming response
      const handleProgress = (progressData) => {
        let message;
        if (typeof progressData === 'string') {
          message = progressData;
        } else if (progressData?.messageKey) {
          // Handle localized message keys
          switch (progressData.messageKey) {
            case 'processingSubtitle':
              message = t('narration.processingSubtitle', 'Processing subtitle {{current}}/{{total}} (ID: {{id}}) - "{{text}}"', {
                current: progressData.current,
                total: progressData.total,
                id: progressData.subtitle_id,
                text: progressData.subtitle_text
              });
              break;
            default:
              message = progressData.message || 'Processing...';
          }
        } else {
          message = progressData?.message || 'Processing...';
        }
        setGenerationStatus(`${message} (ID: ${subtitleId})`);
      };

      const handleResult = (result) => {
        // Add a flag to force regeneration of aligned narration
        result.forceRegenerate = true;

        // Add a timestamp to the result to help identify retried narrations
        result.retriedAt = Date.now();

        // Update the results array by replacing the old result with the new one
        setGenerationResults(prevResults => {
          let found = false;
          const updatedResults = prevResults.map(prevResult => {
            if (prevResult.subtitle_id === subtitleId) {
              found = true;
              return result;
            }
            return prevResult;
          });
          const finalResults = found ? updatedResults : [...updatedResults, result];

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

          } else {
            // Update window.translatedNarrations
            window.translatedNarrations = [...updatedResults];

            // Also update the global narrations array if it exists
            if (window.subtitlesData && window.narrations) {
              // Find and update the narration in the global narrations array
              const globalIndex = window.narrations.findIndex(n => n.subtitle_id === result.subtitle_id);
              if (globalIndex !== -1) {
                window.narrations[globalIndex] = result;

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

          }

          // Dispatch a custom event to notify other components about the updated narration
          const event = new CustomEvent('narration-retried', {
            detail: {
              source: subtitleSource,
              narration: result,
              narrations: updatedResults,
              timestamp: Date.now(), // Add timestamp to ensure the event is treated as new
              forceRegenerate: true // Add flag to force regeneration of aligned narration
            }
          });
          window.dispatchEvent(event);

          // Removed automatic regeneration of aligned narration
          // Users must now manually click the "Refresh Narration" button to regenerate aligned narration

          return updatedResults;
        });
      };

      const handleError = (error) => {
        console.error(`Error retrying narration for subtitle ${subtitleId}:`, error);
        setError(t('narration.retryError', 'Error retrying narration for subtitle {{id}}', { id: subtitleId }));
      };

      // Generate narration for the single subtitle
      await generateNarration(
        referenceAudio.filepath,
        referenceAudio.text || referenceText,
        [subtitleWithId], // Pass as an array with a single subtitle
        apiSettings,
        handleProgress,
        handleResult,
        handleError,
        () => {
          setGenerationStatus(t('narration.retryComplete', 'Retry complete for subtitle {{id}}', { id: subtitleId }));
        }
      );
    } catch (error) {
      console.error(`Error retrying narration for subtitle ${subtitleId}:`, error);
      setError(t('narration.retryError', 'Error retrying narration for subtitle {{id}}', { id: subtitleId }));
    } finally {
      // Clear retrying state regardless of success or failure
      setRetryingSubtitleId(null);
    }
  };

  // Retry all failed narrations
  const retryFailedNarrations = async () => {
    if (!referenceAudio) {
      setError(t('narration.noReferenceAudioError', 'Please upload or record reference audio first'));
      return;
    }

    // Get the appropriate subtitles based on the selected source
    const selectedSubtitles = getSelectedSubtitles();

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      return;
    }

    // Find all failed narrations (exclude pending items)
    const failedNarrations = generationResults.filter(result => !result.success && !result.pending);

    if (failedNarrations.length === 0) {
      setError(t('narration.noFailedNarrationsError', 'No failed narrations to retry'));
      return;
    }

    // Clear any previous errors
    setError('');

    // Set status for retrying failed narrations
    setGenerationStatus(t('narration.retryingFailedNarrations', 'Retrying {{count}} failed narrations...', { count: failedNarrations.length }));

    // Process each failed narration one by one
    for (let i = 0; i < failedNarrations.length; i++) {
      const failedNarration = failedNarrations[i];
      const subtitleId = failedNarration.subtitle_id;

      // Find the subtitle with the given ID
      const subtitleToRetry = selectedSubtitles.find((subtitle, index) =>
        deriveSubtitleId(subtitle, index) === subtitleId
      );

      if (!subtitleToRetry) {
        console.error(`Subtitle with ID ${subtitleId} not found`);
        continue;
      }

      // Set retrying state
      setRetryingSubtitleId(subtitleId);

      // Update status
      setGenerationStatus(t('narration.retryingFailedNarrationProgress', 'Retrying failed narration {{current}} of {{total}} (ID: {{id}})...', {
        current: i + 1,
        total: failedNarrations.length,
        id: subtitleId
      }));

      try {
        // For F5-TTS models
        // CRITICAL FIX: Force reset the aligned narration before retrying

        if (window.resetAlignedNarration) {
          window.resetAlignedNarration();
        }

        // Prepare subtitle with ID for tracking
        const subtitleWithId = {
          ...subtitleToRetry,
          id: subtitleToRetry.id || subtitleToRetry.index || subtitleId,
          forceRegenerate: true
        };

        // Get the language code for the selected subtitles
        const detectedLanguageCode = subtitleSource === 'original'
          ? (originalLanguage?.languageCode || 'en')
          : (translatedLanguage?.languageCode || 'en');

        // Convert language code to language name for backend
        const detectedLanguageName = ISO6391.getName(detectedLanguageCode) || 'English';

        // Prepare advanced settings for the API
        const apiSettings = {
          speechRate: parseFloat(advancedSettings.speechRate),
          nfeStep: parseInt(advancedSettings.nfeStep),
          swayCoef: parseFloat(advancedSettings.swayCoef),
          cfgStrength: parseFloat(advancedSettings.cfgStrength),
          removeSilence: advancedSettings.removeSilence,
          modelId: selectedNarrationModel,
          skipClearOutput: true,
          // Include Gemini API key for text normalization
          gemini_api_key: localStorage.getItem('gemini_api_key'),
          // Include detected language name for text normalization
          language: detectedLanguageName
        };

        // Handle seed
        if (!advancedSettings.useRandomSeed) {
          apiSettings.seed = advancedSettings.seed;
        }

        // Import the narration service functions
        const { generateNarration } = await import('../../../services/narrationService');

        // Generate narration for the single subtitle
        await generateNarration(
          referenceAudio.filepath,
          referenceAudio.text || referenceText,
          [subtitleWithId], // Pass as an array with a single subtitle
          apiSettings,
          (progressData) => {
            let message;
            if (typeof progressData === 'string') {
              message = progressData;
            } else if (progressData?.messageKey) {
              // Handle localized message keys
              switch (progressData.messageKey) {
                case 'processingSubtitle':
                  message = t('narration.processingSubtitle', 'Processing subtitle {{current}}/{{total}} (ID: {{id}}) - "{{text}}"', {
                    current: progressData.current,
                    total: progressData.total,
                    id: progressData.subtitle_id,
                    text: progressData.subtitle_text
                  });
                  break;
                default:
                  message = progressData.message || 'Processing...';
              }
            } else {
              message = progressData?.message || 'Processing...';
            }
            setGenerationStatus(`${message} (ID: ${subtitleId})`);
          },
          (result) => {
            // Add flags and timestamp
            result.forceRegenerate = true;
            result.retriedAt = Date.now();

            // Update the results array
            setGenerationResults(prevResults => {
              const updatedResults = prevResults.map(prevResult =>
                prevResult.subtitle_id === subtitleId ? result : prevResult
              );

              // Update global references
              if (subtitleSource === 'original') {
                window.originalNarrations = [...updatedResults];
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
              } else {
                window.translatedNarrations = [...updatedResults];
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
              }

              // Dispatch events
              window.dispatchEvent(new CustomEvent('narration-retried', {
                detail: {
                  source: subtitleSource,
                  narration: result,
                  narrations: updatedResults,
                  timestamp: Date.now(),
                  forceRegenerate: true
                }
              }));

              // Removed automatic regeneration of aligned narration
              // Users must now manually click the "Refresh Narration" button to regenerate aligned narration

              return updatedResults;
            });
          },
          (error) => {
            console.error(`Error retrying narration for subtitle ${subtitleId}:`, error);
          },
          () => {
            setGenerationStatus(t('narration.retryComplete', 'Retry complete for subtitle {{id}}', { id: subtitleId }));
          }
        );

        // Add a small delay between retries to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error retrying narration for subtitle ${subtitleId}:`, error);
        // Continue with the next failed narration
      }
    }

    // Clear retrying state
    setRetryingSubtitleId(null);

    // Update status
    setGenerationStatus(t('narration.retryingFailedNarrationsComplete', 'Completed retrying all failed narrations'));
  };

  // Generate all pending narrations
  const generateAllPendingF5TTSNarrations = async () => {
    if (!referenceAudio) {
      setError(t('narration.noReferenceAudioError', 'Please upload or record reference audio first'));
      return;
    }

    // Get the appropriate subtitles based on the selected source
    const selectedSubtitles = getSelectedSubtitles();

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      return;
    }

    // Find all pending narrations based on selectedSubtitles and generationResults
    const pendingSubtitles = selectedSubtitles.filter(subtitle => {
      const subtitleId = subtitle.id || subtitle.index;
      const existingResult = generationResults.find(result => result.subtitle_id === subtitleId);
      return !existingResult || (!existingResult.success && existingResult.pending);
    });

    if (pendingSubtitles.length === 0) {
      setError(t('narration.noPendingNarrationsError', 'No pending narrations to generate'));
      return;
    }

    // Clear any previous errors
    setError('');

    // Set status for generating pending narrations
    setGenerationStatus(t('narration.generatingPendingNarrations', 'Generating {{count}} pending narrations...', { count: pendingSubtitles.length }));

    // Process each pending narration one by one
    for (let i = 0; i < pendingSubtitles.length; i++) {
      const subtitle = pendingSubtitles[i];
      const subtitleId = subtitle.id || subtitle.index;

      await retryF5TTSNarration(subtitleId);

      // Add a small delay between generations to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update status
    setGenerationStatus(t('narration.generatingPendingNarrationsComplete', 'Completed generating all pending narrations'));
  };

  return {
    retryF5TTSNarration,
    retryFailedNarrations,
    generateAllPendingF5TTSNarrations
  };
};

export default useNarrationRetry;
