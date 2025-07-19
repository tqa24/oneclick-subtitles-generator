/**
 * Service for interacting with Chatterbox TTS API
 */

const CHATTERBOX_API_BASE_URL = 'http://localhost:3011';
const SERVER_API_BASE_URL = 'http://localhost:3007';

// Track if Chatterbox service has been successfully initialized
let chatterboxServiceInitialized = false;

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check server health to see if Chatterbox service should be running
 * @returns {Promise<{shouldBeRunning: boolean, message?: string}>}
 */
const checkServerChatterboxStatus = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(`${SERVER_API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        shouldBeRunning: false,
        message: 'Server health check failed'
      };
    }

    const healthData = await response.json();
    const chatterboxRunning = healthData.services?.chatterbox?.running || false;

    return {
      shouldBeRunning: chatterboxRunning,
      message: chatterboxRunning ?
        'Chatterbox service should be running' :
        'Chatterbox service not started (use npm run dev:cuda)'
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        shouldBeRunning: false,
        message: 'Server health check timeout'
      };
    }

    return {
      shouldBeRunning: false,
      message: `Server health check error: ${error.message}`
    };
  }
};

/**
 * Single attempt to check Chatterbox API availability
 * @returns {Promise<{available: boolean, message?: string}>}
 */
const checkChatterboxAvailabilitySingle = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${CHATTERBOX_API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        message: `Chatterbox API returned status ${response.status}`
      };
    }

    const healthData = await response.json();

    // Check if TTS model is loaded
    if (!healthData.models_loaded?.tts) {
      return {
        available: false,
        message: 'Chatterbox TTS model is not loaded'
      };
    }

    // Mark service as initialized when health check passes with TTS model loaded
    chatterboxServiceInitialized = true;

    return {
      available: true,
      device: healthData.device,
      models: healthData.models_loaded
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        available: false,
        message: 'Chatterbox API timeout - service may not be running'
      };
    }

    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      return {
        available: false,
        message: 'Chatterbox API is not running. Please start the Chatterbox service.'
      };
    }

    return {
      available: false,
      message: `Chatterbox API error: ${error.message}`
    };
  }
};

/**
 * Check if Chatterbox API is available with retry logic
 * @param {number} maxAttempts - Maximum number of attempts (default: 10)
 * @param {number} delayMs - Delay between attempts in milliseconds (default: 3000)
 * @returns {Promise<{available: boolean, message?: string}>}
 */
export const checkChatterboxAvailability = async (maxAttempts = 10, delayMs = 3000) => {
  // First, check if the server says Chatterbox should be running
  const serverStatus = await checkServerChatterboxStatus();

  if (!serverStatus.shouldBeRunning) {
    return {
      available: false,
      message: serverStatus.message || 'Chatterbox service not started (use npm run dev:cuda)'
    };
  }

  // If server says it should be running, try to connect to the actual API
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await checkChatterboxAvailabilitySingle();

      // If successful, return immediately
      if (result.available) {
        return result;
      }

      // Store the error for potential final return
      lastError = result;

      // If this is the last attempt, don't wait
      if (attempt === maxAttempts) {
        break;
      }

      // Wait before next attempt
      await sleep(delayMs);

    } catch (error) {
      lastError = {
        available: false,
        message: `Chatterbox API error: ${error.message}`
      };

      // If this is the last attempt, don't wait
      if (attempt === maxAttempts) {
        break;
      }

      // Wait before next attempt
      await sleep(delayMs);
    }
  }

  // Return the last error if all attempts failed
  return lastError || {
    available: false,
    message: 'Chatterbox API is not available after multiple attempts'
  };
};

/**
 * Generate speech using Chatterbox TTS
 * @param {string} text - Text to synthesize
 * @param {number} exaggeration - Emotional intensity (0.25-2.0)
 * @param {number} cfgWeight - CFG/Pace control (0.0-1.0)
 * @param {File|null} voiceFile - Optional voice reference file
 * @param {string|null} voiceFilePath - Optional voice reference file path (more efficient than uploading)
 * @returns {Promise<Blob>} - Audio blob
 */
export const generateChatterboxSpeech = async (text, exaggeration = 0.5, cfgWeight = 0.5, voiceFile = null, voiceFilePath = null) => {
  try {
    // Determine which endpoint to use
    let endpoint, url;
    if (voiceFilePath) {
      // Use path-based endpoint (more efficient for local files)
      endpoint = '/tts/generate-with-voice-path';
      url = `${CHATTERBOX_API_BASE_URL}${endpoint}`;
    } else if (voiceFile) {
      // Use file upload endpoint
      endpoint = '/tts/generate-with-voice';
      url = `${CHATTERBOX_API_BASE_URL}${endpoint}`;
    } else {
      // Use default voice endpoint
      endpoint = '/tts/generate';
      url = `${CHATTERBOX_API_BASE_URL}${endpoint}`;
    }



    let body;
    let headers = {};

    if (voiceFilePath) {
      // Use JSON for path-based generation
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        text,
        exaggeration,
        cfg_weight: cfgWeight,
        voice_file_path: voiceFilePath
      });
    } else if (voiceFile) {
      // Use FormData for file upload
      const formData = new FormData();
      formData.append('text', text);
      formData.append('exaggeration', exaggeration.toString());
      formData.append('cfg_weight', cfgWeight.toString());
      formData.append('voice_file', voiceFile);
      body = formData;
      // Don't set Content-Type header, let browser set it with boundary
    } else {
      // Use JSON for text-only generation
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        text,
        exaggeration,
        cfg_weight: cfgWeight
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chatterbox API error: ${response.status} - ${errorText}`);
    }

    // Return the audio blob
    return await response.blob();
  } catch (error) {
    console.error('Error generating Chatterbox speech:', error);

    if (error.name === 'AbortError') {
      throw new Error('Chatterbox generation timeout - text may be too long');
    }

    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Chatterbox API is not running. Please start the Chatterbox service.');
    }

    throw error;
  }
};

