import { transcribeAudio } from '../../../services/transcriptionService';
import {
  uploadReferenceAudio,
  saveRecordedAudio,
  extractAudioSegment,
  getAudioUrl,
  generateNarration,
  cancelNarrationGeneration
} from '../../../services/narrationService';
import { isModelAvailable } from '../../../services/modelAvailabilityService';

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
  setError,
  autoRecognize,
  segmentStartTime,
  segmentEndTime,
  videoPath,
  onReferenceAudioChange,
  getSelectedSubtitles,
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
        setReferenceAudio({
          filepath: result.filepath,
          filename: result.filename,
          url: getAudioUrl(result.filename),
          language: result.language || (result.is_english === false ? 'a non-English language' : 'English')
        });

        // Update reference text if auto-recognize is enabled or we got it from transcription
        if (autoRecognize || result.reference_text) {
          setReferenceText(result.reference_text);
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

    // Check if a subtitle source has been selected
    if (!subtitleSource) {
      setError(t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)'));
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

    // Check if the selected model is available
    try {
      // Get the model ID from the selectedNarrationModel prop or use the default
      const modelId = selectedNarrationModel || 'f5tts-v1-base';

      // Check if the model is available
      const modelAvailable = await isModelAvailable(modelId);
      if (!modelAvailable) {
        // Get the language from the selected subtitles
        const subtitles = getSelectedSubtitles();
        let language = 'unknown';

        if (subtitles && subtitles.length > 0) {
          // Try to determine the language from the subtitles
          if (subtitleSource === 'original' && originalLanguage) {
            language = originalLanguage.languageName || originalLanguage.languageCode;
          } else if (subtitleSource === 'translated' && translatedLanguage) {
            language = translatedLanguage.languageName || translatedLanguage.languageCode;
          }
        }

        setError(t('narration.modelNotAvailableError', 'Please download at least one model that supports {{language}} from the Narration Model Management tab in Settings.', { language }));
        return;
      }
    } catch (error) {
      console.error('Error checking model availability:', error);
      // Continue anyway, the server will handle the error if the model is not available
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
        batchSize: advancedSettings.batchSize === 'all' ? subtitlesWithIds.length : parseInt(advancedSettings.batchSize),
        // Include the selected model ID
        modelId: selectedNarrationModel
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
        // Check if this is a cancellation error
        if (error.cancelled) {
          setError(t('narration.generationCancelled', 'Narration generation cancelled by user'));
          return;
        }

        // Handle other errors
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
  const downloadAllAudio = async () => {
    // Check if we have any generation results
    if (!generationResults || generationResults.length === 0) {
      alert(t('narration.noResults', 'No narration results to download'));
      return;
    }

    // Create a loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.background = 'rgba(0, 0, 0, 0.7)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.zIndex = '9999';
    loadingIndicator.textContent = t('narration.downloading', 'Downloading audio files...');
    document.body.appendChild(loadingIndicator);

    try {
      // Get the server URL from the narration service
      const { SERVER_URL } = require('../../../config');

      // Extract filenames from generation results
      const filenames = generationResults.map(result => result.filename);
      console.log('Downloading files:', filenames);

      // Create a download link with the filenames as query parameters
      const downloadUrl = `${SERVER_URL}/api/narration/download-all`;

      // Use fetch API to download the file
      console.log('Fetching:', downloadUrl);
      const response = await fetch(downloadUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/octet-stream'
        },
        body: JSON.stringify({ filenames })
      });
      console.log('Response status:', response.status);

      // Check if the response is successful
      if (!response.ok) {
        // Try to parse error message if it's JSON
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to download audio files');
        } catch (jsonError) {
          // If it's not JSON, use the status text
          throw new Error(`Failed to download audio files: ${response.statusText}`);
        }
      }

      // Get the blob from the response
      const blob = await response.blob();
      console.log('Blob size:', blob.size);

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = 'narration_audio.zip';
      a.target = '_blank'; // Open in a new tab to avoid redirecting
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error downloading all audio:', error);
      alert(t('narration.downloadError', `Error downloading audio files: ${error.message}`));
    } finally {
      // Remove loading indicator
      document.body.removeChild(loadingIndicator);
    }
  };

  // Download aligned narration audio (one file)
  const downloadAlignedAudio = async () => {
    // Check if we have any generation results
    if (!generationResults || generationResults.length === 0) {
      alert(t('narration.noResults', 'No narration results to download'));
      return;
    }

    // Create a loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.background = 'rgba(0, 0, 0, 0.7)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.zIndex = '9999';
    loadingIndicator.textContent = t('narration.downloading', 'Downloading audio file...');
    document.body.appendChild(loadingIndicator);

    try {
      // Get the server URL from the narration service
      const { SERVER_URL } = require('../../../config');

      // Get all subtitles from the video for timing information
      const allSubtitles = [];

      // First try to get subtitles from the getSelectedSubtitles function
      const selectedSubtitles = getSelectedSubtitles();
      if (selectedSubtitles && Array.isArray(selectedSubtitles) && selectedSubtitles.length > 0) {
        console.log('Using selected subtitles for timing information');
        allSubtitles.push(...selectedSubtitles);
      }

      // Also try window.subtitles (main source)
      if (window.subtitles && Array.isArray(window.subtitles)) {
        console.log('Using window.subtitles for timing information');
        allSubtitles.push(...window.subtitles);
      }

      // Also try original and translated subtitles
      if (window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
        console.log('Using window.originalSubtitles for timing information');
        allSubtitles.push(...window.originalSubtitles);
      }

      if (window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
        console.log('Using window.translatedSubtitles for timing information');
        allSubtitles.push(...window.translatedSubtitles);
      }

      // Create a map for faster lookup
      const subtitleMap = {};
      allSubtitles.forEach(sub => {
        if (sub.id !== undefined) {
          subtitleMap[sub.id] = sub;
        }
      });

      console.log('Found subtitle timing information for IDs:', Object.keys(subtitleMap));

      // Prepare the data for the aligned narration with correct timing
      const narrationData = generationResults
        .filter(result => result.success && result.filename)
        .map(result => {
          // Find the corresponding subtitle for timing information
          const subtitle = subtitleMap[result.subtitle_id];

          // If we found a matching subtitle, use its timing
          if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
            console.log(`Found timing for subtitle ${result.subtitle_id}: ${subtitle.start}s - ${subtitle.end}s`);
            return {
              filename: result.filename,
              subtitle_id: result.subtitle_id,
              start: subtitle.start,
              end: subtitle.end,
              text: subtitle.text || result.text || ''
            };
          }

          // Otherwise, use existing timing or defaults
          return {
            filename: result.filename,
            subtitle_id: result.subtitle_id,
            start: result.start || 0,
            end: result.end || (result.start ? result.start + 5 : 5),
            text: result.text || ''
          };
        });

      // Sort by start time to ensure correct order
      narrationData.sort((a, b) => a.start - b.start);

      console.log('Generating aligned narration for:', narrationData);

      // Create a download link
      const downloadUrl = `${SERVER_URL}/api/narration/download-aligned`;

      // Use fetch API to download the file
      console.log('Fetching:', downloadUrl);
      const response = await fetch(downloadUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/wav'
        },
        body: JSON.stringify({ narrations: narrationData })
      });
      console.log('Response status:', response.status);

      // Check if the response is successful
      if (!response.ok) {
        // Try to parse error message if it's JSON
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to download aligned audio');
        } catch (jsonError) {
          // If it's not JSON, use the status text
          throw new Error(`Failed to download aligned audio: ${response.statusText}`);
        }
      }

      // Get the blob from the response
      const blob = await response.blob();
      console.log('Blob size:', blob.size);

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aligned_narration.wav';
      a.target = '_blank'; // Open in a new tab to avoid redirecting
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error downloading aligned audio:', error);
      alert(t('narration.downloadError', `Error downloading aligned audio file: ${error.message}`));
    } finally {
      // Remove loading indicator
      document.body.removeChild(loadingIndicator);
    }
  };

  // Cancel narration generation
  const cancelGeneration = () => {
    if (isGenerating) {
      const cancelled = cancelNarrationGeneration();
      if (cancelled) {
        console.log('Narration generation cancelled');
        // We don't set isGenerating to false here because the abort will trigger the error handler
        // which will set isGenerating to false
      } else {
        console.log('No active narration generation to cancel');
      }
    }
  };

  return {
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
  };
};

export default useNarrationHandlers;
