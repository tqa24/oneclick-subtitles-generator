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

// Import modular components
import ReferenceAudioSection from './components/ReferenceAudioSection';
import AudioControls from './components/AudioControls';
import SubtitleSourceSelection from './components/SubtitleSourceSelection';
import GeminiSubtitleSourceSelection from './components/GeminiSubtitleSourceSelection';
import GeminiSleepTimeSlider from './components/GeminiSleepTimeSlider';
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
    sleepTime, setSleepTime,
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
    groupSubtitles
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
    sleepTime,
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

  // Custom function to retry all failed Gemini narrations
  const retryFailedGeminiNarrations = async () => {
    // Find all failed narrations
    const failedNarrations = generationResults.filter(result => !result.success);

    if (failedNarrations.length === 0) {
      setError(t('narration.noFailedNarrationsError', 'No failed narrations to retry'));
      return;
    }

    // Determine which subtitles to use based on whether we're using grouped subtitles
    let selectedSubtitles;

    if (useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0) {
      // Use the grouped subtitles if available
      selectedSubtitles = groupedSubtitles;
    } else {
      // Otherwise use the original or translated subtitles
      selectedSubtitles = subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0
        ? translatedSubtitles
        : originalSubtitles || subtitles;
    }

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      return;
    }

    // Filter the subtitles to only include those that failed
    const subtitlesToRetry = selectedSubtitles.filter(subtitle => {
      const subtitleId = subtitle.id || subtitle.index;
      return failedNarrations.some(failedNarration =>
        failedNarration.subtitle_id === subtitleId
      );
    });

    if (subtitlesToRetry.length === 0) {
      setError(t('narration.noFailedNarrationsError', 'Could not match failed narrations with subtitles'));
      return;
    }

    // Clear any previous errors
    setError('');

    // Set status for retrying failed narrations
    setGenerationStatus(t('narration.retryingFailedNarrations', 'Retrying {{count}} failed narrations...', { count: subtitlesToRetry.length }));

    // Create a new array of generation results, keeping successful ones and marking failed ones as pending
    const updatedResults = generationResults.map(result => {
      if (!result.success) {
        return {
          ...result,
          pending: true,
          error: null
        };
      }
      return result;
    });

    // Update the generation results
    setGenerationResults(updatedResults);

    // Use a modified version of the handleGeminiNarration function to process all failed narrations at once
    try {
      // Set isGenerating to true to show the Cancel button
      setIsGenerating(true);
      setGenerationStatus(t('narration.preparingGeminiGeneration', 'Preparing to generate narration with Gemini...'));

      // Get the language code for the selected subtitles
      const detectedLanguageCode = subtitleSource === 'original'
        ? (originalLanguage?.languageCode || 'en')
        : (translatedLanguage?.languageCode || 'en');

      // Import the necessary functions
      const {
        generateGeminiNarrations,
        getGeminiLanguageCode
      } = await import('../../services/gemini/geminiNarrationService');

      // Convert to Gemini-compatible language code
      const language = getGeminiLanguageCode(detectedLanguageCode);

      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = subtitlesToRetry.map((subtitle, index) => ({
        ...subtitle,
        id: subtitle.id || index + 1
      }));

      // Generate narration with Gemini
      await generateGeminiNarrations(
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
          setIsGenerating(false);
        },
        (results) => {
          console.log("Retry generation complete, total results:", results.length);

          // Update the generation results, marking any pending items as failed
          setGenerationResults(prev => {
            return prev.map(item => {
              // If this item is in the results, use that result
              const resultItem = results.find(r => r.subtitle_id === item.subtitle_id);
              if (resultItem) {
                return { ...resultItem, pending: false };
              }

              // If this item is still pending and was in the retry list, mark it as failed
              if (item.pending && failedNarrations.some(f => f.subtitle_id === item.subtitle_id)) {
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

          setGenerationStatus(t('narration.retryingFailedNarrationsComplete', 'Completed retrying all failed narrations'));
          setIsGenerating(false);
        },
        null, // Use default model
        sleepTime, // Use the configured sleep time
        selectedVoice, // Use the selected voice
        concurrentClients // Use the configured concurrent clients
      );
    } catch (error) {
      console.error('Error retrying failed narrations:', error);
      setError(t('narration.retryError', 'Error retrying failed narrations'));
      setIsGenerating(false);
    }
  };

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
    referenceText,
    segmentStartTime,
    segmentEndTime,
    setError
  });

  // No height initialization - let content determine height naturally

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

    // IMPORTANT: We intentionally do NOT clear generationResults here
    // This is to ensure that the aligned narration feature can still access
    // the narration results when the user clicks the "Refresh Narration" button
    // in the video player. If we cleared the results, the aligned narration
    // would fail with "no narration results available" error.

    // Ensure the global window objects have the latest narration results
    // This is critical for the aligned narration feature to work
    if (generationResults && generationResults.length > 0) {
      if (subtitleSource === 'original') {
        window.originalNarrations = [...generationResults];

      } else if (subtitleSource === 'translated') {
        window.translatedNarrations = [...generationResults];

      }
    }


  }, [narrationMethod, setGenerationStatus, setError, generationResults, subtitleSource]);

  // No height animation when narration method changes - let content flow naturally

  // Update global window objects when generation results change
  useEffect(() => {
    // Ensure the global window objects have the latest narration results
    // This is critical for the aligned narration feature to work
    if (generationResults && generationResults.length > 0) {
      if (subtitleSource === 'original') {
        window.originalNarrations = [...generationResults];

      } else if (subtitleSource === 'translated') {
        window.translatedNarrations = [...generationResults];

      }
    }
  }, [generationResults, subtitleSource]);

  // No overall section height animation - let content flow naturally

  // No special effect for height when generation starts - let content flow naturally

  // Listen for narrations loaded from cache event
  useEffect(() => {
    const handleNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {


        // Only update if we don't already have results
        if (!generationResults || generationResults.length === 0) {
          // Get the narrations from the event
          const cachedNarrations = event.detail.narrations;

          // Immediately update the generation results
          setGenerationResults(cachedNarrations);

          // Show a status message
          setGenerationStatus(t('narration.loadedFromCache', 'Loaded narrations from previous session'));

          // Update global narration references
          if (subtitleSource === 'original') {
            window.originalNarrations = [...cachedNarrations];
          } else {
            window.translatedNarrations = [...cachedNarrations];
          }

          // Dispatch a custom event to notify other components
          const updateEvent = new CustomEvent('narrations-updated', {
            detail: {
              source: subtitleSource,
              narrations: cachedNarrations,
              fromCache: true
            }
          });
          window.dispatchEvent(updateEvent);

          // Force a re-render after a short delay to ensure the UI updates
          setTimeout(() => {

            setGenerationStatus(t('narration.loadedFromCacheComplete', 'Successfully loaded narrations from previous session'));
          }, 200);
        }
      }
    };

    // Handle F5-TTS narrations loaded from cache
    const handleF5TTSNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {


        // Only update if we don't already have results
        if (!generationResults || generationResults.length === 0) {
          // Get the narrations from the event
          const cachedNarrations = event.detail.narrations;

          // Immediately update the generation results
          setGenerationResults(cachedNarrations);

          // Show a status message
          setGenerationStatus(t('narration.loadedFromCache', 'Loaded narrations from previous session'));

          // Update global narration references
          if (subtitleSource === 'original') {
            window.originalNarrations = [...cachedNarrations];
          } else {
            window.translatedNarrations = [...cachedNarrations];
          }

          // Dispatch a custom event to notify other components
          const updateEvent = new CustomEvent('narrations-updated', {
            detail: {
              source: subtitleSource,
              narrations: cachedNarrations,
              fromCache: true
            }
          });
          window.dispatchEvent(updateEvent);

          // Force a re-render after a short delay to ensure the UI updates
          setTimeout(() => {

            setGenerationStatus(t('narration.loadedFromCacheComplete', 'Successfully loaded narrations from previous session'));
          }, 200);
        }
      }
    };

    // Add event listeners
    window.addEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);
    window.addEventListener('f5tts-narrations-loaded-from-cache', handleF5TTSNarrationsLoadedFromCache);

    // Clean up
    return () => {
      window.removeEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);
      window.removeEventListener('f5tts-narrations-loaded-from-cache', handleF5TTSNarrationsLoadedFromCache);
    };
  }, [generationResults, setGenerationResults, setGenerationStatus, subtitleSource, t]);

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
            onLanguageDetected={(source, language, modelId, modelError) => {


              if (modelError) {
                console.warn(`Model availability error: ${modelError}`);
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

          {/* Sleep Time Slider for Gemini */}
          <GeminiSleepTimeSlider
            sleepTime={sleepTime}
            setSleepTime={setSleepTime}
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
