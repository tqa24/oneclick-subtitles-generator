import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAudioUrl } from '../../services/narrationService';
import useNarrationHandlers from './hooks/useNarrationHandlers';

// Import custom hooks
import useNarrationState from './hooks/useNarrationState';
import useAvailabilityCheck from './hooks/useAvailabilityCheck';
import useGeminiNarration from './hooks/useGeminiNarration';
import useAudioPlayback from './hooks/useAudioPlayback';
import useNarrationStorage from './hooks/useNarrationStorage';
import useUIEffects from './hooks/useUIEffects';
import useNarrationCache from './hooks/useNarrationCache';
import useWindowStateManager from './hooks/useWindowStateManager';

// Import modular components
import ReferenceAudioSection from './components/ReferenceAudioSection';
import AudioControls from './components/AudioControls';
import SubtitleSourceSelection from './components/SubtitleSourceSelection';
import GeminiSubtitleSourceSelection from './components/GeminiSubtitleSourceSelection';
import GeminiVoiceSelection from './components/GeminiVoiceSelection';
import GeminiConcurrentClientsSlider from './components/GeminiConcurrentClientsSlider';
import AdvancedSettingsToggle from './components/AdvancedSettingsToggle';
import GenerateButton from './components/GenerateButton';
import GeminiGenerateButton from './components/GeminiGenerateButton';
import NarrationResults from './components/NarrationResults';
import GeminiNarrationResults from './components/GeminiNarrationResults';
import StatusMessage from './components/StatusMessage';
import NarrationMethodSelection from './components/NarrationMethodSelection';

// Import styles
import '../../styles/narration/unifiedNarrationRedesign.css';

/**
 * Unified Narration Section component that combines settings and generation
 * @param {Object} props - Component props
 * @param {Array} props.subtitles - Subtitles to generate narration for (fallback)
 * @param {Array} props.originalSubtitles - Original subtitles
 * @param {Array} props.translatedSubtitles - Translated subtitles (optional)
 * @param {string} props.videoPath - Path to the current video (optional)
 * @param {Function} props.onReferenceAudioChange - Callback when reference audio changes
 * @param {Object} props.referenceAudio - Initial reference audio
 * @returns {JSX.Element} - Rendered component
 */
