/**
 * Hook for handling aligned narration generation
 */
import { useCallback, useEffect } from 'react';
import {
  isAlignedNarrationAvailable,
  generateAlignedNarration as generateAlignedNarrationService,
  resetAlignedAudioElement
} from '../../../../services/alignedNarrationService';
import { createHash, enhanceNarrationWithTiming, createSubtitleMap, getAllSubtitles } from './alignedNarrationUtils';

/**
 * Hook for handling aligned narration generation
 * @param {Object} params - Parameters
 * @param {Object} params.videoRef - Reference to the video element
 * @param {Array} params.generationResults - Array of narration results
 * @param {boolean} params.useAlignedMode - Whether to use aligned narration mode
 * @param {Object} params.state - State from useAlignedNarrationState
 * @returns {Object} - Generation handlers
 */
const useAlignedNarrationGeneration = ({
  videoRef,
  generationResults,
  useAlignedMode,
  state
}) => {
  const {
    isGeneratingAligned,
    setIsGeneratingAligned,
    alignedStatus,
    setAlignedStatus,
    isAlignedAvailable,
    setIsAlignedAvailable,
    lastGenerationResultsHashRef,
    playAlignedNarration,
    cleanupAlignedNarration
  } = state;

  // Force regeneration of aligned narration
  const regenerateAlignedNarration = useCallback(async () => {
    // Prevent multiple simultaneous generation attempts
    if (isGeneratingAligned) {
      console.log('Already generating aligned narration, skipping duplicate request');
      return;
    }

    // Check if we have narration results to work with
    if (!generationResults || generationResults.length === 0) {
      console.error('Cannot generate aligned narration: no narration results available');
      setAlignedStatus({
        status: 'error',
        message: 'No narration results available for alignment'
      });
      return;
    }

    try {
      // Update state
      setIsGeneratingAligned(true);
      setIsAlignedAvailable(false);
      setAlignedStatus({
        status: 'preparing',
        message: 'Preparing aligned narration...'
      });

      // Force reset any existing audio element to ensure we use the new one
      console.log('Resetting audio element before regeneration');
      resetAlignedAudioElement();

      // Get all subtitles from the video for timing information
      const allSubtitles = getAllSubtitles();

      // Create a map of subtitles by ID for quick lookup
      const subtitleMap = createSubtitleMap(allSubtitles);

      // Add timing information to each narration result
      const enhancedResults = enhanceNarrationWithTiming(generationResults, subtitleMap);

      console.log('Enhanced narration results with timing information:', enhancedResults);

      // Generate the aligned narration with the enhanced results
      await generateAlignedNarrationService(enhancedResults, setAlignedStatus);

      // Update state
      setIsAlignedAvailable(true);

      // Dispatch an event to notify other components that the aligned narration generation is complete
      // Include isStillGenerating flag to indicate if the notification is still showing
      window.dispatchEvent(new CustomEvent('aligned-narration-status', {
        detail: {
          status: 'complete',
          message: 'Aligned narration generation complete',
          isStillGenerating: isGeneratingAligned // Pass the current generation state
        }
      }));

      // If the video is playing, start playing the aligned narration
      if (videoRef?.current && !videoRef.current.paused) {
        playAlignedNarration(videoRef.current.currentTime, true);
      }
    } catch (error) {
      console.error('Error generating aligned narration:', error);
      setAlignedStatus({
        status: 'error',
        message: `Error: ${error.message}`
      });

      // Dispatch an event to notify other components that there was an error during aligned narration generation
      window.dispatchEvent(new CustomEvent('aligned-narration-status', {
        detail: {
          status: 'error',
          message: `Error: ${error.message}`,
          isStillGenerating: isGeneratingAligned // Pass the current generation state
        }
      }));
    } finally {
      // Update the isGeneratingAligned state
      setIsGeneratingAligned(false);

      // Dispatch an event to notify other components that the generation state has changed
      window.dispatchEvent(new CustomEvent('aligned-narration-generating-state', {
        detail: {
          isGenerating: false
        }
      }));
    }
  }, [
    isGeneratingAligned,
    generationResults,
    setIsGeneratingAligned,
    setIsAlignedAvailable,
    cleanupAlignedNarration,
    setAlignedStatus,
    videoRef,
    playAlignedNarration
  ]);

  // Generate aligned narration when needed
  useEffect(() => {
    // Only generate if aligned mode is enabled and we have narration results
    if (useAlignedMode && generationResults && generationResults.length > 0) {
      // Only generate if we don't already have aligned narration
      if (!isAlignedAvailable || !isAlignedNarrationAvailable()) {
        // Generate the aligned narration
        const generateAlignedAudio = async () => {
          try {
            setIsGeneratingAligned(true);
            setAlignedStatus({ status: 'generating', message: 'Generating aligned narration...' });

            // Force reset any existing audio element to ensure we use the new one
            console.log('Resetting audio element before initial generation');
            resetAlignedAudioElement();

            // Get all subtitles from the video for timing information
            const allSubtitles = getAllSubtitles();

            // Create a map of subtitles by ID for quick lookup
            const subtitleMap = createSubtitleMap(allSubtitles);

            // Add timing information to each narration result
            const enhancedResults = enhanceNarrationWithTiming(generationResults, subtitleMap);

            console.log('Enhanced narration results with timing information:', enhancedResults);

            // Generate the aligned narration with the enhanced results
            await generateAlignedNarrationService(enhancedResults, setAlignedStatus);

            // Update state
            setIsAlignedAvailable(true);

            // Dispatch an event to notify other components that the aligned narration generation is complete
            window.dispatchEvent(new CustomEvent('aligned-narration-status', {
              detail: {
                status: 'complete',
                message: 'Aligned narration generation complete',
                isStillGenerating: true // Still generating until we set isGeneratingAligned to false
              }
            }));

            // If the video is playing, start playing the aligned narration
            if (videoRef?.current && !videoRef.current.paused) {
              playAlignedNarration(videoRef.current.currentTime, true);
            }

            // Update the isGeneratingAligned state
            setIsGeneratingAligned(false);

            // Dispatch an event to notify other components that the generation state has changed
            window.dispatchEvent(new CustomEvent('aligned-narration-generating-state', {
              detail: {
                isGenerating: false
              }
            }));
          } catch (error) {
            console.error('Error generating aligned narration:', error);
            setAlignedStatus({ status: 'error', message: `Error: ${error.message}` });

            // Dispatch an event to notify other components that there was an error during aligned narration generation
            window.dispatchEvent(new CustomEvent('aligned-narration-status', {
              detail: {
                status: 'error',
                message: `Error: ${error.message}`,
                isStillGenerating: true // Still generating until we set isGeneratingAligned to false
              }
            }));

            // Update the isGeneratingAligned state
            setIsGeneratingAligned(false);

            // Dispatch an event to notify other components that the generation state has changed
            window.dispatchEvent(new CustomEvent('aligned-narration-generating-state', {
              detail: {
                isGenerating: false
              }
            }));
          }
        };

        generateAlignedAudio();
      }
    }
  }, [
    useAlignedMode,
    generationResults,
    isAlignedAvailable,
    videoRef,
    setIsGeneratingAligned,
    setAlignedStatus,
    setIsAlignedAvailable,
    playAlignedNarration
  ]);

  return {
    regenerateAlignedNarration
  };
};

export default useAlignedNarrationGeneration;
