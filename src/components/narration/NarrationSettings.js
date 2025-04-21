import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkNarrationStatusWithRetry,
  uploadReferenceAudio,
  saveRecordedAudio,
  extractAudioSegment,
  getAudioUrl
} from '../../services/narrationService';
import '../../styles/narration/narrationSettings.css';

/**
 * Narration Settings component displayed above the video player
 * @param {Object} props - Component props
 * @param {string} props.videoPath - Path to the current video
 * @param {Function} props.onReferenceAudioChange - Callback when reference audio changes
 * @returns {JSX.Element} - Rendered component
 */
const NarrationSettings = ({ videoPath, onReferenceAudioChange }) => {
  const { t } = useTranslation();
  const [referenceAudio, setReferenceAudio] = useState(null);
  const [referenceText, setReferenceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isExtractingSegment, setIsExtractingSegment] = useState(false);
  const [segmentStartTime, setSegmentStartTime] = useState('');
  const [segmentEndTime, setSegmentEndTime] = useState('');
  const [error, setError] = useState('');
  const [isServiceAvailable, setIsServiceAvailable] = useState(true);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);

  // Check if narration service is available with multiple attempts
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        console.log('Checking narration service availability with multiple attempts');
        // Use 20 attempts with 10-second intervals and enable quiet mode
        const status = await checkNarrationStatusWithRetry(20, 10000, true);
        console.log('Final narration service status:', status);

        // Set availability based on the actual status
        setIsServiceAvailable(status.available);

        // Set error message if service is not available
        if (!status.available && status.message) {
          setError(status.message);
        } else {
          // Clear any previous errors
          setError('');
        }
      } catch (error) {
        console.error('Error checking narration status:', error);
        // Service is not available if there's an error
        setIsServiceAvailable(false);
        setError(t('narration.serviceUnavailableMessage', "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."));
      }
    };

    // Check availability once when component mounts
    checkAvailability();
  }, [t]);

  // Reset error when inputs change
  useEffect(() => {
    setError('');
  }, [referenceAudio, referenceText, segmentStartTime, segmentEndTime]);

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

  return (
    <div className="narration-settings">
      <h3 className="narration-settings-title">
        {t('narration.settings', 'Narration Settings')}
        {!isServiceAvailable && (
          <span className="service-unavailable">
            {t('narration.serviceUnavailableIndicator', '(Service Unavailable)')}
          </span>
        )}
      </h3>

      <div className="narration-settings-content">
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
          {referenceAudio && (
            <div className="reference-audio-player">
              <audio controls src={referenceAudio.url} className="audio-player">
                {t('narration.audioNotSupported', 'Your browser does not support the audio element.')}
              </audio>
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
                disabled={isRecording || !isServiceAvailable}
              >
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
                  disabled={!isServiceAvailable}
                >
                  {t('narration.record', 'Record')}
                </button>
              ) : (
                <button
                  className="stop-btn"
                  onClick={stopRecording}
                >
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
                  disabled={isExtractingSegment || !isServiceAvailable}
                />
                <span>-</span>
                <input
                  type="text"
                  value={segmentEndTime}
                  onChange={(e) => setSegmentEndTime(e.target.value)}
                  placeholder={t('narration.endTime', 'End')}
                  disabled={isExtractingSegment || !isServiceAvailable}
                />
              </div>
              <button
                className="extract-btn"
                onClick={extractSegment}
                disabled={isExtractingSegment || !videoPath || !isServiceAvailable}
              >
                {isExtractingSegment
                  ? t('narration.extracting', 'Extracting...')
                  : t('narration.extract', 'Extract')}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="narration-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NarrationSettings;
