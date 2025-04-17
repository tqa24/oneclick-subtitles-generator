/**
 * Narration service for F5-TTS integration
 */

import { API_BASE_URL, SERVER_URL } from '../config';

/**
 * Convert a Blob to base64 string
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} - Base64 string
 */
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    if (!blob || blob.size === 0) {
      console.error('Invalid blob provided to blobToBase64:', blob);
      reject(new Error('Invalid or empty blob'));
      return;
    }

    console.log('Converting blob to base64, type:', blob.type, 'size:', blob.size);

    const reader = new FileReader();

    reader.onloadend = () => {
      try {
        if (!reader.result) {
          console.error('FileReader result is empty');
          reject(new Error('FileReader result is empty'));
          return;
        }

        // Log the first few characters of the result to help with debugging
        console.log('FileReader result starts with:', reader.result.substring(0, 50) + '...');

        // Check if the result contains a comma (data URL format)
        if (reader.result.indexOf(',') === -1) {
          console.error('FileReader result is not in expected format');
          reject(new Error('FileReader result is not in expected format'));
          return;
        }

        // Remove the data URL prefix (e.g., 'data:audio/wav;base64,')
        const base64String = reader.result.split(',')[1];

        if (!base64String) {
          console.error('Failed to extract base64 data from FileReader result');
          reject(new Error('Failed to extract base64 data'));
          return;
        }

        console.log('Successfully converted blob to base64, length:', base64String.length);
        resolve(base64String);
      } catch (error) {
        console.error('Error in FileReader onloadend:', error);
        reject(error);
      }
    };

    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      reject(error);
    };

    try {
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error calling readAsDataURL:', error);
      reject(error);
    }
  });
};

// Log the API_BASE_URL for debugging
console.log('Narration service using API_BASE_URL:', API_BASE_URL);

/**
 * Check if the narration service is available
 * @returns {Promise<Object>} - Status response
 */
export const checkNarrationStatus = async () => {
  try {
    console.log('Checking narration service status');
    const response = await fetch(`${API_BASE_URL}/narration/status`);

    if (!response.ok) {
      console.error('Narration service status check failed:', response.status);
      return { available: false, error: `Server returned ${response.status}` };
    }

    const data = await response.json();
    console.log('Narration service status:', data);
    return data;
  } catch (error) {
    console.error('Error checking narration status:', error);
    return { available: false, error: error.message };
  }
};

/**
 * Upload a reference audio file
 * @param {File} file - Audio file to upload
 * @param {string} referenceText - Optional reference text for the audio
 * @returns {Promise<Object>} - Upload response
 */
export const uploadReferenceAudio = async (file, referenceText = '') => {
  try {
    console.log('Uploading reference audio file:', file.name, 'size:', file.size);

    const formData = new FormData();
    formData.append('file', file);

    if (referenceText) {
      formData.append('reference_text', referenceText);
    }

    const response = await fetch(`${API_BASE_URL}/narration/upload-reference`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server returned error:', response.status, errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Server returned non-JSON response:', text);
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();
    console.log('Upload response:', data);
    return data;
  } catch (error) {
    console.error('Error uploading reference audio:', error);
    throw error;
  }
};

/**
 * Save recorded audio as reference
 * @param {Blob} audioBlob - Recorded audio blob
 * @param {string} referenceText - Optional reference text for the audio
 * @returns {Promise<Object>} - Upload response
 */
export const saveRecordedAudio = async (audioBlob, referenceText = '') => {
  try {
    console.log('Saving recorded audio, blob size:', audioBlob.size, 'type:', audioBlob.type);
    console.time('saveRecordedAudio'); // Start timing

    // Simplify: Use the original blob directly with FormData
    // This is the most reliable approach
    const formData = new FormData();

    // Make sure we have a proper filename with extension
    formData.append('audio_data', audioBlob, 'recorded_audio.wav');

    // Add reference text if provided
    formData.append('reference_text', referenceText || '');

    // Add a flag to indicate whether to perform transcription
    // If referenceText is empty, we want to transcribe
    const shouldTranscribe = !referenceText;
    formData.append('transcribe', shouldTranscribe.toString());

    console.log('Should transcribe:', shouldTranscribe, 'Reference text:', referenceText ? 'provided' : 'empty');

    console.log('Sending FormData request with original blob');
    console.timeLog('saveRecordedAudio', 'FormData prepared'); // Log time for preparation

    const response = await fetch(`${API_BASE_URL}/narration/record-reference`, {
      method: 'POST',
      body: formData
    });

    console.log('Received response from server');
    console.timeLog('saveRecordedAudio', 'Server response received'); // Log time for server response

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server returned error:', response.status, errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Server returned non-JSON response:', text);
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();
    console.log('Received response data:', data);
    console.timeEnd('saveRecordedAudio'); // End timing
    return data;
  } catch (error) {
    console.error('Error saving recorded audio:', error);
    console.timeEnd('saveRecordedAudio'); // End timing even on error
    throw error;
  }
};

/**
 * Extract audio segment from video
 * @param {string} videoPath - Path to the video file
 * @param {number|string} startTime - Start time in seconds or "HH:MM:SS" format
 * @param {number|string} endTime - End time in seconds or "HH:MM:SS" format
 * @returns {Promise<Object>} - Extraction response
 */
