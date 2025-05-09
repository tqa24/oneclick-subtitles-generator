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
  const containerRef = useRef(null);
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
    retryGeminiNarration
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

    // Clear any previous errors
    setError('');

    // Set status for retrying failed narrations
    setGenerationStatus(t('narration.retryingFailedNarrations', 'Retrying {{count}} failed narrations...', { count: failedNarrations.length }));

    // Process each failed narration one by one
    for (let i = 0; i < failedNarrations.length; i++) {
      const failedNarration = failedNarrations[i];
      const subtitleId = failedNarration.subtitle_id;

      // Set retrying state
      setRetryingSubtitleId(subtitleId);

      // Update status
      setGenerationStatus(t('narration.retryingFailedNarrationProgress', 'Retrying failed narration {{current}} of {{total}} (ID: {{id}})...', {
        current: i + 1,
        total: failedNarrations.length,
        id: subtitleId
      }));

      try {
        // Retry this specific narration
        await retryGeminiNarration(subtitleId);

        // Add a small delay between retries to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error retrying Gemini narration for subtitle ${subtitleId}:`, error);
        // Continue with the next failed narration
      }
    }

    // Clear retrying state
    setRetryingSubtitleId(null);

    // Update status
    setGenerationStatus(t('narration.retryingFailedNarrationsComplete', 'Completed retrying all failed narrations'));
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

  // Initialize section height on component mount
  useEffect(() => {
    if (sectionRef.current) {
      // Add a class to the section to give it extra initial height
      sectionRef.current.classList.add('extra-initial-height');

      // Small delay to ensure the DOM is fully rendered
      setTimeout(() => {
        // Get the height of the container including header and method selection
        const headerHeight = sectionRef.current.querySelector('.narration-header')?.offsetHeight || 0;
        const methodSelectionHeight = sectionRef.current.querySelector('.narration-method-row')?.offsetHeight || 0;

        // Get the content height based on which mode is active
        let contentHeight = 0;
        if (narrationMethod === 'f5tts') {
          // Find the F5-TTS content container
          const f5ttsContent = contentRef.current?.querySelector('.f5tts-content');
          if (f5ttsContent) {
            contentHeight = f5ttsContent.scrollHeight;
          }
        } else {
          // Find the Gemini content container
          const geminiContent = contentRef.current?.querySelector('.gemini-content');
          if (geminiContent) {
            contentHeight = geminiContent.scrollHeight;
          }
        }

        // Calculate initial height with extra padding
        const initialHeight = headerHeight + methodSelectionHeight + contentHeight + 100; // Use original padding

        // Set initial height
        sectionRef.current.style.height = `${initialHeight}px`;
        console.log('Initial section height set to:', initialHeight, 'for method:', narrationMethod);
      }, 100);
    }
  }, [narrationMethod]);

  // Update reference audio when initialReferenceAudio changes
  useEffect(() => {
    updateReferenceAudio(initialReferenceAudio);
  }, [initialReferenceAudio, updateReferenceAudio]);

  // Clear results when switching narration methods
  useEffect(() => {
    // Clear generation results when switching methods
    setGenerationResults([]);
    setGenerationStatus('');
    setError('');

    // Remove any generating classes
    if (sectionRef.current) {
      sectionRef.current.classList.remove('f5tts-generating', 'gemini-generating');
    }

    console.log(`Switched to ${narrationMethod} method, cleared previous results`);
  }, [narrationMethod, setGenerationResults, setGenerationStatus, setError]);

  // Handle height animation when narration method changes
  useEffect(() => {
    // Use a small delay to ensure the new content is rendered
    const animationTimeout = setTimeout(() => {
      // Remove the extra-initial-height class when switching methods
      if (sectionRef.current) {
        sectionRef.current.classList.remove('extra-initial-height');
      }

      if (containerRef.current && contentRef.current) {
        // Get the height of the content based on which mode is active
        if (narrationMethod === 'f5tts') {
          // Find the F5-TTS content container
          const f5ttsContent = contentRef.current.querySelector('.f5tts-content');
          if (f5ttsContent) {
            const contentHeight = f5ttsContent.offsetHeight;
            // Set the container height to match the F5-TTS content height plus extra space
            containerRef.current.style.height = `${contentHeight + 120}px`; // Keeping original padding to avoid stacking extra height
            console.log('F5-TTS content height set to:', contentHeight + 120);
          }
        } else {
          // Find the Gemini content container
          const geminiContent = contentRef.current.querySelector('.gemini-content');
          if (geminiContent) {
            const contentHeight = geminiContent.offsetHeight;
            // Set the container height to match the Gemini content height plus extra space
            containerRef.current.style.height = `${contentHeight + 120}px`; // Keeping original padding to avoid stacking extra height
            console.log('Gemini content height set to:', contentHeight + 120);
          }
        }
      }
    }, 50); // Small delay to ensure content is rendered

    return () => clearTimeout(animationTimeout);
  }, [narrationMethod, isGenerating, generationResults]);

  // Handle overall section height animation
  useEffect(() => {
    // Use a small delay to ensure the new content is rendered
    const animationTimeout = setTimeout(() => {
      if (sectionRef.current && containerRef.current) {
        // Remove the extra-initial-height class when content changes
        sectionRef.current.classList.remove('extra-initial-height');

        // Get the height of the container including header and method selection
        const headerHeight = sectionRef.current.querySelector('.narration-header').offsetHeight;
        const methodSelectionHeight = sectionRef.current.querySelector('.narration-method-row').offsetHeight;
        const errorMessageHeight = error ? sectionRef.current.querySelector('.status-message.error').offsetHeight : 0;

        // Get the content height based on which mode is active
        let contentHeight = 0;
        if (narrationMethod === 'f5tts') {
          // Find the F5-TTS content container
          const f5ttsContent = contentRef.current.querySelector('.f5tts-content');
          if (f5ttsContent) {
            contentHeight = f5ttsContent.offsetHeight;
          }
        } else {
          // Find the Gemini content container
          const geminiContent = contentRef.current.querySelector('.gemini-content');
          if (geminiContent) {
            contentHeight = geminiContent.offsetHeight;
          }
        }

        // Get status message height if generating
        const statusMessageHeight = (isGenerating || generationResults?.length > 0) ?
          (sectionRef.current.querySelector('.status-message.info')?.offsetHeight || 0) : 0;

        // Add height for virtualized list if results are present
        let resultsHeight = 0;
        if (generationResults?.length > 0) {
          if (narrationMethod === 'f5tts') {
            // Add height for F5-TTS results list
            resultsHeight = 700; // Increased height of the F5-TTS virtualized list
          } else {
            // Add height for Gemini results list
            resultsHeight = 350; // Reduced height of the Gemini virtualized list
          }
        }

        // Calculate total height needed
        const totalHeight = headerHeight + methodSelectionHeight + errorMessageHeight +
                           contentHeight + statusMessageHeight + resultsHeight + 100; // Added resultsHeight

        // Set the section height
        sectionRef.current.style.height = `${totalHeight}px`;
        console.log('Section height set to:', totalHeight, 'for method:', narrationMethod, 'with results height:', resultsHeight);
      }
    }, 100); // Slightly longer delay to ensure container height is set first

    return () => clearTimeout(animationTimeout);
  }, [narrationMethod, isGenerating, generationResults, error]);

  // Special effect to handle height when generation starts
  useEffect(() => {
    if (isGenerating) {
      // Add extra height when generation starts to accommodate the status message and future results
      const extraHeightTimeout = setTimeout(() => {
        if (sectionRef.current) {
          // Reset the height to a base value first to avoid stacking
          // This is important when switching between methods with existing results
          const baseHeight = narrationMethod === 'gemini' ? 350 : 450; // Higher base for F5-TTS, lower for Gemini
          sectionRef.current.style.height = `${baseHeight}px`;

          // Add appropriate CSS class based on narration method
          sectionRef.current.classList.remove('extra-initial-height');
          sectionRef.current.classList.remove('f5tts-generating', 'gemini-generating');
          sectionRef.current.classList.add(`${narrationMethod}-generating`);

          // After a short delay, set the final height
          setTimeout(() => {
            // Get current height after reset
            const currentHeight = parseInt(sectionRef.current.style.height, 10) || sectionRef.current.offsetHeight;

            // Add extra height for status message and future results
            // More height for F5-TTS to show more results, less for Gemini to reduce empty space
            const extraHeight = narrationMethod === 'gemini' ? 500 : 800;

            sectionRef.current.style.height = `${currentHeight + extraHeight}px`;
            console.log(`Reset and added ${extraHeight}px extra height for ${narrationMethod} generation process, new height:`, currentHeight + extraHeight);
          }, 20);
        }
      }, 50);

      return () => clearTimeout(extraHeightTimeout);
    } else {
      // Remove generating classes when generation stops
      if (sectionRef.current) {
        sectionRef.current.classList.remove('f5tts-generating', 'gemini-generating');
      }
    }
  }, [isGenerating, narrationMethod]);

  // Listen for narrations loaded from cache event
  useEffect(() => {
    const handleNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {
        console.log('Received narrations loaded from cache event:', event.detail);

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
            try {
              localStorage.setItem('originalNarrations', JSON.stringify(cachedNarrations));
            } catch (e) {
              console.error('Error storing originalNarrations in localStorage:', e);
            }
          } else {
            window.translatedNarrations = [...cachedNarrations];
            try {
              localStorage.setItem('translatedNarrations', JSON.stringify(cachedNarrations));
            } catch (e) {
              console.error('Error storing translatedNarrations in localStorage:', e);
            }
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
            console.log('Forcing re-render after loading narrations from cache');
            setGenerationStatus(t('narration.loadedFromCacheComplete', 'Successfully loaded narrations from previous session'));
          }, 200);
        }
      }
    };

    // Handle F5-TTS narrations loaded from cache
    const handleF5TTSNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {
        console.log('Received F5-TTS narrations loaded from cache event:', event.detail);

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
            try {
              localStorage.setItem('originalNarrations', JSON.stringify(cachedNarrations));
            } catch (e) {
              console.error('Error storing originalNarrations in localStorage:', e);
            }
          } else {
            window.translatedNarrations = [...cachedNarrations];
            try {
              localStorage.setItem('translatedNarrations', JSON.stringify(cachedNarrations));
            } catch (e) {
              console.error('Error storing translatedNarrations in localStorage:', e);
            }
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
            console.log('Forcing re-render after loading F5-TTS narrations from cache');
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
    extractSegment: _extractSegment,
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

      {/* Error Message */}
      <StatusMessage message={error} type="error" />

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
              console.log(`Language detected for ${source}: ${language.languageCode} (${language.languageName})`);
              console.log(`Selected narration model: ${modelId}`);
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
            onLanguageDetected={(source, language) => {
              console.log(`Language detected for ${source}: ${language.languageCode} (${language.languageName})`);

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
