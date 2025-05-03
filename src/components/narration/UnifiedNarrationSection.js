import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkNarrationStatusWithRetry,
  getAudioUrl
} from '../../services/narrationService';
import {
  checkGeminiAvailability,
  generateGeminiNarrations,
  cancelGeminiNarrations,
  getGeminiLanguageCode
} from '../../services/gemini/geminiNarrationService';
import NarrationAdvancedSettings from './NarrationAdvancedSettings'; // Redesigned component
import useNarrationHandlers from './hooks/useNarrationHandlers';

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

  // Narration Method state
  const [narrationMethod, setNarrationMethod] = useState('f5tts'); // Default to F5-TTS
  const [isGeminiAvailable, setIsGeminiAvailable] = useState(true); // Assume Gemini is available by default

  // Gemini-specific settings
  const [sleepTime, setSleepTime] = useState(() => {
    // Try to load from localStorage
    const savedSleepTime = localStorage.getItem('gemini_sleep_time');
    return savedSleepTime ? parseInt(savedSleepTime) : 1000; // Default to 1 second
  });

  const [selectedVoice, setSelectedVoice] = useState(() => {
    // Try to load from localStorage
    const savedVoice = localStorage.getItem('gemini_voice');
    return savedVoice || 'Aoede'; // Default to Aoede if not set
  });

  // Narration Settings state (for F5-TTS)
  const [referenceAudio, setReferenceAudio] = useState(initialReferenceAudio);
  const [referenceText, setReferenceText] = useState(initialReferenceAudio?.text || '');
  const [isRecording, setIsRecording] = useState(false);
  // recordedAudio is used in the handlers but not directly in this component
  const [, setRecordedAudio] = useState(null);
  const [isExtractingSegment, setIsExtractingSegment] = useState(false);
  const [segmentStartTime, setSegmentStartTime] = useState('');
  const [segmentEndTime, setSegmentEndTime] = useState('');
  const [autoRecognize, setAutoRecognize] = useState(true); // Default to true
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Narration Generation state
  const [isAvailable, setIsAvailable] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationResults, setGenerationResults] = useState([]);
  const [error, setError] = useState('');
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subtitleSource, setSubtitleSource] = useState(null); // No default selection, will be set when user clicks
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [selectedNarrationModel, setSelectedNarrationModel] = useState(null);
  const [modelAvailabilityError, setModelAvailabilityError] = useState(null);
  const [originalLanguage, setOriginalLanguage] = useState(null);
  const [translatedLanguage, setTranslatedLanguage] = useState(null);
  const [advancedSettings, setAdvancedSettings] = useState({
    // Voice Style Controls - only speechRate is supported
    speechRate: 1.0,

    // Generation Quality Controls
    nfeStep: '32',  // Number of Function Evaluations (diffusion steps)
    swayCoef: -1.0, // Sway Sampling Coefficient
    cfgStrength: 2.0, // Classifier-Free Guidance Strength

    // Seed Control
    useRandomSeed: true,
    seed: 42,

    // Audio Processing Options - only removeSilence is supported
    removeSilence: true,

    // Output Format Options
    sampleRate: '44100',
    audioFormat: 'wav',

    // Batch Processing Options
    batchSize: '10',
    mergeOutput: false
  });

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const statusRef = useRef(null);
  const audioRef = useRef(null);

  // Check if narration services are available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        console.log('Checking narration service availability');

        // Check F5-TTS availability
        const f5Status = await checkNarrationStatusWithRetry(20, 10000, true);
        console.log('F5-TTS narration service status:', f5Status);

        // Set F5-TTS availability based on the actual status
        setIsAvailable(f5Status.available);

        // Check Gemini availability
        const geminiStatus = await checkGeminiAvailability();
        console.log('Gemini API availability status:', geminiStatus);

        // Set Gemini availability
        setIsGeminiAvailable(geminiStatus.available);

        // Set error message if F5-TTS is not available and we're using F5-TTS method
        if (!f5Status.available && narrationMethod === 'f5tts' && f5Status.message) {
          setError(f5Status.message);
        }
        // Set error message if Gemini is not available and we're using Gemini method
        else if (!geminiStatus.available && narrationMethod === 'gemini' && geminiStatus.message) {
          setError(geminiStatus.message);
        }
        else {
          // Clear any previous errors
          setError('');
        }
      } catch (error) {
        console.error('Error checking service availability:', error);

        // If we're using F5-TTS, show F5-TTS error
        if (narrationMethod === 'f5tts') {
          setIsAvailable(false);
          setError(t('narration.serviceUnavailableMessage', "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."));
        }
        // If we're using Gemini, show Gemini error
        else {
          setIsGeminiAvailable(false);
          setError(t('narration.geminiUnavailableMessage', "Gemini API is not available. Please check your API key in settings."));
        }
      }
    };

    // Check availability once when component mounts or narration method changes
    checkAvailability();
  }, [t, narrationMethod]);

  // Update local state when initialReferenceAudio changes
  useEffect(() => {
    if (initialReferenceAudio) {
      setReferenceAudio(initialReferenceAudio);
      setReferenceText(initialReferenceAudio.text || '');
    }
  }, [initialReferenceAudio]);

  // Try to load previously detected language from localStorage
  useEffect(() => {
    try {
      const savedLanguageData = localStorage.getItem('detected_language');
      if (savedLanguageData) {
        const { source, language, modelId, modelError } = JSON.parse(savedLanguageData);
        console.log(`Loaded previously detected language for ${source}: ${language.languageCode}`);
        if (modelError) {
          console.warn(`Loaded model availability error: ${modelError}`);
        }
        setDetectedLanguage(language);
        setSelectedNarrationModel(modelId);
        setModelAvailabilityError(modelError);

        // We no longer automatically set the subtitle source
        // Let the user explicitly select it
      }
    } catch (error) {
      // Silently fail if data can't be loaded
      console.error('Error loading detected language from localStorage:', error);
    }
  }, []);

  // Reset error when inputs change
  useEffect(() => {
    setError('');
  }, [referenceAudio, referenceText, segmentStartTime, segmentEndTime]);

  // Load advanced settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('narration_advanced_settings');
      if (savedSettings) {
        setAdvancedSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      // Silently fail if settings can't be loaded
    }
  }, []);

  // Scroll to status only when generation starts, not for every status update
  useEffect(() => {
    // Only scroll when generation starts, not for every status update
    if (isGenerating && statusRef.current && generationStatus === t('narration.preparingGeneration', 'Preparing to generate narration...')) {
      statusRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isGenerating, generationStatus, t]);

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentAudio]);

  // Store narration results in window object for access by other components
  useEffect(() => {
    console.log('UnifiedNarrationSection - generationResults:', generationResults);
    console.log('UnifiedNarrationSection - subtitleSource:', subtitleSource);

    if (generationResults.length > 0) {
      // Store based on subtitle source
      if (subtitleSource === 'original') {
        // Create a new array to ensure reference changes trigger updates
        window.originalNarrations = [...generationResults];
        // Also store in localStorage for more reliable access
        try {
          localStorage.setItem('originalNarrations', JSON.stringify(generationResults));
        } catch (e) {
          console.error('Error storing originalNarrations in localStorage:', e);
        }
        console.log('UnifiedNarrationSection - Setting window.originalNarrations:', window.originalNarrations);
      } else {
        // Create a new array to ensure reference changes trigger updates
        window.translatedNarrations = [...generationResults];
        // Also store in localStorage for more reliable access
        try {
          localStorage.setItem('translatedNarrations', JSON.stringify(generationResults));
        } catch (e) {
          console.error('Error storing translatedNarrations in localStorage:', e);
        }
        console.log('UnifiedNarrationSection - Setting window.translatedNarrations:', window.translatedNarrations);
      }

      // Dispatch a custom event to notify other components
      const event = new CustomEvent('narrations-updated', {
        detail: {
          source: subtitleSource,
          narrations: generationResults
        }
      });
      window.dispatchEvent(event);
    }

    console.log('UnifiedNarrationSection - After update - window.originalNarrations:', window.originalNarrations);
    console.log('UnifiedNarrationSection - After update - window.translatedNarrations:', window.translatedNarrations);
  }, [generationResults, subtitleSource]);

  // Handle audio ended event
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Handle Gemini narration generation
  const handleGeminiNarration = async () => {
    if (!subtitleSource) {
      setError(t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)'));
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

    console.log(`Using language: ${detectedLanguageCode} (Gemini format: ${language}) for Gemini narration`);

    setIsGenerating(true);
    setGenerationStatus(t('narration.preparingGeminiGeneration', 'Preparing to generate narration with Gemini...'));
    setError('');
    setGenerationResults([]);

    try {
      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = selectedSubtitles.map((subtitle, index) => ({
        ...subtitle,
        id: subtitle.id || index + 1
      }));

      // Generate narration with Gemini
      console.log(`Using Gemini API for narration with sleep time: ${sleepTime}ms and voice: ${selectedVoice}`);

      await generateGeminiNarrations(
        subtitlesWithIds,
        language,
        (message) => setGenerationStatus(message),
        (result, progress, total) => {
          // Add the result to the results array
          setGenerationResults(prev => [...prev, result]);
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
        },
        (results) => {
          setGenerationStatus(t('narration.geminiGenerationComplete', 'Gemini narration generation complete'));
          setGenerationResults(results);
        },
        null, // Use default model
        sleepTime, // Use the configured sleep time
        selectedVoice // Use the selected voice
      );
    } catch (error) {
      console.error('Error generating Gemini narration:', error);
      setError(t('narration.geminiGenerationError', 'Error generating narration with Gemini'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Cancel Gemini narration generation
  const cancelGeminiGeneration = () => {
    // Call the cancel function from the service
    cancelGeminiNarrations();

    // Update UI
    setGenerationStatus(t('narration.geminiGenerationCancelling', 'Cancelling Gemini narration generation...'));

    // We don't set isGenerating to false here because the service will call the completion callback
    // which will set isGenerating to false when it's done
  };

  // Import the handler functions from separate file to keep this component clean
  const {
    handleFileUpload,
    startRecording,
    stopRecording,
    extractSegment,
    clearReferenceAudio,
    handleGenerateNarration,
    playAudio,
    downloadAllAudio,
    downloadAlignedAudio,
    cancelGeneration
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
    translatedLanguage
  });

  // If service is unavailable, show a simple message with the Vietnamese text
  if (!isAvailable) {
    return (
      <div className="narration-section unavailable">
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
            {error || t('narration.serviceUnavailableMessage', "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được.")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="narration-section">
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
      />

      {/* Error Message */}
      <StatusMessage message={error} type="error" />

      {narrationMethod === 'f5tts' ? (
        // F5-TTS UI
        <>
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

              setDetectedLanguage(language);
              setSelectedNarrationModel(modelId);
              setModelAvailabilityError(modelError);

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
            message={isGenerating ? generationStatus : ''}
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
          />

          {/* Hidden audio player for playback */}
          <audio
            ref={audioRef}
            src={currentAudio?.url}
            onEnded={handleAudioEnded}
            style={{ display: 'none' }}
          />
        </>
      ) : (
        // Gemini UI
        <>
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
          />

          {/* Generation Status */}
          <StatusMessage
            message={isGenerating ? generationStatus : ''}
            type="info"
            statusRef={statusRef}
          />

          {/* Gemini Results */}
          <GeminiNarrationResults
            generationResults={generationResults}
          />
        </>
      )}
    </div>
  );
};

export default UnifiedNarrationSection;