const UnifiedNarrationSection = ({
  subtitles,
  originalSubtitles,
  translatedSubtitles,
  videoPath,
  onReferenceAudioChange,
  referenceAudio: initialReferenceAudio
}) => {
  const { t } = useTranslation();

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const statusRef = useRef(null);
  const contentRef = useRef(null);
  const sectionRef = useRef(null);

  // Use custom hooks for state management
  const narrationState = useNarrationState(initialReferenceAudio);

  // Destructure state from the hook
  const {
    // Narration Method state
    narrationMethod, setNarrationMethod,
    isGeminiAvailable, setIsGeminiAvailable,

    // Gemini-specific settings
    selectedVoice, setSelectedVoice,
    concurrentClients, setConcurrentClients,

    // Narration Settings state (for F5-TTS)
    referenceAudio, setReferenceAudio,
    referenceText, setReferenceText,
    isRecording, setIsRecording,
    /* recordedAudio, */ setRecordedAudio,
    isExtractingSegment, setIsExtractingSegment,
    segmentStartTime, segmentEndTime,
    autoRecognize, setAutoRecognize,
    isRecognizing, setIsRecognizing,

    // Narration Generation state
    isAvailable, setIsAvailable,
    isGenerating, setIsGenerating,
    generationStatus, setGenerationStatus,
    generationResults, setGenerationResults,
    error, setError,
    currentAudio, setCurrentAudio,
    isPlaying, setIsPlaying,
    subtitleSource, setSubtitleSource,
    advancedSettings, setAdvancedSettings,
    originalLanguage, setOriginalLanguage,
    translatedLanguage, setTranslatedLanguage,
    retryingSubtitleId, setRetryingSubtitleId,
    useGroupedSubtitles, setUseGroupedSubtitles,
    groupedSubtitles, setGroupedSubtitles,
    isGroupingSubtitles, setIsGroupingSubtitles,
    groupingIntensity, setGroupingIntensity,
    selectedNarrationModel,
    setSelectedNarrationModel,

    // Helper functions
    updateReferenceAudio
  } = narrationState;

  // Use availability check hook
  useAvailabilityCheck({
    narrationMethod,
    setIsAvailable,
    setIsGeminiAvailable,
    setError,
    t
  });

  // Use Gemini narration hook
  const {
    handleGeminiNarration,
    cancelGeminiGeneration,
    retryGeminiNarration,
    retryFailedGeminiNarrations
  } = useGeminiNarration({
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
    groupingIntensity,
    t,
    setRetryingSubtitleId
  });

  // Use audio playback hook
  const { audioRef, handleAudioEnded } = useAudioPlayback({
    isPlaying,
    currentAudio,
    setIsPlaying
  });

  // Use narration storage hook
  useNarrationStorage({
    generationResults,
    subtitleSource
  });

  // Use UI effects hook
  useUIEffects({
    isGenerating,
    generationStatus,
    statusRef,
    t,
    referenceAudio,
    segmentStartTime,
    segmentEndTime,
    setError
  });

  // Use narration cache hook
  useNarrationCache({
    generationResults,
    setGenerationResults,
    setGenerationStatus,
    subtitleSource,
    originalSubtitles,
    translatedSubtitles,
    subtitles,
    t
  });

  // Use window state manager hook
  useWindowStateManager({
    generationResults,
    subtitleSource,
    narrationMethod,
    originalSubtitles,
    translatedSubtitles,
    subtitles,
    useGroupedSubtitles,
    groupedSubtitles,
    setGroupedSubtitles,
    setIsGroupingSubtitles,
    setUseGroupedSubtitles,
    groupingIntensity
  });

  // Update reference audio when initialReferenceAudio changes
  useEffect(() => {
    updateReferenceAudio(initialReferenceAudio);
  }, [initialReferenceAudio, updateReferenceAudio]);

  // Reset UI state when switching narration methods, but preserve results for aligned narration
  useEffect(() => {
    // Clear status and error messages, but don't clear generation results
    // This ensures aligned narration can still access the results
    setGenerationStatus('');
    setError('');

    // Remove any generating classes
    if (sectionRef.current) {
      sectionRef.current.classList.remove('f5tts-generating', 'gemini-generating');
    }
  }, [narrationMethod, setGenerationStatus, setError]);

  // No height animation when narration method changes - let content flow naturally

  // No overall section height animation - let content flow naturally

  // No special effect for height when generation starts - let content flow naturally

  // Import the handler functions from separate file to keep this component clean
  const {
    handleFileUpload,
    startRecording,
    stopRecording,
    // extractSegment is available but not used in this component
    clearReferenceAudio,
    handleGenerateNarration,
    playAudio,
    downloadAllAudio,
    downloadAlignedAudio,
    cancelGeneration,
    retryF5TTSNarration,
    retryFailedNarrations
  } = useNarrationHandlers({
    fileInputRef,
    mediaRecorderRef,
    audioChunksRef,
    referenceAudio,
    referenceText,
    setReferenceAudio,
    setReferenceText,
    setRecordedAudio,
    setIsRecording,
    setIsExtractingSegment,
    setIsRecognizing,
    setError,
    autoRecognize,
    segmentStartTime,
    segmentEndTime,
    videoPath,
    onReferenceAudioChange,
    getSelectedSubtitles: () => {
      if (subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
        return translatedSubtitles;
      }
      return originalSubtitles || subtitles;
    },
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
    setRetryingSubtitleId
  });

  // Only show the unavailable message if both F5-TTS and Gemini are unavailable
  if (!isAvailable && !isGeminiAvailable) {
    return (
      <div className="narration-section unavailable" ref={sectionRef}>
        <div className="narration-header">
          <h3>
            {t('narration.title', 'Generate Narration')}
            <span className="service-unavailable">
              {t('narration.serviceUnavailableIndicator', '(Service Unavailable)')}
            </span>
          </h3>
        </div>
        <div className="narration-unavailable-message">
          <div className="warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="message">
            {t('narration.allServicesUnavailableMessage', "Both F5-TTS and Gemini narration services are unavailable. For F5-TTS, please run with npm run dev:cuda. For Gemini, please check your API key in settings.")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narration-section" ref={sectionRef}>
      <div className="narration-header">
        <h3>{t('narration.title', 'Generate Narration')}</h3>
        <p className="narration-description">
          {t('narration.description', 'Generate spoken audio from your subtitles using the reference voice.')}
        </p>
      </div>

      {/* Narration Method Selection */}
      <NarrationMethodSelection
        narrationMethod={narrationMethod}
        setNarrationMethod={setNarrationMethod}
        isGenerating={isGenerating}
        isF5Available={isAvailable}
        isGeminiAvailable={isGeminiAvailable}
      />

      {/* Error Message - only show when there's an actual error message */}
      {error && <StatusMessage message={error} type="error" />}

      <div className="narration-content-container" ref={contentRef}>
      {narrationMethod === 'f5tts' ? (
        // F5-TTS UI
        <div className="f5tts-content">
          {/* Audio Controls */}
          <AudioControls
            handleFileUpload={handleFileUpload}
            fileInputRef={fileInputRef}
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            isAvailable={isAvailable}
            referenceAudio={referenceAudio}
            clearReferenceAudio={clearReferenceAudio}
          />

          {/* Reference Audio Section */}
          <ReferenceAudioSection
            referenceAudio={referenceAudio}
            autoRecognize={autoRecognize}
            setAutoRecognize={setAutoRecognize}
            isRecognizing={isRecognizing}
            referenceText={referenceText}
            setReferenceText={setReferenceText}
            clearReferenceAudio={clearReferenceAudio}
            isRecording={isRecording}
            isExtractingSegment={isExtractingSegment}
          />

          {/* Subtitle Source Selection */}
          <SubtitleSourceSelection
            subtitleSource={subtitleSource}
            setSubtitleSource={setSubtitleSource}
            isGenerating={isGenerating}
            translatedSubtitles={translatedSubtitles}
            originalSubtitles={originalSubtitles || subtitles}
            originalLanguage={originalLanguage}
            translatedLanguage={translatedLanguage}
            setOriginalLanguage={setOriginalLanguage}
            setTranslatedLanguage={setTranslatedLanguage}
            useGroupedSubtitles={useGroupedSubtitles}
            setUseGroupedSubtitles={setUseGroupedSubtitles}
            isGroupingSubtitles={isGroupingSubtitles}
            groupedSubtitles={groupedSubtitles}
            groupingIntensity={groupingIntensity}
            setGroupingIntensity={setGroupingIntensity}
            onLanguageDetected={(source, language, modelId, modelError) => {


              if (modelError) {
                console.warn(`Model availability error: ${modelError}`);
              }

              // Update the selected narration model
              if (modelId) {
                setSelectedNarrationModel(modelId);
              }

              // Update the appropriate language state
              if (source === 'original') {
                setOriginalLanguage(language);
              } else if (source === 'translated') {
                setTranslatedLanguage(language);
              }

              // Store in localStorage for persistence
              try {
                localStorage.setItem('detected_language', JSON.stringify({
                  source,
                  language,
                  modelId,
                  modelError
                }));
              } catch (e) {
                console.error('Error storing detected language in localStorage:', e);
              }
            }}
          />

          {/* Advanced Settings Toggle */}
          <AdvancedSettingsToggle
            advancedSettings={advancedSettings}
            setAdvancedSettings={setAdvancedSettings}
            isGenerating={isGenerating}
          />

          {/* Generate Button */}
          <GenerateButton
            handleGenerateNarration={handleGenerateNarration}
            isGenerating={isGenerating}
            referenceAudio={referenceAudio}
            generationResults={generationResults}
            downloadAllAudio={downloadAllAudio}
            downloadAlignedAudio={downloadAlignedAudio}
            cancelGeneration={cancelGeneration}
            subtitleSource={subtitleSource}
          />

          {/* Generation Status */}
          <StatusMessage
            message={(isGenerating || retryingSubtitleId) ? generationStatus : ''}
            type="info"
            statusRef={statusRef}
            showProgress={isGenerating && generationStatus && generationStatus.includes('Generating narrations')}
            isGenerating={isGenerating}
          />

          {/* Results */}
          <NarrationResults
            generationResults={generationResults}
            playAudio={playAudio}
            currentAudio={currentAudio}
            isPlaying={isPlaying}
            getAudioUrl={getAudioUrl}
            onRetry={retryF5TTSNarration}
            retryingSubtitleId={retryingSubtitleId}
            onRetryFailed={retryFailedNarrations}
          />

          {/* Hidden audio player for playback */}
          <audio
            ref={audioRef}
            src={currentAudio?.url}
            onEnded={handleAudioEnded}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        // Gemini UI
        <div className="gemini-content">
          {/* Simplified Subtitle Source Selection for Gemini */}
          <GeminiSubtitleSourceSelection
            subtitleSource={subtitleSource}
            setSubtitleSource={setSubtitleSource}
            isGenerating={isGenerating}
            translatedSubtitles={translatedSubtitles}
            originalSubtitles={originalSubtitles || subtitles}
            originalLanguage={originalLanguage}
            translatedLanguage={translatedLanguage}
            setOriginalLanguage={setOriginalLanguage}
            setTranslatedLanguage={setTranslatedLanguage}
            useGroupedSubtitles={useGroupedSubtitles}
            setUseGroupedSubtitles={setUseGroupedSubtitles}
            isGroupingSubtitles={isGroupingSubtitles}
            groupedSubtitles={groupedSubtitles}
            groupingIntensity={groupingIntensity}
            setGroupingIntensity={setGroupingIntensity}
            onGroupedSubtitlesGenerated={setGroupedSubtitles}
            onLanguageDetected={(source, language) => {
              // Update the appropriate language state
              if (source === 'original') {
                setOriginalLanguage(language);
              } else if (source === 'translated') {
                setTranslatedLanguage(language);
              }
            }}
          />

          {/* Voice Selection for Gemini */}
          <GeminiVoiceSelection
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
            isGenerating={isGenerating}
          />

          {/* Concurrent Clients Slider for Gemini */}
          <GeminiConcurrentClientsSlider
            concurrentClients={concurrentClients}
            setConcurrentClients={setConcurrentClients}
            isGenerating={isGenerating}
          />

          {/* Gemini Generate Button */}
          <GeminiGenerateButton
            handleGenerateNarration={handleGeminiNarration}
            isGenerating={isGenerating}
            subtitleSource={subtitleSource}
            cancelGeneration={cancelGeminiGeneration}
            downloadAllAudio={downloadAllAudio}
            downloadAlignedAudio={downloadAlignedAudio}
            generationResults={generationResults}
          />

          {/* Generation Status */}
          <StatusMessage
            message={(isGenerating || retryingSubtitleId) ? generationStatus : ''}
            type="info"
            statusRef={statusRef}
            showProgress={isGenerating && generationStatus && generationStatus.includes('Generating narrations')}
            isGenerating={isGenerating}
          />

          {/* Gemini Results */}
          <GeminiNarrationResults
            generationResults={generationResults}
            onRetry={retryGeminiNarration}
            retryingSubtitleId={retryingSubtitleId}
            onRetryFailed={retryFailedGeminiNarrations}
            hasGenerationError={!!error && error.includes('Gemini')}
            subtitleSource={subtitleSource}
          />

          {/* No need for a separate audio element here as it's included in the GeminiNarrationResults component */}
        </div>
      )}
      </div>
    </div>
  );
};

export default UnifiedNarrationSection;
