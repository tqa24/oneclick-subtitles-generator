/**
 * Hook for handling aligned narration generation
 */
import { useCallback, useEffect } from 'react';
import { isAlignedNarrationAvailable, generateAlignedNarration as generateAlignedNarrationService } from '../../../../services/alignedNarrationService';
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

      // Clean up existing resources
      cleanupAlignedNarration();

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
    } finally {
      setIsGeneratingAligned(false);
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
            setIsGeneratingAligned(false);

            // If the video is playing, start playing the aligned narration
            if (videoRef?.current && !videoRef.current.paused) {
              playAlignedNarration(videoRef.current.currentTime, true);
            }
          } catch (error) {
            console.error('Error generating aligned narration:', error);
            setAlignedStatus({ status: 'error', message: `Error: ${error.message}` });
            setIsGeneratingAligned(false);
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
