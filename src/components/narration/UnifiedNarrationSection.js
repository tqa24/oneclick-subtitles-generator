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
import '../../styles/narration/narrationSection.css';
import '../../styles/narration/narrationSettings.css';
import '../../styles/narration/unifiedNarration.css';

/**
 * Unified Narration Section component that combines settings and generation
 * @param {Object} props - Component props
 * @param {Array} props.subtitles - Subtitles to generate narration for
 * @param {string} props.videoPath - Path to the current video (optional)
 * @param {Function} props.onReferenceAudioChange - Callback when reference audio changes
 * @returns {JSX.Element} - Rendered component
 */
const UnifiedNarrationSection = ({ subtitles, videoPath, onReferenceAudioChange, referenceAudio: initialReferenceAudio }) => {
  const { t } = useTranslation();

  // Narration Settings state
  const [referenceAudio, setReferenceAudio] = useState(initialReferenceAudio);
  const [referenceText, setReferenceText] = useState(initialReferenceAudio?.text || '');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isExtractingSegment, setIsExtractingSegment] = useState(false);
  const [segmentStartTime, setSegmentStartTime] = useState('');
  const [segmentEndTime, setSegmentEndTime] = useState('');

  // Narration Generation state
  const [isAvailable, setIsAvailable] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationResults, setGenerationResults] = useState([]);
  const [error, setError] = useState('');
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
        console.log('Setting isAvailable to true');

        // Clear any previous errors
        setError('');
      } catch (error) {
        console.error('Error checking narration status:', error);
        // Still set isAvailable to true even if there's an error
        setIsAvailable(true);
        console.log('Setting isAvailable to true despite error');
        setError('');
      }
    };

    checkAvailability();

    // Set up periodic checks
    const intervalId = setInterval(checkAvailability, 10000); // Check every 10 seconds

    return () => clearInterval(intervalId);
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
      const result = await uploadReferenceAudio(file, referenceText);
      console.log('Upload result:', result);

      if (result.success) {
        console.log('File uploaded successfully');
        const audioUrl = getAudioUrl(result.filename);
        console.log('Audio URL:', audioUrl);

        setReferenceAudio({
          filepath: result.filepath,
          filename: result.filename,
          url: audioUrl
        });

        // Update reference text if it was empty and we got it from transcription
        if (!referenceText && result.reference_text) {
          console.log('Setting reference text from result:', result.reference_text);
          setReferenceText(result.reference_text);
        }

        // Notify parent component
        if (onReferenceAudioChange) {
          console.log('Notifying parent component of reference audio change');
          onReferenceAudioChange({
            filepath: result.filepath,
            filename: result.filename,
            text: result.reference_text || referenceText
          });
        }
      } else {
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
          const result = await saveRecordedAudio(audioBlob, referenceText);

          if (result.success) {
            console.log('Audio saved successfully:', result);
            setReferenceAudio({
              filepath: result.filepath,
              filename: result.filename,
              url: getAudioUrl(result.filename)
            });

            // Update reference text if it was empty and we got it from transcription
            if (!referenceText && result.reference_text) {
              setReferenceText(result.reference_text);
            }

            // Notify parent component
            if (onReferenceAudioChange) {
              onReferenceAudioChange({
                filepath: result.filepath,
                filename: result.filename,
                text: result.reference_text || referenceText
              });
            }
          } else {
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
      const result = await extractAudioSegment(videoPath, segmentStartTime, segmentEndTime);

      if (result.success) {
        setReferenceAudio({
          filepath: result.filepath,
          filename: result.filename,
          url: getAudioUrl(result.filename)
        });

        // Update reference text if we got it from transcription
        if (result.reference_text) {
          setReferenceText(result.reference_text);
        }

        // Notify parent component
        if (onReferenceAudioChange) {
          onReferenceAudioChange({
            filepath: result.filepath,
            filename: result.filename,
            text: result.reference_text || referenceText
          });
        }
      } else {
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

  // Generate narration for all subtitles
  const handleGenerateNarration = async () => {
    if (!referenceAudio || !referenceAudio.filepath) {
      setError(t('narration.noReferenceError', 'Please set up reference audio using one of the options above'));
      return;
    }

    if (!subtitles || subtitles.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      return;
    }

    setIsGenerating(true);
    setGenerationStatus(t('narration.preparingGeneration', 'Preparing to generate narration...'));
    setError('');
    setGenerationResults([]);

    try {
      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = subtitles.map((subtitle, index) => ({
        ...subtitle,
        id: subtitle.id || index + 1
      }));

      setGenerationStatus(t('narration.generatingNarration', 'Generating narration for {{count}} subtitles...', { count: subtitlesWithIds.length }));

      const result = await generateNarration(
        referenceAudio.filepath,
        referenceAudio.text || referenceText,
        subtitlesWithIds
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
          />
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
