import React from 'react';
import { transcribeAudio } from '../../../services/transcriptionService';
import {
  uploadReferenceAudio,
  saveRecordedAudio,
  extractAudioSegment,
  getAudioUrl
} from '../../../services/narrationService';
import { getCurrentMediaId, cacheReferenceAudio } from './referenceAudioCache';

/**
 * Reference-audio I/O handlers: upload, record, extract segment, clear, example select.
 * @param {Object} params - Parameters
 * @returns {Object} - Audio I/O handlers
 */
const useAudioIO = ({
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
}) => {
  // Recording time tracking
  const recordingStartTimeRef = React.useRef(null);

  // Helper function to check audio duration
  const checkAudioDuration = (file) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load audio file'));
      });

      audio.src = url;
    });
  };

  // Helper function to trigger auto-dismiss error toast
  const triggerErrorToast = (message) => {
    const event = new CustomEvent('aligned-narration-status', {
      detail: {
        status: 'error',
        message: message
      }
    });
    window.dispatchEvent(event);
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // Check audio duration for F5TTS
    if (narrationMethod === 'f5tts') {
      try {
        const duration = await checkAudioDuration(file);
        if (duration > 12) {
          const errorMessage = t('narration.f5ttsAudioTooLongError', 'Reference audio for F5TTS cannot be longer than 12s');
          triggerErrorToast(errorMessage);
          // Clear the file input
          event.target.value = '';
          return;
        }
      } catch (error) {
        console.error('Error checking audio duration:', error);
        // Continue with upload if duration check fails
      }
    }

    try {
      let result;

      // First upload the file without transcription
      result = await uploadReferenceAudio(file, referenceText);

      // If auto-recognize is enabled and upload was successful, transcribe the audio
      // Only do voice recognition for F5-TTS (which needs reference text)
      if (autoRecognize && result && result.success && narrationMethod === 'f5tts') {
        setIsRecognizing(true);

        try {
          // Set a timeout to prevent waiting too long (10 seconds)
          const recognitionTimeout = setTimeout(() => {
            setIsRecognizing(false);
            setError(t('narration.recognitionTimeout', 'Voice recognition is taking too long. Please try again or enter text manually.'));
          }, 10000); // Reduced from 30s to 10s for faster feedback

          // Create a blob from the file for transcription

          try {
            const transcriptionResult = await transcribeAudio(file);


            // Add transcription data to the result
            result.reference_text = transcriptionResult.text;
            result.is_english = transcriptionResult.is_english;
            result.language = transcriptionResult.language;

            // Log the language detection result

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

        const audioUrl = getAudioUrl(result.filename);


        const newReferenceAudio = {
          filepath: result.filepath,
          filename: result.filename,
          url: audioUrl,
          language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
        };

        setReferenceAudio(newReferenceAudio);

        // Update reference text if auto-recognize is enabled or it was empty and we got it from transcription
        // Only update reference text for F5-TTS (which needs reference text)
        let finalReferenceText = referenceText;
        if (narrationMethod === 'f5tts') {
          finalReferenceText = (autoRecognize || (!referenceText && result.reference_text)) ? result.reference_text : referenceText;
          if (autoRecognize || (!referenceText && result.reference_text)) {
            setReferenceText(finalReferenceText);
          }
        }

        // Cache reference audio immediately after upload
        cacheReferenceAudio({
          filename: newReferenceAudio.filename,
          text: finalReferenceText || '',
          url: newReferenceAudio.url,
          filepath: newReferenceAudio.filepath
        }, 'upload');

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
        setError(result.error || t('narration.uploadError', 'Error uploading reference audio'));
      }
    } catch (error) {
      setError(error.message || t('narration.uploadError', 'Error uploading reference audio'));
    }
  };

  // Handle recording start
  const startRecording = async () => {
    try {
      setError(''); // Clear any previous errors
      audioChunksRef.current = [];
      if (typeof setIsStartingRecording === 'function') setIsStartingRecording(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {

        if (audioChunksRef.current.length === 0) {
          setError(t('narration.noAudioData', 'No audio data recorded'));
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Check recording duration for F5TTS using recording time tracking
        if (narrationMethod === 'f5tts' && recordingStartTimeRef.current) {
          const recordingDuration = (Date.now() - recordingStartTimeRef.current) / 1000; // Convert to seconds
          console.log(`[F5TTS Duration Check] Recording duration: ${recordingDuration.toFixed(2)}s, narrationMethod: ${narrationMethod}`);
          if (recordingDuration > 12) {
            console.log(`[F5TTS Duration Check] Recording too long (${recordingDuration.toFixed(2)}s), rejecting`);
            const errorMessage = t('narration.f5ttsAudioTooLongError', 'Reference audio for F5TTS cannot be longer than 12s');
            triggerErrorToast(errorMessage);
            URL.revokeObjectURL(audioUrl);
            recordingStartTimeRef.current = null; // Reset the timer
            if (typeof setRecordingStartTime === 'function') setRecordingStartTime(null);
            return;
          } else {
            console.log(`[F5TTS Duration Check] Recording duration OK (${recordingDuration.toFixed(2)}s), proceeding`);
          }
        } else {
          console.log(`[F5TTS Duration Check] Skipping check - narrationMethod: ${narrationMethod}, hasStartTime: ${!!recordingStartTimeRef.current}`);
        }

        setRecordedAudio({
          blob: audioBlob,
          url: audioUrl
        });

        // Save the recorded audio
        try {
          let result;

          // Set recognizing state if auto-recognize is enabled
          // Only do voice recognition for F5-TTS (which needs reference text)
          if (autoRecognize && narrationMethod === 'f5tts') {
            setIsRecognizing(true);

            // Set a timeout to prevent waiting too long (10 seconds)
            const recognitionTimeout = setTimeout(() => {
              setIsRecognizing(false);
              setError(t('narration.recognitionTimeout', 'Voice recognition is taking too long. Please try again or enter text manually.'));
            }, 10000); // Reduced from 30s to 10s for faster feedback

            try {
              // Use direct transcription with Gemini API
              try {
                // First transcribe the audio directly
                const transcriptionResult = await transcribeAudio(audioBlob);
                // Then save the audio file with the transcription text
                result = await saveRecordedAudio(audioBlob, transcriptionResult.text);

                // Add transcription data to the result
                result.reference_text = transcriptionResult.text;
                result.is_english = transcriptionResult.is_english;
                result.language = transcriptionResult.language;
              } catch (transcriptionError) {
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
            // If auto-recognize is disabled or not F5-TTS, just save with the existing text
            result = await saveRecordedAudio(audioBlob, referenceText);
          }

          if (result && result.success) {
            const newReferenceAudio = {
              filepath: result.filepath,
              filename: result.filename,
              url: getAudioUrl(result.filename),
              language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
            };

            setReferenceAudio(newReferenceAudio);

            // Update reference text if auto-recognize is enabled or it was empty and we got it from transcription
            // Only update reference text for F5-TTS (which needs reference text)
            let finalReferenceText = referenceText;
            if (narrationMethod === 'f5tts') {
              finalReferenceText = (autoRecognize || (!referenceText && result.reference_text)) ? result.reference_text : referenceText;
              if (autoRecognize || (!referenceText && result.reference_text)) {
                setReferenceText(finalReferenceText);
              }
            }

            // Cache reference audio immediately after recording
            cacheReferenceAudio({
              filename: newReferenceAudio.filename,
              text: finalReferenceText || '',
              url: newReferenceAudio.url,
              filepath: newReferenceAudio.filepath
            }, 'recording');

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
            setError(result.error || t('narration.recordingError', 'Error saving recorded audio'));
          }
        } catch (error) {
          setError(error.message || t('narration.recordingError', 'Error saving recorded audio'));
        }

        // Reset recording timer after processing
        recordingStartTimeRef.current = null;
        if (typeof setRecordingStartTime === 'function') setRecordingStartTime(null);
      };

      mediaRecorderRef.current.start();
      recordingStartTimeRef.current = Date.now(); // Track recording start time
      if (typeof setRecordingStartTime === 'function') setRecordingStartTime(recordingStartTimeRef.current);
      setIsRecording(true);
      if (typeof setIsStartingRecording === 'function') setIsStartingRecording(false);
    } catch (error) {
      if (typeof setIsStartingRecording === 'function') setIsStartingRecording(false);
      setError(error.message || t('narration.microphoneError', 'Error accessing microphone'));
    }
  };

  // Handle recording stop
  const stopRecording = () => {
    if (mediaRecorderRef.current && setIsRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop all audio tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }

      // Note: Don't reset recordingStartTimeRef here as we need it in onstop handler
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
      // Only do voice recognition for F5-TTS (which needs reference text)
      if (autoRecognize && result && result.success && narrationMethod === 'f5tts') {
        setIsRecognizing(true);

        // Create a blob from the extracted audio URL
        try {
          // Set a timeout to prevent waiting too long (10 seconds)
          const recognitionTimeout = setTimeout(() => {
            setIsRecognizing(false);
            setError(t('narration.recognitionTimeout', 'Voice recognition is taking too long. Please try again or enter text manually.'));
          }, 10000); // Reduced from 30s to 10s for faster feedback

          // Fetch the audio file
          const audioUrl = getAudioUrl(result.filename);
          const response = await fetch(audioUrl, {
            mode: 'cors',
            credentials: 'include',
            headers: {
              'Accept': 'audio/*'
            }
          });
          const audioBlob = await response.blob();

          // Transcribe the audio
          try {
            const transcriptionResult = await transcribeAudio(audioBlob);
            // Add transcription data to the result
            result.reference_text = transcriptionResult.text;
            result.is_english = transcriptionResult.is_english;
            result.language = transcriptionResult.language;
          } catch (transcriptionError) {
            // If it's an API key error, show a specific message
            if (transcriptionError.message.includes('API key')) {
              setError(transcriptionError.message);
            }
          }

          // Clear the timeout
          clearTimeout(recognitionTimeout);

          // Reset recognizing state
          setIsRecognizing(false);
        } catch (error) {
          setIsRecognizing(false);
          // Don't throw the error, just continue with the extracted audio
        }
      }

      if (result && result.success) {
        const newReferenceAudio = {
          filepath: result.filepath,
          filename: result.filename,
          url: getAudioUrl(result.filename),
          language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
        };

        setReferenceAudio(newReferenceAudio);

        // Update reference text if auto-recognize is enabled or we got it from transcription
        // Only update reference text for F5-TTS (which needs reference text)
        let finalReferenceText = referenceText;
        if (narrationMethod === 'f5tts') {
          finalReferenceText = (autoRecognize || result.reference_text) ? result.reference_text : referenceText;
          if (autoRecognize || result.reference_text) {
            setReferenceText(finalReferenceText);
          }
        }

        // Cache reference audio immediately after extraction
        cacheReferenceAudio({
          filename: newReferenceAudio.filename,
          text: finalReferenceText || '',
          url: newReferenceAudio.url,
          filepath: newReferenceAudio.filepath
        }, 'extraction');

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

    // Clear reference audio cache
    try {
      localStorage.removeItem('reference_audio_cache');
      console.log('Cleared reference audio cache');
    } catch (error) {
      console.error('Error clearing reference audio cache:', error);
    }

    // Notify parent component
    if (onReferenceAudioChange) {
      onReferenceAudioChange(null);
    }
  };

  // Handle example audio selection
  const handleExampleSelect = async (result) => {
    try {
      if (result.success) {
        const audioUrl = getAudioUrl(result.filename);

        setReferenceAudio({
          filepath: result.filepath,
          filename: result.filename,
          url: audioUrl
        });

        // Update reference text if provided
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

        // Persist so this example voice is auto-restored on reload (uploads already do this).
        // Without it, a reload loses the reference voice and Chatterbox narration auto-reload fails.
        if (getCurrentMediaId()) {
          cacheReferenceAudio({
            filename: result.filename,
            text: result.reference_text || '',
            url: audioUrl,
            filepath: result.filepath
          });
        }
      } else {
        console.error('Example upload failed:', result.error);
        setError(result.error || t('narration.uploadError', 'Error uploading example audio'));
      }
    } catch (error) {
      console.error('Error handling example selection:', error);
      setError(t('narration.uploadError', 'Error uploading example audio'));
    }
  };

  return {
    handleFileUpload,
    startRecording,
    stopRecording,
    extractSegment,
    clearReferenceAudio,
    handleExampleSelect
  };
};

export default useAudioIO;
