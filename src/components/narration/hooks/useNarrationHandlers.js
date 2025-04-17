import { transcribeAudio } from '../../../services/transcriptionService';
import {
  uploadReferenceAudio,
  saveRecordedAudio,
  extractAudioSegment,
  getAudioUrl,
  generateNarration
} from '../../../services/narrationService';

/**
 * Custom hook for narration handlers
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
  setIsExtractingSegment,
  setIsRecognizing,
  setLanguageWarning,
  setError,
  autoRecognize,
  segmentStartTime,
  segmentEndTime,
  videoPath,
  onReferenceAudioChange,
  getSelectedSubtitles,
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
}) => {
  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    try {
      let result;

      // First upload the file without transcription
      result = await uploadReferenceAudio(file, referenceText);

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
          setReferenceText(result.reference_text);

          // Check if the audio is not in English
          if (result.is_english === false) {
            setLanguageWarning(true);
          } else {
            // Make sure to reset the language warning if it's English
            setLanguageWarning(false);
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

        setRecordedAudio({
          blob: audioBlob,
          url: audioUrl
        });

        // Save the recorded audio
        try {
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
            // If auto-recognize is disabled, just save with the existing text
            result = await saveRecordedAudio(audioBlob, referenceText);
          }

          if (result && result.success) {
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
              } else {
                // Make sure to reset the language warning if it's English
                setLanguageWarning(false);
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
            setError(result.error || t('narration.recordingError', 'Error saving recorded audio'));
          }
        } catch (error) {
          setError(error.message || t('narration.recordingError', 'Error saving recorded audio'));
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
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
          const response = await fetch(audioUrl);
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
          } else {
            // Make sure to reset the language warning if it's English
            setLanguageWarning(false);
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

      // Generate narration with streaming response
      const tempResults = [];

      // Define callbacks for the streaming response
      const handleProgress = (message, current, total) => {
        setGenerationStatus(message);
      };

      const handleResult = (result, progress, total) => {
        // Add the result to the temporary results array
        tempResults.push(result);
        // Update the UI with the current results
        setGenerationResults([...tempResults]);
        // Update the status
        setGenerationStatus(
          t(
            'narration.generatingProgress',
            'Generated {{progress}} of {{total}} narrations...',
            {
              progress,
              total
            }
          )
        );
      };

      const handleError = (error) => {
        if (typeof error === 'object' && error.error) {
          setError(`${t('narration.generationError', 'Error generating narration')}: ${error.error}`);
        } else if (typeof error === 'string') {
          setError(`${t('narration.generationError', 'Error generating narration')}: ${error}`);
        } else {
          setError(t('narration.generationError', 'Error generating narration'));
        }
      };

      const handleComplete = (results) => {
        setGenerationStatus(t('narration.generationComplete', 'Narration generation complete'));
        // Ensure we have the final results
        setGenerationResults(results);
      };

      // Call the generateNarration function with callbacks
      const result = await generateNarration(
        referenceAudio.filepath,
        referenceAudio.text || referenceText,
        subtitlesWithIds,
        apiSettings,
        handleProgress,
        handleResult,
        handleError,
        handleComplete
      );

      if (!result || !result.success) {
        setError(result?.error || t('narration.generationError', 'Error generating narration'));
      }
    } catch (error) {
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

  return {
    handleFileUpload,
    startRecording,
    stopRecording,
    extractSegment,
    clearReferenceAudio,
    handleGenerateNarration,
    playAudio,
    downloadAllAudio
  };
};

export default useNarrationHandlers;