export const extractAudioSegment = async (videoPath, startTime, endTime) => {
  try {
    console.log('Extracting audio segment:', { videoPath, startTime, endTime });

    const response = await fetch(`${API_BASE_URL}/narration/extract-segment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_path: videoPath,
        start_time: startTime,
        end_time: endTime,
        transcribe: true  // Always request transcription for extracted segments
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server returned error:', response.status, errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Server returned non-JSON response:', text);
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();
    console.log('Extraction response:', data);
    return data;
  } catch (error) {
    console.error('Error extracting audio segment:', error);
    throw error;
  }
};

/**
 * Generate narration for subtitles with streaming response
 * @param {string} referenceAudio - Path to reference audio file
 * @param {string} referenceText - Reference text for the audio
 * @param {Array} subtitles - Array of subtitle objects
 * @param {Object} settings - Advanced settings for narration generation
 * @param {Function} onProgress - Callback for progress updates
 * @param {Function} onResult - Callback for each result
 * @param {Function} onError - Callback for errors
 * @param {Function} onComplete - Callback for completion
 * @returns {Promise<Object>} - Generation response
 */
export const generateNarration = async (
  referenceAudio,
  referenceText,
  subtitles,
  settings = {},
  onProgress = () => {},
  onResult = () => {},
  onError = () => {},
  onComplete = () => {}
) => {
  try {
    console.log('Generating narration:', {
      referenceAudio,
      referenceText,
      subtitlesCount: subtitles.length,
      settings
    });

    // Create a fetch request with streaming response
    const response = await fetch(`${API_BASE_URL}/narration/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference_audio: referenceAudio,
        reference_text: referenceText,
        subtitles: subtitles,
        settings: settings
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server returned error:', response.status, errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    // Check if the response is a stream
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      // Handle streaming response
      console.log('Received streaming response');

      // Create a reader for the response body
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const results = [];

      // Process the stream
      console.log('Starting to process streaming response');
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('Stream complete');
          break;
        }

        // Decode the chunk and add it to the buffer
        const chunk = decoder.decode(value, { stream: true });
        console.log(`Received chunk: ${chunk.substring(0, 50)}...`);
        buffer += chunk;

        // Process complete events in the buffer
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep the last incomplete event in the buffer

        console.log(`Processing ${events.length} events from buffer`);
        if (events.length > 0) {
          console.log(`First event: ${events[0].substring(0, 50)}...`);
        }

        for (const event of events) {
          if (event.trim() && event.startsWith('data: ')) {
            try {
              // Parse the JSON data
              let data;
              try {
                data = JSON.parse(event.substring(6));
                console.log('Received event:', data.type);
              } catch (parseError) {
                console.error('Error parsing event data:', parseError, 'Event:', event);
                continue;
              }

              // Handle different event types
              if (!data || !data.type) {
                console.error('Invalid event data:', data);
                continue;
              }

              try {
                switch (data.type) {
                  case 'progress':
                    if (data.message) {
                      onProgress(data.message, data.current || 0, data.total || 0);
                    }
                    break;

                  case 'result':
                    if (data.result) {
                      results.push(data.result);
                      onResult(data.result, data.progress || results.length, data.total || 0);
                    }
                    break;

                  case 'error':
                    if (data.result) {
                      onError(data.result);
                    } else if (data.error) {
                      onError(data.error);
                      // If this is a model initialization error, stop processing
                      if (data.error.includes('F5-TTS model initialization failed') ||
                          data.error.includes('Error initializing F5-TTS') ||
                          data.error.includes('Model is not available')) {
                        console.error('Critical model error, stopping processing');
                        return { success: false, error: data.error };
                      }
                    } else {
                      onError('Unknown error occurred');
                    }
                    break;

                  case 'complete':
                    onComplete(data.results || results);
                    return { success: true, results: data.results || results };

                  default:
                    console.warn('Unknown event type:', data.type);
                }
              } catch (eventError) {
                console.error('Error handling event:', eventError, 'Event data:', data);
              }
            } catch (error) {
              console.error('Error parsing event data:', error, 'Event:', event);
            }
          }
        }
      }

      // If we get here, the stream ended without a complete event
      onComplete(results);
      return { success: true, results };
    } else if (contentType && contentType.includes('application/json')) {
      // Handle regular JSON response (fallback)
      console.log('Received JSON response');
      const data = await response.json();
      console.log('Generation response:', data);

      if (data.results) {
        // Call onResult for each result
        data.results.forEach((result, index) => {
          onResult(result, index + 1, data.results.length);
        });

        // Call onComplete with all results
        onComplete(data.results);
      }

      return data;
    } else {
      // Handle unexpected content type
      const text = await response.text();
      console.error('Server returned unexpected content type:', contentType, 'Response:', text);
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  } catch (error) {
    console.error('Error generating narration:', error);
    onError(error);
    throw error;
  }
};

/**
 * Get audio file URL
 * @param {string} filename - Audio filename
 * @returns {string} - Audio file URL
 */
export const getAudioUrl = (filename) => {
  const url = `${SERVER_URL}/narration/audio/${filename}`;
  console.log('Generated audio URL:', url);
  return url;
};
