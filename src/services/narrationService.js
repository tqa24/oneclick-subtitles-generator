/**
 * Narration service for F5-TTS integration
 */

import { API_BASE_URL, SERVER_URL } from '../config';

/**
 * Convert a Blob to base64 string
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} - Base64 string
 */
// This function is currently unused but kept for future reference
/*
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
*/

// Log the API_BASE_URL for debugging
console.log('Narration service using API_BASE_URL:', API_BASE_URL);

/**
 * Check if the narration service is available with multiple attempts
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @param {boolean} quietMode - If true, reduces console logging
 * @returns {Promise<Object>} - Status response
 */
export const checkNarrationStatusWithRetry = async (maxAttempts = 20, delayMs = 10000, quietMode = false) => {
  if (!quietMode) {
    console.log(`Checking narration service with ${maxAttempts} attempts, ${delayMs}ms delay between attempts`);
  }

  // First, check if the Express server is available
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (!healthResponse.ok) {
      // If the Express server is not available, don't even try to check narration service
      return {
        available: false,
        error: "Express server is not available",
        message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
      };
    }
  } catch (error) {
    // Express server is not available
    return {
      available: false,
      error: "Express server is not available",
      message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
    };
  }

  // Now check the narration service
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!quietMode) {
        console.log(`Attempt ${attempt}/${maxAttempts} to check narration service status`);
      }

      const response = await fetch(`${API_BASE_URL}/narration/status`);

      if (!response.ok) {
        if (!quietMode) {
          console.log(`Server returned ${response.status} on attempt ${attempt}/${maxAttempts}`);
        }

        if (attempt < maxAttempts) {
          if (!quietMode) {
            console.log(`Waiting ${delayMs}ms before next attempt...`);
          }
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        // Using hardcoded Vietnamese message here because i18n context is not available in this service
        // This message matches the translation key 'serviceUnavailableMessage'
        return {
          available: false,
          error: `Server returned ${response.status}`,
          message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
        };
      }

      const data = await response.json();

      if (data.available) {
        if (!quietMode) {
          console.log(`Narration service is available on attempt ${attempt}/${maxAttempts}!`);
        }
        return data;
      }

      if (!quietMode) {
        console.log(`Service responded but not available on attempt ${attempt}/${maxAttempts}`);
      }

      if (attempt < maxAttempts) {
        if (!quietMode) {
          console.log(`Waiting ${delayMs}ms before next attempt...`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Using hardcoded Vietnamese message here because i18n context is not available in this service
        // This message matches the translation key 'serviceUnavailableMessage'
        data.message = "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được.";
        return data;
      }
    } catch (error) {
      if (!quietMode) {
        console.log(`Error checking narration service on attempt ${attempt}/${maxAttempts}: ${error.message}`);
      }

      if (attempt < maxAttempts) {
        if (!quietMode) {
          console.log(`Waiting ${delayMs}ms before next attempt...`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Using hardcoded Vietnamese message here because i18n context is not available in this service
        // This message matches the translation key 'serviceUnavailableMessage'
        return {
          available: false,
          error: error.message,
          message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
        };
      }
    }
  }

  // If we get here, all attempts failed
  return {
    available: false,
    error: "All attempts to check narration service failed",
    message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
  };
};

/**
 * Check if the narration service is available (simple version without retries)
 * @returns {Promise<Object>} - Status response
 */
export const checkNarrationStatus = async () => {
  // First, check if the Express server is available
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (!healthResponse.ok) {
      // If the Express server is not available, don't even try to check narration service
      return {
        available: false,
        error: "Express server is not available",
        message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
      };
    }
  } catch (error) {
    // Express server is not available
    return {
      available: false,
      error: "Express server is not available",
      message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
    };
  }

  // Now check the narration service
  try {
    const response = await fetch(`${API_BASE_URL}/narration/status`);

    if (!response.ok) {
      // Using hardcoded Vietnamese message here because i18n context is not available in this service
      // This message matches the translation key 'serviceUnavailableMessage'
      return {
        available: false,
        error: `Server returned ${response.status}`,
        message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
      };
    }

    const data = await response.json();
    if (!data.available) {
      // Using hardcoded Vietnamese message here because i18n context is not available in this service
      // This message matches the translation key 'serviceUnavailableMessage'
      data.message = "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được.";
    }
    return data;
  } catch (error) {
    // Using hardcoded Vietnamese message here because i18n context is not available in this service
    // This message matches the translation key 'serviceUnavailableMessage'
    return {
      available: false,
      error: error.message,
      message: "Vui lòng chạy ứng dụng bằng npm run dev:cuda để dùng chức năng Thuyết minh. Nếu đã chạy bằng npm run dev:cuda, vui lòng đợi khoảng 1 phút sẽ dùng được."
    };
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
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      await response.text(); // Read the response body to avoid memory leaks
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();
    return data;
  } catch (error) {
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
    // Use the original blob directly with FormData
    const formData = new FormData();

    // Make sure we have a proper filename with extension
    formData.append('audio_data', audioBlob, 'recorded_audio.wav');

    // Add reference text if provided
    formData.append('reference_text', referenceText || '');

    // Add a flag to indicate whether to perform transcription
    // If referenceText is empty, we want to transcribe
    const shouldTranscribe = !referenceText;
    formData.append('transcribe', shouldTranscribe.toString());

    const response = await fetch(`${API_BASE_URL}/narration/record-reference`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      await response.text(); // Read the response body to avoid memory leaks
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();
    return data;
  } catch (error) {
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
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      await response.text(); // Read the response body to avoid memory leaks
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
};

// Create a global AbortController for narration generation
let narrationAbortController = null;

// Flag to track if the narration service has been initialized
let narrationServiceInitialized = false;

/**
 * Cancel ongoing narration generation
 * @returns {boolean} - Whether cancellation was successful
 */
export const cancelNarrationGeneration = () => {
  if (narrationAbortController) {
    console.log('Cancelling narration generation');
    narrationAbortController.abort();
    narrationAbortController = null;
    return true;
  }
  return false;
};

/**
 * Clear all narration output files for fresh generation
 * @returns {Promise<boolean>} - Whether clearing was successful
 */
export const clearNarrationOutput = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/narration/clear-output`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Failed to clear narration output: ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log('Cleared narration output files:', data.message);
    return true;
  } catch (error) {
    console.error('Error clearing narration output:', error);
    return false;
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
    // Clear all narration output files before generating new ones
    await clearNarrationOutput();

    // Initial progress message for waking up the server - only on first run
    // Using hardcoded Vietnamese messages here because i18n context is not available in this service
    // These messages match the translation keys 'initializingService' and 'preparingNarration'
    if (!narrationServiceInitialized) {
      onProgress("Đang đánh thức server thuyết minh cho lần đầu chạy...");
    } else {
      onProgress("Đang chuẩn bị tạo thuyết minh...");
    }
    // Create a new AbortController for this request
    narrationAbortController = new AbortController();
    const signal = narrationAbortController.signal;

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
      }),
      signal // Add the abort signal to the fetch request
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    // Check if the response is a stream
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      // Handle streaming response

      // Create a reader for the response body
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const results = [];

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and add it to the buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete events in the buffer
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep the last incomplete event in the buffer

        for (const event of events) {
          if (event.trim() && event.startsWith('data: ')) {
            try {
              // Parse the JSON data
              let data;
              try {
                data = JSON.parse(event.substring(6));
              } catch (parseError) {
                continue;
              }

              // Handle different event types
              if (!data || !data.type) {
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
                        return { success: false, error: data.error };
                      }
                    } else {
                      onError('Unknown error occurred');
                    }
                    break;

                  case 'complete':
                    // Mark the narration service as initialized
                    narrationServiceInitialized = true;
                    onComplete(data.results || results);
                    return { success: true, results: data.results || results };
                }
              } catch (eventError) {
                // Silently handle event errors
              }
            } catch (error) {
              // Silently handle parsing errors
            }
          }
        }
      }

      // If we get here, the stream ended without a complete event
      onComplete(results);
      return { success: true, results };
    } else if (contentType && contentType.includes('application/json')) {
      // Handle regular JSON response (fallback)
      const data = await response.json();

      if (data.results) {
        // Call onResult for each result
        data.results.forEach((result, index) => {
          onResult(result, index + 1, data.results.length);
        });

        // Mark the narration service as initialized
        narrationServiceInitialized = true;

        // Call onComplete with all results
        onComplete(data.results);
      }

      return data;
    } else {
      // Handle unexpected content type
      await response.text(); // Read the response body to avoid memory leaks
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  } catch (error) {
    // Clean up the AbortController
    narrationAbortController = null;

    // Check if this is an abort error
    if (error.name === 'AbortError') {
      const cancelError = new Error('Narration generation cancelled by user');
      cancelError.cancelled = true;
      onError(cancelError);
      return { success: false, cancelled: true, error: 'Cancelled by user' };
    }

    // Handle other errors
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
  return `${SERVER_URL}/api/narration/audio/${filename}`;
};
