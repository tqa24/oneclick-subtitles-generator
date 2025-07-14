/**
 * Service for interacting with Chatterbox TTS API
 */

const CHATTERBOX_API_BASE_URL = 'http://localhost:3011';

/**
 * Check if Chatterbox API is available
 * @returns {Promise<{available: boolean, message?: string}>}
 */
export const checkChatterboxAvailability = async () => {
  try {
    const response = await fetch(`${CHATTERBOX_API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

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

    return {
      available: true,
      device: healthData.device,
      models: healthData.models_loaded
    };
  } catch (error) {
    console.error('Error checking Chatterbox availability:', error);
    
    if (error.name === 'TimeoutError') {
      return {
        available: false,
        message: 'Chatterbox API timeout - service may not be running'
      };
    }
    
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch')) {
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
 * Generate speech using Chatterbox TTS
 * @param {string} text - Text to synthesize
 * @param {number} exaggeration - Emotional intensity (0.25-2.0)
 * @param {number} cfgWeight - CFG/Pace control (0.0-1.0)
 * @param {File|null} voiceFile - Optional voice reference file
 * @returns {Promise<Blob>} - Audio blob
 */
export const generateChatterboxSpeech = async (text, exaggeration = 0.5, cfgWeight = 0.5, voiceFile = null) => {
  try {
    const endpoint = voiceFile ? '/tts/generate-with-voice' : '/tts/generate';
    const url = `${CHATTERBOX_API_BASE_URL}${endpoint}`;

    let body;
    let headers = {};

    if (voiceFile) {
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

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      // Add timeout for generation (longer than health check)
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chatterbox API error: ${response.status} - ${errorText}`);
    }

    // Return the audio blob
    return await response.blob();
  } catch (error) {
    console.error('Error generating Chatterbox speech:', error);
    
    if (error.name === 'TimeoutError') {
      throw new Error('Chatterbox generation timeout - text may be too long');
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
    const response = await fetch(`${CHATTERBOX_API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting Chatterbox health:', error);
    throw error;
  }
};