/**
 * Convert voice using Chatterbox VC
 * @param {File} inputAudio - Input audio file to convert
 * @param {File} targetVoice - Target voice reference file
 * @returns {Promise<Blob>} - Converted audio blob
 */
export const convertChatterboxVoice = async (inputAudio, targetVoice) => {
  try {
    const formData = new FormData();
    formData.append('input_audio', inputAudio);
    formData.append('target_voice', targetVoice);

    const response = await fetch(`${CHATTERBOX_API_BASE_URL}/vc/convert`, {
      method: 'POST',
      body: formData,
      // Add timeout for voice conversion
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chatterbox VC error: ${response.status} - ${errorText}`);
    }

    // Return the converted audio blob
    return await response.blob();
  } catch (error) {
    console.error('Error converting voice with Chatterbox:', error);
    
    if (error.name === 'TimeoutError') {
      throw new Error('Chatterbox voice conversion timeout');
    }
    
    throw error;
  }
};

/**
 * Get Chatterbox API health status
 * @returns {Promise<Object>} - Health status object
 */
export const getChatterboxHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${CHATTERBOX_API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Chatterbox health check timeout');
    }

    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Chatterbox API is not running');
    }

    throw error;
  }
};

/**
 * Check if Chatterbox service has been initialized
 * @returns {boolean} - Whether the service has been initialized
 */
export const isChatterboxServiceInitialized = () => {
  return chatterboxServiceInitialized;
};

/**
 * Reset Chatterbox service initialization status
 * Used for testing or when service needs to be re-initialized
 */
export const resetChatterboxServiceInitialization = () => {
  chatterboxServiceInitialized = false;
};

/**
 * Quick check if Chatterbox should be available based on server configuration
 * This provides immediate feedback without API calls, similar to F5-TTS
 * @returns {Promise<{available: boolean, message?: string}>}
 */
export const checkChatterboxShouldBeAvailable = async () => {
  return await checkServerChatterboxStatus();
};
