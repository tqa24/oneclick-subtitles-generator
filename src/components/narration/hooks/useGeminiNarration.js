import { useEffect } from 'react';
import {
  generateGeminiNarrations,
  cancelGeminiNarrations,
  getGeminiLanguageCode
} from '../../../services/gemini/geminiNarrationService';
import { deriveSubtitleId } from '../../../utils/subtitle/idUtils';
import { cleanupOldSubtitleDirectories } from '../utils/subtitleDirectoryCleanup';
import useGeminiSubtitleGrouping from './useGeminiSubtitleGrouping';
import useGeminiNarrationRetry from './useGeminiNarrationRetry';

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
 * @param {string} params.selectedVoice - Selected voice
 * @param {number} params.concurrentClients - Number of concurrent WebSocket clients
 * @param {boolean} params.useGroupedSubtitles - Whether to use grouped subtitles for narration
 * @param {Array} params.groupedSubtitles - Grouped subtitles
 * @param {Function} params.setGroupedSubtitles - Function to set grouped subtitles
 * @param {boolean} params.isGroupingSubtitles - Whether subtitles are currently being grouped
 * @param {Function} params.setIsGroupingSubtitles - Function to set whether subtitles are being grouped
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
  selectedVoice,
  concurrentClients,
  useGroupedSubtitles,
  setUseGroupedSubtitles,
  groupedSubtitles,
  setGroupedSubtitles,
  isGroupingSubtitles,
  setIsGroupingSubtitles,
  groupingIntensity = 'moderate',
  t,
  setRetryingSubtitleId
}) => {
  // Listen for the gemini-narration events (started and cancelled)
  useEffect(() => {
    const handleNarrationStarted = (event) => {
      console.log("Received gemini-narration-started event", event.detail);
      setIsGenerating(true);
      setGenerationStatus(t('narration.preparingGeminiGeneration', 'Preparing to generate narration with Gemini...'));
    };

    const handleNarrationCancelled = () => {
      console.log("Received gemini-narration-cancelled event");
      setIsGenerating(false);
      setGenerationStatus(t('narration.geminiGenerationCancelled', 'Gemini narration generation cancelled'));

      // Mark any pending narrations as cancelled
      setGenerationResults(prev => {
        return prev.map(item => {
          if (item.pending) {
            return {
              ...item,
              pending: false,
              success: false,
              error: t('narration.generationCancelled', 'Generation was cancelled')
            };
          }
          return item;
        });
      });
    };

    // Add event listeners
    window.addEventListener('gemini-narration-started', handleNarrationStarted);
    window.addEventListener('gemini-narration-cancelled', handleNarrationCancelled);

    // Clean up
    return () => {
      window.removeEventListener('gemini-narration-started', handleNarrationStarted);
      window.removeEventListener('gemini-narration-cancelled', handleNarrationCancelled);
    };
  }, [t, setIsGenerating, setGenerationStatus, setGenerationResults]);
  // Handle Gemini narration generation
  const handleGeminiNarration = async () => {
    // Clear all caches and files for fresh generation
    const { clearNarrationCachesAndFiles } = await import('../utils/cacheManager');
    await clearNarrationCachesAndFiles(setGenerationResults);

    if (!subtitleSource) {
      setError(t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)'));
      return;
    }

    // Validate that language has been detected for the selected source (Gemini-specific requirement)
    const selectedLanguage = subtitleSource === 'original' ? originalLanguage : translatedLanguage;
    if (!selectedLanguage || !selectedLanguage.languageCode) {
      const sourceName = subtitleSource === 'original'
        ? t('narration.originalSubtitles', 'Original Subtitles')
        : t('narration.translatedSubtitles', 'Translated Subtitles');
      setError(t('narration.languageNotDetectedError', 'Please select language for {{source}} subtitles in the "Subtitle Source" section', { source: sourceName }));
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



    // We'll set isGenerating to true here, but it will also be set by the event listener
    // This ensures the UI updates immediately
    setIsGenerating(true);
    setGenerationStatus(t('narration.preparingGeminiGeneration', 'Preparing to generate narration with Gemini...'));
    setError('');

    try {
      // Determine which subtitles to use based on whether we're using grouped subtitles
      let subtitlesToUse = selectedSubtitles;

      if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
        // Use the grouped subtitles if available
        subtitlesToUse = groupedSubtitles;

        console.log(`Using ${subtitlesToUse.length} grouped subtitles instead of ${selectedSubtitles.length} original subtitles`);
      }

      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = subtitlesToUse.map((subtitle, index) => ({
        ...subtitle,
        id: deriveSubtitleId(subtitle, index)
      }));

      // Initialize generationResults with placeholder objects for all subtitles
      const initialResults = subtitlesWithIds.map(subtitle => ({
        subtitle_id: subtitle.id,
        text: subtitle.text,
        success: false,
        pending: true, // Flag to indicate this subtitle is pending generation
        audioData: null,
        filename: null,
        // If this is a grouped subtitle, include the original IDs
        original_ids: subtitle.original_ids || [subtitle.id],
        // Add start and end times for proper audio alignment
        start: subtitle.start,
        end: subtitle.end
      }));
      setGenerationResults(initialResults);

      // Update state immediately if we're generating grouped subtitles
      if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
        // Store the initial results as grouped narrations in window object
        window.groupedNarrations = [...initialResults];
        window.useGroupedSubtitles = true;
        // Update the React state to reflect that we're now using grouped subtitles
        setUseGroupedSubtitles(true);
        console.log(`Updated state to use grouped subtitles immediately at generation start`);
      }

      // Generate narration with Gemini
      setGenerationStatus(t('narration.preparingGeneration', 'Preparing to generate narration...'));

      // Update the client pool size based on the concurrentClients setting
      localStorage.setItem('gemini_concurrent_clients', concurrentClients.toString());

      const response = await generateGeminiNarrations(
        subtitlesWithIds,
        language,
        (message) => {
          console.log("Progress update:", message);
          setGenerationStatus(message);

          // We'll only set isGenerating to false in the onComplete callback
          // This ensures the Cancel button stays visible until all narrations are complete
        },
        (result, progress, total) => {
          console.log(`Result received for subtitle ${result.subtitle_id}, progress: ${progress}/${total}`);

          // Update the existing result in the array
          setGenerationResults(prev => {
            const updatedResults = prev.map(item =>
              item.subtitle_id === result.subtitle_id ? {
                ...result,
                pending: false,
                success: result.success !== false && (result.audioData || result.filename || result.success)
              } : item
            );

            // Update window.groupedNarrations incrementally if we're generating grouped subtitles
            if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
              window.groupedNarrations = [...updatedResults];
            }

            return updatedResults;
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
          setIsGenerating(false);
        },
        (results) => {
          console.log("Generation complete, total results:", results.length);

          // Update the generation results, marking any pending items as failed
          setGenerationResults(prev => {
            const updatedResults = prev.map(item => {
              // If this item is in the results, use that result
              const resultItem = results.find(r => r.subtitle_id === item.subtitle_id);
              if (resultItem) {
                return {
                  ...resultItem,
                  pending: false,
                  success: resultItem.success !== false && (resultItem.audioData || resultItem.filename || resultItem.success)
                };
              }

              // If this item is still pending, mark it as failed
              if (item.pending) {
                return {
                  ...item,
                  pending: false,
                  success: false,
                  error: t('narration.generationInterrupted', 'Generation was interrupted')
                };
              }

              // Otherwise, keep the item as is
              return item;
            });

            // Store the results in the window object
            if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
              // Store as grouped narrations
              window.groupedNarrations = [...updatedResults];
              // Also store the flag to indicate we're using grouped subtitles
              window.useGroupedSubtitles = true;
              // Update the React state to reflect that we're now using grouped subtitles
              setUseGroupedSubtitles(true);

              // Clean up old subtitle directories for grouped narrations
              console.log('Gemini: Detected grouped subtitles, cleaning up old directories');
              cleanupOldSubtitleDirectories(groupedSubtitles);
            } else {
              // Store as original narrations
              if (subtitleSource === 'original') {
                window.originalNarrations = [...updatedResults];
              } else {
                window.translatedNarrations = [...updatedResults];
              }
              // Set the flag to false
              window.useGroupedSubtitles = false;
            }

            return updatedResults;
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

          // Ensure isGenerating is set to false when complete
          setIsGenerating(false);
        },
        null, // Use default model
        0, // No sleep time
        selectedVoice, // Use the selected voice
        t('narration.preparingGeminiGeneration', 'Preparing to generate narration with Gemini...') // Translated initial progress message
      );

      // Handle the pending response from our concurrent implementation
      if (response && response.pending) {
        console.log("Narration generation started in background mode");
        // Keep isGenerating true since the generation is happening in the background
        // The callbacks will handle setting isGenerating to false when complete
      } else if (response && response.incomplete) {
        setError(
          t(
            'narration.geminiConnectionError',
            'Connection to Gemini was interrupted. You can retry the failed narrations individually.'
          )
        );
        setIsGenerating(false);
      }
    } catch (error) {
      console.error('Error generating Gemini narration:', error);
      setError(t('narration.geminiGenerationError', 'Error generating narration with Gemini'));
      setIsGenerating(false);
    }
    // Note: We don't set isGenerating to false in the finally block anymore
    // because our concurrent implementation will set it to false when all narrations are complete
    // through the callbacks
  };

  // Cancel Gemini narration generation
  const cancelGeminiGeneration = () => {
    console.log("Cancelling Gemini narration generation");

    // Call the cancel function from the service
    cancelGeminiNarrations();

    // Update UI
    setGenerationStatus(t('narration.geminiGenerationCancelling', 'Cancelling Gemini narration generation...'));

    // Mark any pending narrations as cancelled
    setGenerationResults(prev => {
      return prev.map(item => {
        if (item.pending) {
          return {
            ...item,
            pending: false,
            success: false,
            error: t('narration.generationCancelled', 'Generation was cancelled')
          };
        }
        return item;
      });
    });

    // Explicitly set isGenerating to false to ensure the Cancel button disappears
    // This is important because the completion callback might not be called if the WebSocket is closed
    setTimeout(() => {
      setIsGenerating(false);
      setGenerationStatus(t('narration.geminiGenerationCancelled', 'Gemini narration generation cancelled'));

      // Dispatch a custom event to notify other components
      const event = new CustomEvent('gemini-narration-cancelled', {
        detail: {
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }, 500); // Short delay to allow the UI to update
  };

  // Compose subtitle grouping behavior (groupSubtitles + its effects + local error state)
  const { groupSubtitles } = useGeminiSubtitleGrouping({
    setError,
    setGenerationStatus,
    subtitleSource,
    originalSubtitles,
    translatedSubtitles,
    subtitles,
    originalLanguage,
    translatedLanguage,
    useGroupedSubtitles,
    setUseGroupedSubtitles,
    groupedSubtitles,
    setGroupedSubtitles,
    setIsGroupingSubtitles,
    groupingIntensity,
    t
  });

  // Compose retry / pending generation handlers
  const {
    retryGeminiNarration,
    retryFailedGeminiNarrations,
    generateAllPendingGeminiNarrations
  } = useGeminiNarrationRetry({
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
    selectedVoice,
    concurrentClients,
    useGroupedSubtitles,
    setUseGroupedSubtitles,
    groupedSubtitles,
    t,
    setRetryingSubtitleId
  });

  return {
    handleGeminiNarration,
    cancelGeminiGeneration,
    retryGeminiNarration,
    retryFailedGeminiNarrations,
    generateAllPendingGeminiNarrations,
    groupSubtitles
  };
};

export default useGeminiNarration;
