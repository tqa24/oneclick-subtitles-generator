import {
  generateNarration,
  cancelNarrationGeneration
} from '../../../services/narrationService';
import { isModelAvailable } from '../../../services/modelAvailabilityService';
import ISO6391 from 'iso-639-1';
import { deriveSubtitleId } from '../../../utils/subtitle/idUtils';
import { hydrateNarrationResultsForAlignment } from '../../../utils/narrationAlignmentUtils';
import useNarrationDownloads from './useNarrationDownloads';
import useAlignedDownload from './useAlignedDownload';

/**
 * Narration generation + download handlers.
 *
 * Owns the F5-TTS generation flow (handleGenerateNarration) and cancellation; composes the
 * playback/bulk-download (useNarrationDownloads) and aligned-download (useAlignedDownload) pieces
 * so the returned handler shape stays stable for the parent composer.
 *
 * @param {Object} params - Parameters
 * @returns {Object} - Generation/download handlers
 */
const useNarrationGeneration = ({
  referenceAudio,
  referenceText,
  setError,
  getSelectedSubtitles,
  advancedSettings,
  setIsGenerating,
  isGenerating,
  setGenerationStatus,
  setGenerationResults,
  generationResults,
  currentAudio,
  setCurrentAudio,
  setIsPlaying,
  t,
  subtitleSource,
  translatedSubtitles,
  isPlaying,
  selectedNarrationModel,
  originalLanguage,
  translatedLanguage,
  useGroupedSubtitles,
  setUseGroupedSubtitles,
  groupedSubtitles
}) => {
  // Generate narration for all subtitles
  const handleGenerateNarration = async () => {
    // Clear browser caches quickly (non-blocking) to avoid UI flicker; skip wiping UI
    const { clearBrowserCaches } = await import('../utils/cacheManager');
    try { clearBrowserCaches(); } catch (e) { /* ignore */ }

    if (!referenceAudio || !referenceAudio.filepath) {
      setError(t('narration.noReferenceError', 'Please set up reference audio using one of the options above'));
      return;
    }

    // Check if a subtitle source has been selected
    if (!subtitleSource) {
      setError(t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)'));
      return;
    }

    // Get the appropriate subtitles based on the selected source
    // If grouped subtitles are available and enabled, use them instead
    const useGrouped = !!(useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0);
    const selectedSubtitles = useGrouped ? groupedSubtitles : getSelectedSubtitles();

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      // If translated subtitles are selected but not available, show a specific error
      if (subtitleSource === 'translated' && (!translatedSubtitles || translatedSubtitles.length === 0)) {
        setError(t('narration.noTranslatedSubtitlesError', 'No translated subtitles available. Please translate the subtitles first or select original subtitles.'));
      } else {
        setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      }
      return;
    }

    // Check if the selected model is available
    try {
      // Get the model ID from the selectedNarrationModel prop or use the default
      const modelId = selectedNarrationModel || 'f5tts-v1-base';

      // Check if the model is available
      const modelAvailable = await isModelAvailable(modelId);
      if (!modelAvailable) {
        // Get the language from the selected subtitles
        const subtitles = getSelectedSubtitles();
        let language = 'unknown';

        if (subtitles && subtitles.length > 0) {
          // Try to determine the language from the subtitles
          if (subtitleSource === 'original' && originalLanguage) {
            language = originalLanguage.languageName || originalLanguage.languageCode;
          } else if (subtitleSource === 'translated' && translatedLanguage) {
            language = translatedLanguage.languageName || translatedLanguage.languageCode;
          }
        }

        setError(t('narration.modelNotAvailableError', 'Please download at least one model that supports {{language}} from the Narration Model Management tab in Settings.', { language }));
        return;
      }
    } catch (error) {
      console.error('Error checking model availability:', error);
      // Continue anyway, the server will handle the error if the model is not available
    }

    setIsGenerating(true);
    setGenerationStatus(t('narration.preparingGeneration', 'Preparing to generate narration...'));
    setError('');
    // Do not clear results here; we will immediately seed full pending list like Gemini

    try {
      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = selectedSubtitles.map((subtitle, index) => ({
        ...subtitle,
        id: deriveSubtitleId(subtitle, index)
      }));

      // Update state immediately if we're generating grouped subtitles
      if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
        // Initialize empty grouped narrations in window object
        window.groupedNarrations = [];
        window.useGroupedSubtitles = true;
        // Update the React state to reflect that we're now using grouped subtitles
        setUseGroupedSubtitles(true);
        console.log(`Updated state to use grouped subtitles immediately at F5-TTS generation start`);
      }

      // Add subtitle source to generation status message
      const sourceText = subtitleSource === 'original' ?
        t('narration.originalSubtitles', 'original subtitles') :
        t('narration.translatedSubtitles', 'translated subtitles');

      setGenerationStatus(
        t('narration.generatingNarrationWithSource', 'Generating narration for {{count}} {{source}}...', {
          count: subtitlesWithIds.length,
          source: sourceText
        })
      );

      // Initialize UI with full pending list like Gemini flow
      const initialResults = subtitlesWithIds.map((sub, index) => ({
        subtitle_id: sub.id,
        text: sub.text,
        success: false,
        pending: true,
        audioData: null,
        filename: null,
        outputIndex: index + 1,
        // preserve grouping info and timing if present
        original_ids: sub.original_ids || [sub.id],
        start: sub.start,
        end: sub.end
      }));
      setGenerationResults(initialResults);
      // Temporary working copy we update as results stream in
      let tempResults = [...initialResults];
      if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
        window.groupedNarrations = [...initialResults];
        window.useGroupedSubtitles = true;
      }

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
        // Note: sampleRate is not sent to the API as it's not supported by F5-TTS
        // It's only used in the UI for user preference
        batchSize: advancedSettings.batchSize === 'all' ? subtitlesWithIds.length : parseInt(advancedSettings.batchSize),
        // Include the selected model ID
        modelId: selectedNarrationModel,
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
        // Handle both old format (string) and new format (object)
        let statusMessage;

        if (typeof progressData === 'string') {
          // Old format - direct string message
          statusMessage = progressData;
        } else if (typeof progressData === 'object') {
          // New format - object with messageKey or message
          if (progressData.messageKey) {
            // Handle localized message keys
            switch (progressData.messageKey) {
              case 'initializingService':
                statusMessage = t('narration.initializingService', 'Waking up the narration server for the first run...');
                break;
              case 'preparingNarration':
                statusMessage = t('narration.preparingNarration', 'Preparing to generate narration...');
                break;
              case 'processingSubtitle':
                statusMessage = t('narration.processingSubtitle', 'Processing subtitle {{current}}/{{total}} (ID: {{id}}) - "{{text}}"', {
                  current: progressData.current,
                  total: progressData.total,
                  id: progressData.subtitle_id,
                  text: progressData.subtitle_text
                });
                break;
              default:
                statusMessage = progressData.message || 'Processing...';
            }
          } else {
            // Fallback to message field
            statusMessage = progressData.message || 'Processing...';

            // Add subtitle text if available (for backward compatibility)
            if (progressData.subtitle_text) {
              statusMessage = `${statusMessage} - "${progressData.subtitle_text}"`;
            }
          }
        } else {
          statusMessage = 'Processing...';
        }

        // Update the status with the progress message
        setGenerationStatus(statusMessage);

        // If we have current results, make sure they're displayed
        if (tempResults.length > 0) {
          setGenerationResults([...tempResults]);
        }
      };

      const handleResult = (result, progress, total) => {
        // Replace the corresponding pending item in-place to keep ordering stable
        const idx = tempResults.findIndex(item => item.subtitle_id === result.subtitle_id);
        if (idx !== -1) {
          tempResults[idx] = { ...tempResults[idx], ...result, pending: false };
        } else {
          // Fallback: append if not found (shouldn't happen if we seeded correctly)
          tempResults.push({ ...result, pending: false, outputIndex: tempResults.length + 1 });
        }

        // Update the UI with the current results (full list stays visible)
        setGenerationResults([...tempResults]);

        // Update window.groupedNarrations incrementally if we're generating grouped subtitles
        if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
          window.groupedNarrations = [...tempResults];
        }

        // Update the status to show which subtitle is being processed
        setGenerationStatus(
          t(
            'narration.generatingProgressWithId',
            'Generated {{progress}} of {{total}} narrations (ID: {{id}})...',
            {
              progress,
              total,
              id: result.subtitle_id
            }
          )
        );
      };

      const handleError = (error) => {
        // Check if this is a cancellation error
        if (error.cancelled) {
          setError(t('narration.generationCancelled', 'Narration generation cancelled by user'));
          return;
        }

        // Handle other errors
        if (typeof error === 'object' && error.error) {
          setError(`${t('narration.generationError', 'Error generating narration')}: ${error.error}`);
        } else if (typeof error === 'string') {
          setError(`${t('narration.generationError', 'Error generating narration')}: ${error}`);
        } else {
          setError(t('narration.generationError', 'Error generating narration'));
        }
      };

      const handleComplete = (results) => {
        const finalizedResults = hydrateNarrationResultsForAlignment(
          results.map((result, index) => ({
            ...(tempResults[index] || { outputIndex: index + 1 }),
            ...result,
            pending: false
          }))
        );

        setGenerationStatus(t('narration.generationComplete', 'Narration generation complete'));
        // Ensure we have the final results
        setGenerationResults(finalizedResults);

        // Cache narrations and reference audio to localStorage for F5-TTS
        try {
          // Get current media ID
          const getCurrentMediaId = () => {
            const currentVideoUrl = localStorage.getItem('current_video_url');
            const currentFileUrl = localStorage.getItem('current_file_url');

            if (currentVideoUrl) {
              // Extract video ID from YouTube URLs
              const match = currentVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
              return match ? match[1] : null;
            } else if (currentFileUrl) {
              return localStorage.getItem('current_file_cache_id');
            }
            return null;
          };

          const mediaId = getCurrentMediaId();
          if (mediaId && referenceAudio) {
            // Create cache entry with narrations and reference audio
            const cacheEntry = {
              mediaId,
              timestamp: Date.now(),
              narrations: finalizedResults.map(result => ({
                subtitle_id: result.subtitle_id,
                filename: result.filename,
                outputIndex: result.outputIndex,
                success: result.success,
                skipped: result.skipped,
                text: result.text,
                method: 'f5tts'
              })),
              referenceAudio: {
                filename: referenceAudio.filename,
                text: referenceAudio.text || '',
                url: referenceAudio.url,
                filepath: referenceAudio.filepath
              }
            };

            // Save to localStorage
            localStorage.setItem('f5tts_narrations_cache', JSON.stringify(cacheEntry));
            console.log('Cached F5-TTS narrations and reference audio');
          }
        } catch (error) {
          console.error('Error caching F5-TTS narrations:', error);
        }

        // Update state if we generated narrations for grouped subtitles
        if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
          // Store as grouped narrations in window object
          window.groupedNarrations = [...finalizedResults];
          window.useGroupedSubtitles = true;
          // Update the React state to reflect that we're now using grouped subtitles
          setUseGroupedSubtitles(true);
          console.log(`Stored ${finalizedResults.length} F5-TTS grouped narrations and updated state`);
        } else {
          // Store as original/translated narrations
          if (subtitleSource === 'original') {
            window.originalNarrations = [...finalizedResults];
          } else {
            window.translatedNarrations = [...finalizedResults];
          }
          window.useGroupedSubtitles = false;
        }
      };

      // Call the generateNarration function with callbacks
      const result = await generateNarration(
        referenceAudio.filepath,
        referenceAudio.text || referenceText,
        subtitlesWithIds,
        apiSettings,
        handleProgress,
        handleResult,
        handleError,
        handleComplete
      );

      if (!result || !result.success) {
        setError(result?.error || t('narration.generationError', 'Error generating narration'));
      }
    } catch (error) {
      setError(t('narration.generationError', 'Error generating narration'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Cancel narration generation
  const cancelGeneration = () => {
    if (isGenerating) {
      const cancelled = cancelNarrationGeneration();
      if (cancelled) {

        // We don't set isGenerating to false here because the abort will trigger the error handler
        // which will set isGenerating to false
      } else {

      }
    }
  };

  // Playback + bulk (zip) download.
  const { playAudio, downloadAllAudio } = useNarrationDownloads({
    generationResults,
    currentAudio,
    setCurrentAudio,
    isPlaying,
    setIsPlaying,
    t,
  });

  // Aligned single-file download.
  const { downloadAlignedAudio } = useAlignedDownload({
    generationResults,
    getSelectedSubtitles,
    t,
  });

  return {
    handleGenerateNarration,
    playAudio,
    downloadAllAudio,
    downloadAlignedAudio,
    cancelGeneration
  };
};

export default useNarrationGeneration;
