import { useCallback } from 'react';
import { SERVER_URL } from '../../../config';
import { deriveSubtitleId } from '../../../utils/subtitle/idUtils';
import { consumeNarrationSSE } from '../utils/narrationSSE';

/**
 * Retry-focused gTTS narration handlers, split out of useGTTSNarration for maintainability.
 *
 * Exposes the subtitle-selection helper (shared with the main generation hook) plus the
 * single-subtitle retry, retry-all-failed, and generate-all-pending handlers.
 *
 * @param {Object} params - Parameters
 * @param {Function} params.setError - Function to set error message
 * @param {Function} params.setGenerationResults - Function to set generation results
 * @param {Function} params.setGenerationStatus - Function to set generation status
 * @param {Function} params.setIsGenerating - Function to set generating state
 * @param {Array} params.generationResults - Current generation results
 * @param {string} params.subtitleSource - Selected subtitle source
 * @param {Array} params.originalSubtitles - Original subtitles
 * @param {Array} params.translatedSubtitles - Translated subtitles
 * @param {Array} params.subtitles - Fallback subtitles
 * @param {string} params.selectedLanguage - Selected gTTS language
 * @param {string} params.tld - Top-level domain for accent
 * @param {boolean} params.slow - Whether to speak slowly
 * @param {Function} params.t - Translation function
 * @param {Function} params.setRetryingSubtitleId - Function to set retrying subtitle ID
 * @param {boolean} params.useGroupedSubtitles - Whether grouped subtitles are in use
 * @param {Array} params.groupedSubtitles - Grouped subtitles
 * @param {Array} params.plannedSubtitles - Planned subtitles for pending generation
 * @returns {Object} - Retry handlers plus the shared getSubtitlesForGeneration helper
 */
