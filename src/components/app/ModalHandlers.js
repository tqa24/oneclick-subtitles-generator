import { PROMPT_PRESETS } from '../../services/geminiService';
import { abortVideoAnalysis } from '../../services/videoAnalysisService';
import { setTranscriptionRules } from '../../utils/transcriptionRulesStore';
import { setUserProvidedSubtitles, setCurrentCacheId as setSubtitlesCacheId } from '../../utils/userSubtitlesStore';
import { setCurrentCacheId as setRulesCacheId } from '../../utils/transcriptionRulesStore';
import { extractYoutubeVideoId } from '../../utils/videoDownloader';

/**
 * Hook for modal-related handlers
 */
export const useModalHandlers = (appState) => {
  const {
    setShowVideoAnalysis,
    setVideoAnalysisResult,
    videoAnalysisResult,
    setTranscriptionRulesState,
    setShowRulesEditor,
    setStatus,
    setUserProvidedSubtitlesState,
    setUseUserProvidedSubtitles,
    selectedVideo,
    uploadedFile,
    t = (key, defaultValue) => defaultValue // Provide a default implementation if t is not available
  } = appState;

  /**
   * Handle using the recommended preset from video analysis
   */
  const handleUseRecommendedPreset = (presetId) => {
    console.log('handleUseRecommendedPreset called with presetId:', presetId);
    // Find the preset
    const preset = PROMPT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      // Save the preset to localStorage
      localStorage.setItem('transcription_prompt', preset.prompt);
      localStorage.setItem('selected_preset', presetId);

      // Save the transcription rules
      if (videoAnalysisResult && videoAnalysisResult.transcriptionRules) {
        setTranscriptionRules(videoAnalysisResult.transcriptionRules);
        setTranscriptionRulesState(videoAnalysisResult.transcriptionRules);
      }

      // Update status to indicate we're moving forward
      setStatus({
        message: t('output.preparingSplitting', 'Preparing to split video into segments...'),
        type: 'loading'
      });

      // Dispatch event to notify videoProcessor that user has made a choice
      const userChoiceEvent = new CustomEvent('videoAnalysisUserChoice', {
        detail: {
          presetId,
          transcriptionRules: videoAnalysisResult?.transcriptionRules
        }
      });
      window.dispatchEvent(userChoiceEvent);
      console.log('Dispatched videoAnalysisUserChoice event with presetId:', presetId);

      // Clear the localStorage flags and set processing flag
      localStorage.removeItem('show_video_analysis');
      localStorage.removeItem('video_analysis_timestamp');
      localStorage.removeItem('video_analysis_result'); // Also clear the result
      localStorage.setItem('video_processing_in_progress', 'true'); // Set processing flag
      console.log('Removed video analysis data from localStorage and set processing flag');

      // Close the modal
      setShowVideoAnalysis(false);
      setVideoAnalysisResult(null); // Clear the result to prevent re-showing
      console.log('Modal closed after using recommended preset');
    }
  };

  /**
   * Handle using the default preset from settings
   */
  const handleUseDefaultPreset = () => {
    console.log('handleUseDefaultPreset called');

    // Update status to indicate we're moving forward
    setStatus({
      message: t('output.preparingSplitting', 'Preparing to split video into segments...'),
      type: 'loading'
    });

    // Dispatch event to notify videoProcessor that user has made a choice
    const userChoiceEvent = new CustomEvent('videoAnalysisUserChoice', {
      detail: {
        presetId: null, // Use default preset
        transcriptionRules: videoAnalysisResult?.transcriptionRules // Still use the rules
      }
    });
    window.dispatchEvent(userChoiceEvent);
    console.log('Dispatched videoAnalysisUserChoice event with default preset');

    // Save the transcription rules
    if (videoAnalysisResult && videoAnalysisResult.transcriptionRules) {
      setTranscriptionRules(videoAnalysisResult.transcriptionRules);
      setTranscriptionRulesState(videoAnalysisResult.transcriptionRules);
    }

    // Clear the localStorage flags and set processing flag
    localStorage.removeItem('show_video_analysis');
    localStorage.removeItem('video_analysis_timestamp');
    localStorage.removeItem('video_analysis_result'); // Also clear the result
    localStorage.setItem('video_processing_in_progress', 'true'); // Set processing flag
    console.log('Removed video analysis data from localStorage and set processing flag');

    // Close the modal
    setShowVideoAnalysis(false);
    setVideoAnalysisResult(null); // Clear the result to prevent re-showing
    console.log('Modal closed after using default preset');
  };

  /**
   * Handle editing the transcription rules
   */
  const handleEditRules = (rules) => {
    console.log('handleEditRules called, closing VideoAnalysisModal and opening TranscriptionRulesEditor');
    // First, close the video analysis modal
    setShowVideoAnalysis(false);

    // Use a small timeout to ensure state updates properly
    setTimeout(() => {
      // Then set the rules and open the editor
      setTranscriptionRulesState(rules);
      setShowRulesEditor(true);
      console.log('TranscriptionRulesEditor should now be open, showRulesEditor:', true);
    }, 50); // Small delay to ensure proper transition

    // Save the current analysis result to state but don't clear localStorage flags
    // This allows us to reopen the modal when the rules editor is closed
    console.log('VideoAnalysisModal should now be closed, showVideoAnalysis:', false);
  };

  /**
   * Handle saving the edited transcription rules
   */
  const handleSaveRules = async (editedRules) => {
    // Update state
    setTranscriptionRulesState(editedRules);

    // Set cache ID based on the current video source
    const cacheId = getCacheIdForCurrentVideo();
    if (cacheId) {
      setRulesCacheId(cacheId);
      console.log('Set cache ID for transcription rules:', cacheId);
    }

    // Save to store (which will handle caching)
    await setTranscriptionRules(editedRules);

    // Update the analysis result with the edited rules
    if (videoAnalysisResult) {
      setVideoAnalysisResult({
        ...videoAnalysisResult,
        transcriptionRules: editedRules
      });
    }
  };

  /**
   * Handle viewing transcription rules
   */
  const handleViewRules = () => {
    setShowRulesEditor(true);
  };

  /**
   * Handle adding or updating user-provided subtitles
   */
  const handleUserSubtitlesAdd = async (subtitlesText) => {
    // Update state
    setUserProvidedSubtitlesState(subtitlesText);

    // Set cache ID based on the current video source
    const cacheId = getCacheIdForCurrentVideo();
    if (cacheId) {
      setSubtitlesCacheId(cacheId);
      console.log('Set cache ID for user-provided subtitles:', cacheId);
    }

    // Save to store (which will handle caching)
    await setUserProvidedSubtitles(subtitlesText);

    // Enable using user-provided subtitles
    setUseUserProvidedSubtitles(true);
    localStorage.setItem('use_user_provided_subtitles', 'true');

    console.log('User-provided subtitles saved:', subtitlesText.length > 100 ?
      subtitlesText.substring(0, 100) + '...' : subtitlesText);
  };

  /**
   * Get cache ID for the current video source
   */
  const getCacheIdForCurrentVideo = () => {
    if (selectedVideo) {
      // For YouTube videos, use the video ID
      return extractYoutubeVideoId(selectedVideo.url);
    } else if (uploadedFile) {
      // For uploaded files, use the file name without extension
      const fileName = uploadedFile.name;
      const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      return fileNameWithoutExt;
    }
    return null;
  };

  /**
   * Handle aborting video analysis
   */
  const handleAbortVideoAnalysis = () => {
    const analysisAborted = abortVideoAnalysis();
    if (analysisAborted) {
      // If video analysis was aborted, update the status
      setStatus({ message: t('output.videoAnalysisAborted', 'Video analysis aborted'), type: 'warning' });
      // Clear video analysis state
      localStorage.removeItem('show_video_analysis');
      localStorage.removeItem('video_analysis_timestamp');
      localStorage.removeItem('video_analysis_result');
      setShowVideoAnalysis(false);
      setVideoAnalysisResult(null);
    }
    return analysisAborted;
  };

  return {
    handleUseRecommendedPreset,
    handleUseDefaultPreset,
    handleEditRules,
    handleSaveRules,
    handleViewRules,
    handleUserSubtitlesAdd,
    getCacheIdForCurrentVideo,
    handleAbortVideoAnalysis
  };
};
