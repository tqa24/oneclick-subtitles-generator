import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkNarrationStatus,
  uploadReferenceAudio,
  saveRecordedAudio,
  extractAudioSegment,
  getAudioUrl,
  generateNarration
} from '../../services/narrationService';
import { transcribeAudio } from '../../services/transcriptionService';
import NarrationAdvancedSettings from './NarrationAdvancedSettings';
import '../../styles/narration/narrationSection.css';
import '../../styles/narration/narrationSettings.css';
import '../../styles/narration/unifiedNarration.css';
import '../../styles/narration/narrationAdvancedSettings.css';

/**
 * Unified Narration Section component that combines settings and generation
 * @param {Object} props - Component props
 * @param {Array} props.subtitles - Subtitles to generate narration for (fallback, will be either translated or original)
 * @param {Array} props.originalSubtitles - Original subtitles
 * @param {Array} props.translatedSubtitles - Translated subtitles (optional)
 * @param {string} props.videoPath - Path to the current video (optional)
 * @param {Function} props.onReferenceAudioChange - Callback when reference audio changes
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
  const [recordedAudio, setRecordedAudio] = useState(null);
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

    // No periodic checks to reduce server load
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

  // Handle audio ended event
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    console.log('File upload triggered');
    const file = event.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, 'size:', file.size, 'type:', file.type);

    try {
      console.log('Uploading reference audio file...');
      let result;

      // First upload the file without transcription
      result = await uploadReferenceAudio(file, referenceText);
      console.log('Upload result:', result);

      // If auto-recognize is enabled and upload was successful, transcribe the audio
      if (autoRecognize && result && result.success) {
        setIsRecognizing(true);
        setLanguageWarning(false); // Reset language warning

        try {
          // Set a timeout to prevent waiting too long (10 seconds)
          const recognitionTimeout = setTimeout(() => {
            setIsRecognizing(false);
            setError(t('narration.recognitionTimeout', 'Voice recognition is taking too long. Please try again or enter text manually.'));
          }, 10000); // Reduced from 30s to 10s for faster feedback

          // Create a blob from the file for transcription
          console.log('Transcribing uploaded audio file');
          try {
            const transcriptionResult = await transcribeAudio(file);
            console.log('Transcription result:', transcriptionResult);

            // Add transcription data to the result
            result.reference_text = transcriptionResult.text;
            result.is_english = transcriptionResult.is_english;
            result.language = transcriptionResult.language;

            // Log the language detection result
            console.log('Language detection result (upload):', {
              text: transcriptionResult.text,
              is_english: transcriptionResult.is_english,
              language: transcriptionResult.language
            });
          } catch (transcriptionError) {
            console.error('Error during file upload transcription:', transcriptionError);

            // If it's an API key error, show a specific message
            if (transcriptionError.message.includes('API key')) {
              setError(transcriptionError.message);
            } else {
              // For other errors, just log it
              console.error('Transcription error:', transcriptionError);
            }
          }

          // Clear the timeout
          clearTimeout(recognitionTimeout);

          // Reset recognizing state
          setIsRecognizing(false);
        } catch (error) {
          console.error('Error transcribing uploaded audio:', error);
          setIsRecognizing(false);
          // Don't throw the error, just log it and continue with the uploaded audio
        }
      }

      if (result && result.success) {
        console.log('File uploaded successfully');
        const audioUrl = getAudioUrl(result.filename);
        console.log('Audio URL:', audioUrl);

        setReferenceAudio({
          filepath: result.filepath,
          filename: result.filename,
          url: audioUrl,
          language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
        });

        // Update reference text if auto-recognize is enabled or it was empty and we got it from transcription
        if (autoRecognize || (!referenceText && result.reference_text)) {
          console.log('Setting reference text from result:', result.reference_text);
          setReferenceText(result.reference_text);

          // Check if the audio is not in English
          if (result.is_english === false) {
            setLanguageWarning(true);
            console.warn(`Reference audio appears to be non-English.`);
          } else {
            // Make sure to reset the language warning if it's English
            setLanguageWarning(false);
            console.log('Reference audio is in English');
          }
        }

        // Notify parent component
        if (onReferenceAudioChange) {
          console.log('Notifying parent component of reference audio change');
          onReferenceAudioChange({
            filepath: result.filepath,
            filename: result.filename,
            text: result.reference_text || referenceText,
            language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
          });
        }
      } else if (result) {
        console.error('Upload failed:', result.error);
        setError(result.error || t('narration.uploadError', 'Error uploading reference audio'));
      }
    } catch (error) {
      console.error('Error uploading reference audio:', error);
      setError(error.message || t('narration.uploadError', 'Error uploading reference audio'));
    }
  };

  // Handle recording start
  const startRecording = async () => {
    try {
      setError(''); // Clear any previous errors
      audioChunksRef.current = [];

      console.log('Requesting microphone access');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');

      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Received audio chunk, size:', event.data.size);
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        console.log('Audio chunks:', audioChunksRef.current.length);

        if (audioChunksRef.current.length === 0) {
          setError(t('narration.noAudioData', 'No audio data recorded'));
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        console.log('Created audio blob, size:', audioBlob.size);
        const audioUrl = URL.createObjectURL(audioBlob);

        setRecordedAudio({
          blob: audioBlob,
          url: audioUrl
        });

        // Save the recorded audio
        try {
          console.log('Saving recorded audio, size:', audioBlob.size);
          let result;

          // Set recognizing state if auto-recognize is enabled
          if (autoRecognize) {
            setIsRecognizing(true);
            setLanguageWarning(false); // Reset language warning

            // Set a timeout to prevent waiting too long (10 seconds)
            const recognitionTimeout = setTimeout(() => {
              setIsRecognizing(false);
              setError(t('narration.recognitionTimeout', 'Voice recognition is taking too long. Please try again or enter text manually.'));
            }, 10000); // Reduced from 30s to 10s for faster feedback

            try {
              // Use direct transcription with Gemini API
              console.log('Auto-recognize is enabled, using direct transcription with Gemini');

              try {
                // First transcribe the audio directly
                const transcriptionResult = await transcribeAudio(audioBlob);
                console.log('Transcription result:', transcriptionResult);

                // Then save the audio file with the transcription text
                result = await saveRecordedAudio(audioBlob, transcriptionResult.text);

                // Add transcription data to the result
                result.reference_text = transcriptionResult.text;
                result.is_english = transcriptionResult.is_english;
                result.language = transcriptionResult.language;

                // Log the language detection result
                console.log('Language detection result:', {
                  text: transcriptionResult.text,
                  is_english: transcriptionResult.is_english,
                  language: transcriptionResult.language
                });
              } catch (transcriptionError) {
                console.error('Error during transcription:', transcriptionError);

                // If it's an API key error, show a specific message
                if (transcriptionError.message.includes('API key')) {
                  setError(transcriptionError.message);

                  // Save the audio without transcription
                  result = await saveRecordedAudio(audioBlob, '');
                } else {
                  // For other errors, just rethrow
                  throw transcriptionError;
                }
              }

              // Clear the timeout since we got a response
              clearTimeout(recognitionTimeout);

              // Reset recognizing state
              setIsRecognizing(false);
            } catch (error) {
              // Clear the timeout and reset state on error
              clearTimeout(recognitionTimeout);
              setIsRecognizing(false);
              throw error; // Re-throw to be caught by the outer catch block
            }
          } else {
            // If auto-recognize is disabled, just save with the existing text
            console.log('Auto-recognize is disabled, using existing text:', referenceText ? 'has text' : 'empty');
            result = await saveRecordedAudio(audioBlob, referenceText);
          }

          if (result && result.success) {
            console.log('Audio saved successfully:', result);
            setReferenceAudio({
              filepath: result.filepath,
              filename: result.filename,
              url: getAudioUrl(result.filename),
              language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
            });

            // Update reference text if auto-recognize is enabled or it was empty and we got it from transcription
            if (autoRecognize || (!referenceText && result.reference_text)) {
              setReferenceText(result.reference_text);

              // Check if the audio is not in English
              if (result.is_english === false) {
                setLanguageWarning(true);
                console.warn(`Reference audio appears to be non-English.`);
              } else {
                // Make sure to reset the language warning if it's English
                setLanguageWarning(false);
                console.log('Reference audio is in English');
              }
            }

            // Notify parent component
            if (onReferenceAudioChange) {
              onReferenceAudioChange({
                filepath: result.filepath,
                filename: result.filename,
                text: result.reference_text || referenceText,
                language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
              });
            }
          } else if (result) {
            console.error('Server returned error:', result.error);
            setError(result.error || t('narration.recordingError', 'Error saving recorded audio'));
          }
        } catch (error) {
          console.error('Error saving recorded audio:', error);
          setError(error.message || t('narration.recordingError', 'Error saving recorded audio'));
        }
      };

      mediaRecorderRef.current.start();
      console.log('Recording started');
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(error.message || t('narration.microphoneError', 'Error accessing microphone'));
    }
  };

  // Handle recording stop
  const stopRecording = () => {
    console.log('Stopping recording...');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('Recording stopped');

      // Stop all audio tracks
      if (mediaRecorderRef.current.stream) {
        console.log('Stopping audio tracks...');
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    } else {
      console.error('No media recorder found or not recording');
    }
  };

  // Handle segment extraction
  const extractSegment = async () => {
    if (!videoPath) {
      setError(t('narration.noVideoError', 'No video available for segment extraction'));
      return;
    }

    if (!segmentStartTime || !segmentEndTime) {
      setError(t('narration.timeRangeError', 'Please specify both start and end times'));
      return;
    }

    setIsExtractingSegment(true);
    setError('');

    try {
      let result;

      // First extract the segment without transcription
      result = await extractAudioSegment(videoPath, segmentStartTime, segmentEndTime);

      // If auto-recognize is enabled, transcribe the extracted segment
      if (autoRecognize && result && result.success) {
        setIsRecognizing(true);
        setLanguageWarning(false); // Reset language warning

        // Create a blob from the extracted audio URL
        try {
          // Set a timeout to prevent waiting too long (10 seconds)
          const recognitionTimeout = setTimeout(() => {
            setIsRecognizing(false);
            setError(t('narration.recognitionTimeout', 'Voice recognition is taking too long. Please try again or enter text manually.'));
          }, 10000); // Reduced from 30s to 10s for faster feedback

          // Fetch the audio file
          const audioUrl = getAudioUrl(result.filename);
          console.log('Fetching audio from URL for transcription:', audioUrl);
          const response = await fetch(audioUrl);
          const audioBlob = await response.blob();

          // Transcribe the audio
          console.log('Transcribing extracted audio segment');
          try {
            const transcriptionResult = await transcribeAudio(audioBlob);
            console.log('Transcription result:', transcriptionResult);

            // Add transcription data to the result
            result.reference_text = transcriptionResult.text;
            result.is_english = transcriptionResult.is_english;
            result.language = transcriptionResult.language;

            // Log the language detection result
            console.log('Language detection result (segment):', {
              text: transcriptionResult.text,
              is_english: transcriptionResult.is_english,
              language: transcriptionResult.language
            });
          } catch (transcriptionError) {
            console.error('Error during segment transcription:', transcriptionError);

            // If it's an API key error, show a specific message
            if (transcriptionError.message.includes('API key')) {
              setError(transcriptionError.message);
            } else {
              // For other errors, just log it
              console.error('Transcription error:', transcriptionError);
            }
          }

          // Clear the timeout
          clearTimeout(recognitionTimeout);

          // Reset recognizing state
          setIsRecognizing(false);
        } catch (error) {
          console.error('Error transcribing extracted audio:', error);
          setIsRecognizing(false);
          // Don't throw the error, just log it and continue with the extracted audio
        }
      }

      if (result && result.success) {
        setReferenceAudio({
          filepath: result.filepath,
          filename: result.filename,
          url: getAudioUrl(result.filename),
          language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
        });

        // Update reference text if auto-recognize is enabled or we got it from transcription
        if (autoRecognize || result.reference_text) {
          setReferenceText(result.reference_text);

          // Check if the audio is not in English
          if (result.is_english === false) {
            setLanguageWarning(true);
            console.warn(`Reference audio appears to be non-English.`);
          } else {
            // Make sure to reset the language warning if it's English
            setLanguageWarning(false);
            console.log('Reference audio is in English');
          }
        }

        // Notify parent component
        if (onReferenceAudioChange) {
          onReferenceAudioChange({
            filepath: result.filepath,
            filename: result.filename,
            text: result.reference_text || referenceText,
            language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
          });
        }
      } else if (result) {
        setError(result.error || t('narration.extractionError', 'Error extracting audio segment'));
      }
    } catch (error) {
      console.error('Error extracting audio segment:', error);
      setError(t('narration.extractionError', 'Error extracting audio segment'));
    } finally {
      setIsExtractingSegment(false);
    }
  };

  // Clear reference audio
  const clearReferenceAudio = () => {
    setReferenceAudio(null);
    setRecordedAudio(null);
    setReferenceText('');

    // Notify parent component
    if (onReferenceAudioChange) {
      onReferenceAudioChange(null);
    }
  };

  // Get the appropriate subtitles based on the selected source
  const getSelectedSubtitles = () => {
    if (subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
      return translatedSubtitles;
    }
    return originalSubtitles || subtitles;
  };

  // Generate narration for all subtitles
  const handleGenerateNarration = async () => {
    if (!referenceAudio || !referenceAudio.filepath) {
      setError(t('narration.noReferenceError', 'Please set up reference audio using one of the options above'));
      return;
    }

    // Get the appropriate subtitles based on the selected source
    const selectedSubtitles = getSelectedSubtitles();

    if (!selectedSubtitles || selectedSubtitles.length === 0) {
      // If translated subtitles are selected but not available, show a specific error
      if (subtitleSource === 'translated' && (!translatedSubtitles || translatedSubtitles.length === 0)) {
        setError(t('narration.noTranslatedSubtitlesError', 'No translated subtitles available. Please translate the subtitles first or select original subtitles.'));
      } else {
        setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      }
      return;
    }

    setIsGenerating(true);
    setGenerationStatus(t('narration.preparingGeneration', 'Preparing to generate narration...'));
    setError('');
    setGenerationResults([]);

    try {
      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = selectedSubtitles.map((subtitle, index) => ({
        ...subtitle,
        id: subtitle.id || index + 1
      }));

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
        batchSize: advancedSettings.batchSize === 'all' ? subtitlesWithIds.length : parseInt(advancedSettings.batchSize)
      };

      // Handle seed
      if (!advancedSettings.useRandomSeed) {
        apiSettings.seed = advancedSettings.seed;
      }

      // Save settings to localStorage
      localStorage.setItem('narration_advanced_settings', JSON.stringify(advancedSettings));

      const result = await generateNarration(
        referenceAudio.filepath,
        referenceAudio.text || referenceText,
        subtitlesWithIds,
        apiSettings
      );

      if (result.success) {
        setGenerationResults(result.results);
        setGenerationStatus(t('narration.generationComplete', 'Narration generation complete'));
      } else {
        setError(result.error || t('narration.generationError', 'Error generating narration'));
      }
    } catch (error) {
      console.error('Error generating narration:', error);
      setError(t('narration.generationError', 'Error generating narration'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Play a specific narration audio
  const playAudio = (result) => {
    // Stop current audio if playing
    if (isPlaying && currentAudio && currentAudio.id === result.subtitle_id) {
      setIsPlaying(false);
      return;
    }

    // Play new audio
    setCurrentAudio({
      id: result.subtitle_id,
      url: getAudioUrl(result.filename)
    });
    setIsPlaying(true);
  };

  // Download all narration audio as a zip file
  const downloadAllAudio = () => {
    // This would require a backend endpoint to create a zip file
    // For now, we'll just show a message
    alert(t('narration.downloadNotImplemented', 'Download all functionality not implemented yet'));
  };

  if (!isAvailable) {
    return (
      <div className="unified-narration-section">
        <div className="narration-header">
          <h3>
            {t('narration.title', 'Generate Narration')}
            <span className="service-unavailable">
              {t('narration.serviceUnavailableIndicator', '(Service Unavailable)')}
            </span>
          </h3>
        </div>
        <div className="narration-error">
          {error || t('narration.serviceUnavailable', 'Narration service is not available')}
        </div>
      </div>
    );
  }

  return (
    <div className="unified-narration-section">
      <div className="narration-header">
        <h3>{t('narration.title', 'Generate Narration')}</h3>
        <p className="narration-description">
          {t('narration.description', 'Generate spoken audio from your subtitles using the reference voice.')}
        </p>
      </div>

      {/* Reference Audio Section */}
      <div className="reference-audio-section">
        <div className="reference-audio-header">
          <h4>{t('narration.referenceAudio', 'Reference Audio')}</h4>
          {referenceAudio && (
            <button
              className="clear-reference-btn"
              onClick={clearReferenceAudio}
              title={t('narration.clearReference', 'Clear reference audio')}
            >
              ×
            </button>
          )}
        </div>

        {/* Reference Audio Player */}
        {referenceAudio && referenceAudio.url && (
          <div className="reference-audio-player">
            <audio controls src={referenceAudio.url} className="audio-player">
              {t('narration.audioNotSupported', 'Your browser does not support the audio element.')}
            </audio>
          </div>
        )}
        {referenceAudio && !referenceAudio.url && referenceAudio.filepath && (
          <div className="reference-audio-status">
            <span className="status-icon">✓</span>
            {t('narration.referenceAudioReady', 'Reference audio is ready')}
          </div>
        )}

        {/* Auto-Recognition Switch */}
        <div className="auto-recognize-container">
          <label className="auto-recognize-label">
            <input
              type="checkbox"
              checked={autoRecognize}
              onChange={(e) => setAutoRecognize(e.target.checked)}
              disabled={isRecording || isExtractingSegment || isRecognizing}
            />
            {t('narration.autoRecognize', 'Auto-recognize voice')}
          </label>
          <div className="auto-recognize-description">
            {t('narration.autoRecognizeDescription', 'Automatically transcribe audio after recording or uploading')}
          </div>
        </div>

        {/* Language Warning */}
        {languageWarning && (
          <div className="language-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {t('narration.nonEnglishWarning', `Warning: The reference audio appears to be non-English. F5-TTS works best with English audio.`)}
          </div>
        )}

        {/* Reference Text */}
        <div className="reference-text-container">
          <label htmlFor="reference-text">
            {t('narration.referenceText', 'Reference Text')}:
          </label>
          <textarea
            id="reference-text"
            value={referenceText}
            onChange={(e) => setReferenceText(e.target.value)}
            placeholder={t('narration.referenceTextPlaceholder', 'Enter text that matches the reference audio...')}
            rows={2}
            disabled={isRecognizing}
          />
          {isRecognizing && (
            <div className="recognizing-indicator">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {t('narration.recognizing', 'Recognizing voice...')}
            </div>
          )}
        </div>

        {/* Reference Audio Controls */}
        <div className="reference-audio-controls">
          {/* Upload Button */}
          <div className="control-group">
            <button
              className="upload-btn"
              onClick={() => fileInputRef.current.click()}
              disabled={isRecording || !isAvailable}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {t('narration.upload', 'Upload')}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*"
              style={{ display: 'none' }}
            />
          </div>

          {/* Record Button */}
          <div className="control-group">
            {!isRecording ? (
              <button
                className="record-btn"
                onClick={startRecording}
                disabled={!isAvailable}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="6" fill="currentColor" />
              </svg>
              {t('narration.record', 'Record')}
              </button>
            ) : (
              <button
                className="stop-btn"
                onClick={stopRecording}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" fill="currentColor" />
              </svg>
              {t('narration.stopRecording', 'Stop')}
              </button>
            )}
          </div>

          {/* Extract Segment Controls */}
          <div className="segment-controls">
            <div className="time-inputs">
              <input
                type="text"
                value={segmentStartTime}
                onChange={(e) => setSegmentStartTime(e.target.value)}
                placeholder={t('narration.startTime', 'Start')}
                disabled={isExtractingSegment || !isAvailable}
              />
              <span>-</span>
              <input
                type="text"
                value={segmentEndTime}
                onChange={(e) => setSegmentEndTime(e.target.value)}
                placeholder={t('narration.endTime', 'End')}
                disabled={isExtractingSegment || !isAvailable}
              />
            </div>
            <button
              className="extract-btn"
              onClick={extractSegment}
              disabled={isExtractingSegment || !videoPath || !isAvailable}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isExtractingSegment
                ? t('narration.extracting', 'Extracting...')
                : t('narration.extract', 'Extract')}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="narration-error">
          {error}
        </div>
      )}

      {/* Subtitle Source Selection */}
      <div className="subtitle-source-selection">
        <label className="source-selection-label">
          {t('narration.subtitleSource', 'Subtitle Source')}:
        </label>
        <div className="source-selection-options">
          <label className="source-option">
            <input
              type="radio"
              name="subtitle-source"
              value="original"
              checked={subtitleSource === 'original'}
              onChange={() => setSubtitleSource('original')}
              disabled={isGenerating}
            />
            {t('narration.originalSubtitles', 'Original Subtitles')}
          </label>
          <label className="source-option">
            <input
              type="radio"
              name="subtitle-source"
              value="translated"
              checked={subtitleSource === 'translated'}
              onChange={() => setSubtitleSource('translated')}
              disabled={isGenerating || !translatedSubtitles || translatedSubtitles.length === 0}
            />
            {t('narration.translatedSubtitles', 'Translated Subtitles')}
            {(!translatedSubtitles || translatedSubtitles.length === 0) && (
              <span className="option-unavailable">
                {t('narration.unavailable', '(unavailable)')}
              </span>
            )}
          </label>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <div
        className="advanced-settings-toggle"
        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
      >
        <span className="advanced-settings-toggle-label">
          {t('narration.advancedSettingsToggle', 'Advanced Voice & Audio Settings')}
        </span>
        <span className={`advanced-settings-toggle-icon ${showAdvancedSettings ? 'expanded' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </div>

      {/* Advanced Settings */}
      {showAdvancedSettings && (
        <NarrationAdvancedSettings
          settings={advancedSettings}
          onSettingsChange={setAdvancedSettings}
          disabled={isGenerating}
        />
      )}

      {/* Generate Button */}
      <div className="generate-controls">
        <button
          className="generate-btn"
          onClick={handleGenerateNarration}
          disabled={isGenerating || !referenceAudio}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" begin={isGenerating ? '0s' : 'indefinite'} />
            </path>
          </svg>
          {isGenerating
            ? t('narration.generating', 'Generating...')
            : t('narration.generate', 'Generate Narration')}
        </button>

        {generationResults.length > 0 && (
          <button
            className="download-all-btn"
            onClick={downloadAllAudio}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('narration.downloadAll', 'Download All')}
          </button>
        )}
      </div>

      {/* Generation Status */}
      {isGenerating && (
        <div className="generation-status" ref={statusRef}>
          {generationStatus}
        </div>
      )}

      {/* Results */}
      {generationResults.length > 0 && (
        <div className="narration-results">
          <h4>{t('narration.results', 'Generated Narration')}</h4>

          <div className="results-list">
            {generationResults.map((result) => (
              <div
                key={result.subtitle_id}
                className={`result-item ${result.success ? '' : 'failed'} ${currentAudio && currentAudio.id === result.subtitle_id ? 'playing' : ''}`}
              >
                <div className="result-text">
                  <span className="result-id">{result.subtitle_id}.</span>
                  {result.text}
                </div>

                <div className="result-controls">
                  {result.success ? (
                    <>
                      <button
                        className="play-btn"
                        onClick={() => playAudio(result)}
                      >
                        {currentAudio && currentAudio.id === result.subtitle_id && isPlaying ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                              <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                            </svg>
                            {t('narration.pause', 'Pause')}
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                            </svg>
                            {t('narration.play', 'Play')}
                          </>
                        )}
                      </button>
                      <a
                        href={getAudioUrl(result.filename)}
                        download={`narration_${result.subtitle_id}.wav`}
                        className="download-btn"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {t('narration.download', 'Download')}
                      </a>
                    </>
                  ) : (
                    <span className="error-message">
                      {t('narration.failed', 'Generation failed')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