const useGTTSNarrationRetry = ({
  setError,
  setGenerationResults,
  setGenerationStatus,
  setIsGenerating,
  generationResults,
  subtitleSource,
  originalSubtitles,
  translatedSubtitles,
  subtitles,
  selectedLanguage,
  tld,
  slow,
  t,
  setRetryingSubtitleId,
  useGroupedSubtitles,
  groupedSubtitles,
  plannedSubtitles
}) => {
  /**
   * Get the appropriate subtitles based on source and grouping
   */
  const getSubtitlesForGeneration = useCallback(() => {
    // If using grouped subtitles, return them instead of individual subtitles
    if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
      console.log(`gTTS: Using ${groupedSubtitles.length} grouped subtitles`);
      return groupedSubtitles;
    }

    // Otherwise, return individual subtitles based on source
    if (subtitleSource === 'original' && originalSubtitles?.length > 0) {
      return originalSubtitles;
    } else if (subtitleSource === 'translated' && translatedSubtitles?.length > 0) {
      return translatedSubtitles;
    } else if (subtitles?.length > 0) {
      return subtitles;
    }
    return [];
  }, [subtitleSource, originalSubtitles, translatedSubtitles, subtitles, useGroupedSubtitles, groupedSubtitles]);

  /**
   * Retry gTTS narration for a specific subtitle
   */
  const retryGTTSNarration = useCallback(async (subtitleId) => {
    const subtitlesToProcess = getSubtitlesForGeneration();
    const subtitle = subtitlesToProcess.find((sub, idx) => deriveSubtitleId(sub, idx) === subtitleId);

    if (!subtitle) {
      setError(t('narration.subtitleNotFoundError', 'Subtitle not found for retry.'));
      return;
    }

    if (!selectedLanguage) {
      setError(t('narration.noLanguageSelectedError', 'Please select a language for gTTS.'));
      return;
    }

    try {
      setRetryingSubtitleId(subtitleId);

      const settings = {
        lang: selectedLanguage,
        tld: tld || 'com',
        slow: slow || false
      };

      const requestBody = {
        subtitles: [{
          ...subtitle,
          id: subtitleId // Use the ID expected by the server
        }],
        settings: settings
      };

      const response = await fetch(`${SERVER_URL}/api/narration/gtts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await consumeNarrationSSE(response, (data) => {
        if (data.status === 'completed' && data.results?.length > 0) {
          const newResult = {
            ...data.results[0],
            pending: false // Completed retry results are no longer pending
          };

          // Update the specific result in the generation results (append if missing)
          setGenerationResults(prev => {
            let found = false;
            const updated = prev.map(result => {
              if (result.subtitle_id === subtitleId) {
                found = true;
                return newResult;
              }
              return result;
            });
            return found ? updated : [...updated, newResult];
          });
        }
      });

    } catch (error) {
      console.error('gTTS retry error:', error);
      setError(t('narration.gttsRetryError', 'Error retrying gTTS narration: {{error}}', { error: error.message }));
    } finally {
      setRetryingSubtitleId(null);
    }
  }, [
    getSubtitlesForGeneration,
    selectedLanguage,
    tld,
    slow,
    setError,
    setGenerationResults,
    setRetryingSubtitleId,
    t
  ]);

  /**
   * Retry all failed gTTS narrations
   */
  const retryFailedGTTSNarrations = useCallback(async () => {
    const failedResults = generationResults.filter(result => !result.success && !result.pending);

    if (failedResults.length === 0) {
      return;
    }

    const subtitlesToProcess = getSubtitlesForGeneration();
    const failedSubtitles = failedResults.map(result =>
      subtitlesToProcess.find((sub, idx) => deriveSubtitleId(sub, idx) === result.subtitle_id)
    ).filter(Boolean);

    if (failedSubtitles.length === 0) {
      setError(t('narration.noFailedSubtitlesError', 'No failed subtitles found for retry.'));
      return;
    }

    try {
      setIsGenerating(true);
      setError('');

      const settings = {
        lang: selectedLanguage,
        tld: tld || 'com',
        slow: slow || false
      };

      const requestBody = {
        subtitles: failedSubtitles.map(sub => {
          const originalIdx = subtitlesToProcess.indexOf(sub);
          return {
            ...sub,
            id: deriveSubtitleId(sub, originalIdx)
          };
        }),
        settings: settings
      };

      setGenerationStatus(t('narration.gttsRetryingFailed', 'Retrying failed gTTS narrations...'));

      const response = await fetch(`${SERVER_URL}/api/narration/gtts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await consumeNarrationSSE(response, (data) => {
        if (data.status === 'progress' && data.result) {
          // Update the specific result in the generation results
          const processedResult = {
            ...data.result,
            pending: false // Completed retry results are no longer pending
          };
          setGenerationResults(prev =>
            prev.map(result =>
              result.subtitle_id === processedResult.subtitle_id ? processedResult : result
            )
          );
        } else if (data.status === 'completed') {
          setGenerationStatus(t('narration.gttsRetryComplete', 'gTTS retry completed!'));
        }
      });

    } catch (error) {
      console.error('gTTS retry failed error:', error);
      setError(t('narration.gttsRetryFailedError', 'Error retrying failed gTTS narrations: {{error}}', { error: error.message }));
    } finally {
      setIsGenerating(false);
    }
  }, [
    generationResults,
    getSubtitlesForGeneration,
    selectedLanguage,
    tld,
    slow,
    setIsGenerating,
    setError,
    setGenerationResults,
    setGenerationStatus,
    t
  ]);

  /**
   * Generate all pending gTTS narrations
   */
  const generateAllPendingGTTSNarrations = useCallback(async () => {
    try {
      setIsGenerating(true);

      // Get all planned subtitles (passed from parent component)
      const trueSubtitles = plannedSubtitles || [];

      if (trueSubtitles.length === 0) {
        return;
      }

      // Find subtitles that don't have results yet (pending)
      const completedIds = new Set();
      if (generationResults && generationResults.length > 0) {
        generationResults.forEach(result => {
          if (result.success) {
            completedIds.add(result.subtitle_id);
          }
        });
      }

      // Get pending subtitle IDs
      const pendingSubtitleIds = trueSubtitles
        .map(subtitle => subtitle.id ?? subtitle.subtitle_id ?? trueSubtitles.indexOf(subtitle))
        .filter(id => !completedIds.has(id));

      if (pendingSubtitleIds.length === 0) {
        return;
      }

      setError('');
      setGenerationStatus(t('narration.generatingPendingNarrations', 'Generating {{count}} pending narrations...', { count: pendingSubtitleIds.length }));

      // Generate each pending narration sequentially using the retry function
      for (const subtitleId of pendingSubtitleIds) {
        await retryGTTSNarration(subtitleId);

        // Add a small delay between generations to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update status
      setGenerationStatus(t('narration.generatingPendingNarrationsComplete', 'Completed generating all pending narrations'));
    } catch (error) {
      console.error('Error generating pending gTTS narrations:', error);
      setError(t('narration.generateAllPendingError', 'Error generating pending narrations: {{error}}', {
        error: error.message
      }));
    } finally {
      setIsGenerating(false);
    }
  }, [
    setIsGenerating,
    generationResults,
    plannedSubtitles,
    retryGTTSNarration,
    setError,
    setGenerationStatus,
    t
  ]);

  return {
    getSubtitlesForGeneration,
    retryGTTSNarration,
    retryFailedGTTSNarrations,
    generateAllPendingGTTSNarrations
  };
};

export default useGTTSNarrationRetry;
