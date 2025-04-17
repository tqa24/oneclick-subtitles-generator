import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkNarrationStatus,
  getAudioUrl
} from '../../services/narrationService';
import NarrationAdvancedSettings from './NarrationAdvancedSettings'; // Redesigned component
import useNarrationHandlers from './hooks/useNarrationHandlers';

// Import modular components
import ReferenceAudioSection from './components/ReferenceAudioSection';
import AudioControls from './components/AudioControls';
import SubtitleSourceSelection from './components/SubtitleSourceSelection';
import AdvancedSettingsToggle from './components/AdvancedSettingsToggle';
import GenerateButton from './components/GenerateButton';
import NarrationResults from './components/NarrationResults';
import StatusMessage from './components/StatusMessage';

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

  // Narration Settings state
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
  const [languageWarning, setLanguageWarning] = useState(false);

  // Narration Generation state
  const [isAvailable, setIsAvailable] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationResults, setGenerationResults] = useState([]);
  const [error, setError] = useState('');
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subtitleSource, setSubtitleSource] = useState('original'); // 'original' or 'translated'
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
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

  // Check if narration service is available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        console.log('Checking narration service availability');
        const status = await checkNarrationStatus();
        console.log('Narration service status:', status);

        // Always set isAvailable to true for now
        setIsAvailable(true);

        // Clear any previous errors
        setError('');
      } catch (error) {
        console.error('Error checking narration status:', error);
        // Still set isAvailable to true even if there's an error
        setIsAvailable(true);
        setError('');
      }
    };

    // Check availability once when component mounts
    checkAvailability();
  }, [t]);

  // Update local state when initialReferenceAudio changes
  useEffect(() => {
    if (initialReferenceAudio) {
      setReferenceAudio(initialReferenceAudio);
      setReferenceText(initialReferenceAudio.text || '');
    }
  }, [initialReferenceAudio]);

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
      console.error('Error loading narration advanced settings:', error);
    }
  }, []);

  // Scroll to status when generating
  useEffect(() => {
    if (isGenerating && statusRef.current) {
      statusRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isGenerating, generationStatus]);

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
    if (generationResults.length > 0) {
      // Store based on subtitle source
      if (subtitleSource === 'original') {
        window.originalNarrations = generationResults;
      } else {
        window.translatedNarrations = generationResults;
      }

      console.log(`Stored ${generationResults.length} ${subtitleSource} narrations in window object`);
    }
  }, [generationResults, subtitleSource]);

  // Handle audio ended event
  const handleAudioEnded = () => {
    setIsPlaying(false);
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
    downloadAllAudio
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
    setLanguageWarning,
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
    setGenerationStatus,
    setGenerationResults,
    currentAudio,
    setCurrentAudio,
    setIsPlaying,
    statusRef,
    t,
    subtitleSource,
    translatedSubtitles,
    isPlaying
  });

  // If service is unavailable, show a simple message
  if (!isAvailable) {
    return (
      <div className="narration-section">
        <div className="narration-header">
          <h3>
            {t('narration.title', 'Generate Narration')}
            <span className="service-unavailable">
              {t('narration.serviceUnavailableIndicator', '(Service Unavailable)')}
            </span>
          </h3>
        </div>
        <StatusMessage
          message={error || t('narration.serviceUnavailable', 'Narration service is not available')}
          type="error"
        />
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

      {/* Reference Audio Section */}
      <ReferenceAudioSection
        referenceAudio={referenceAudio}
        autoRecognize={autoRecognize}
        setAutoRecognize={setAutoRecognize}
        isRecognizing={isRecognizing}
        languageWarning={languageWarning}
        referenceText={referenceText}
        setReferenceText={setReferenceText}
        clearReferenceAudio={clearReferenceAudio}
        isRecording={isRecording}
        isExtractingSegment={isExtractingSegment}
      />

      {/* Audio Controls */}
      <AudioControls
        handleFileUpload={handleFileUpload}
        fileInputRef={fileInputRef}
        isRecording={isRecording}
        startRecording={startRecording}
        stopRecording={stopRecording}
        segmentStartTime={segmentStartTime}
        setSegmentStartTime={setSegmentStartTime}
        segmentEndTime={segmentEndTime}
        setSegmentEndTime={setSegmentEndTime}
        extractSegment={extractSegment}
        isExtractingSegment={isExtractingSegment}
        videoPath={videoPath}
        isAvailable={isAvailable}
      />

      {/* Error Message */}
      <StatusMessage message={error} type="error" />

      {/* Subtitle Source Selection */}
      <SubtitleSourceSelection
        subtitleSource={subtitleSource}
        setSubtitleSource={setSubtitleSource}
        isGenerating={isGenerating}
        translatedSubtitles={translatedSubtitles}
      />

      {/* Advanced Settings Toggle */}
      <AdvancedSettingsToggle
        showAdvancedSettings={showAdvancedSettings}
        setShowAdvancedSettings={setShowAdvancedSettings}
      />

      {/* Advanced Settings */}
      {showAdvancedSettings && (
        <NarrationAdvancedSettings
          settings={advancedSettings}
          onSettingsChange={setAdvancedSettings}
          disabled={isGenerating}
        />
      )}

      {/* Generate Button */}
      <GenerateButton
        handleGenerateNarration={handleGenerateNarration}
        isGenerating={isGenerating}
        referenceAudio={referenceAudio}
        generationResults={generationResults}
        downloadAllAudio={downloadAllAudio}
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
    </div>
  );
};

export default UnifiedNarrationSection;
