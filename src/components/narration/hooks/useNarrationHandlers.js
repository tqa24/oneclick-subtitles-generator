import useAudioIO from './useAudioIO';
import useNarrationGeneration from './useNarrationGeneration';
import useNarrationRetry from './useNarrationRetry';

/**
 * Custom hook for narration handlers.
 *
 * Thin composer over three focused sub-hooks:
 *   - useAudioIO: reference-audio I/O (upload, record, extract, clear, example select)
 *   - useNarrationGeneration: generation + downloads (generate, play, download-all/aligned, cancel)
 *   - useNarrationRetry: retries (single, all-failed, all-pending)
 *
 * Shared MediaRecorder/audio refs (mediaRecorderRef, audioChunksRef) are owned by the parent and
 * passed down so the recording group can use them.
 *
 * @param {Object} params - Parameters
 * @returns {Object} - Narration handlers
 */
const useNarrationHandlers = ({
  fileInputRef,
  mediaRecorderRef,
  audioChunksRef,
  referenceAudio,
  referenceText,
  setReferenceAudio,
  setReferenceText,
  setRecordedAudio,
  setIsRecording,
  setIsStartingRecording,
  setRecordingStartTime,
  setIsExtractingSegment,
  setIsRecognizing,
  setError,
  autoRecognize,
  segmentStartTime,
  segmentEndTime,
  videoPath,
  onReferenceAudioChange,
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
  statusRef,
  t,
  subtitleSource,
  translatedSubtitles,
  isPlaying,
  selectedNarrationModel,
  originalLanguage,
  translatedLanguage,
  setRetryingSubtitleId,
  useGroupedSubtitles,
  setUseGroupedSubtitles,
  groupedSubtitles,
  narrationMethod
}) => {
  // Reference-audio I/O: upload, record, extract segment, clear, example select.
  const {
    handleFileUpload,
    startRecording,
    stopRecording,
    extractSegment,
    clearReferenceAudio,
    handleExampleSelect
  } = useAudioIO({
    mediaRecorderRef,
    audioChunksRef,
    referenceText,
    setReferenceAudio,
    setReferenceText,
    setRecordedAudio,
    setIsRecording,
    setIsStartingRecording,
    setRecordingStartTime,
    setIsExtractingSegment,
    setIsRecognizing,
    setError,
    autoRecognize,
    segmentStartTime,
    segmentEndTime,
    videoPath,
    onReferenceAudioChange,
    t,
    narrationMethod
  });

  // Generation + downloads: generate, play, download-all/aligned, cancel.
  const {
    handleGenerateNarration,
    playAudio,
    downloadAllAudio,
    downloadAlignedAudio,
    cancelGeneration
  } = useNarrationGeneration({
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
  });

  // Retries: single subtitle, all-failed, all-pending.
  const {
    retryF5TTSNarration,
    retryFailedNarrations,
    generateAllPendingF5TTSNarrations
  } = useNarrationRetry({
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
  });

  return {
    handleFileUpload,
    startRecording,
    stopRecording,
    extractSegment,
    clearReferenceAudio,
    handleGenerateNarration,
    playAudio,
    downloadAllAudio,
    downloadAlignedAudio,
    cancelGeneration,
    retryF5TTSNarration,
    retryFailedNarrations,
    generateAllPendingF5TTSNarrations,
    handleExampleSelect
  };
};

export default useNarrationHandlers;
