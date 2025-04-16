/**
 * Narration service for F5-TTS integration
 */

import { API_BASE_URL, SERVER_URL } from '../config';

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
    console.log('Saving recorded audio, blob size:', audioBlob.size);

    const formData = new FormData();
    formData.append('audio_data', audioBlob, 'recorded_audio.wav');

    if (referenceText) {
      formData.append('reference_text', referenceText);
    }

    console.log('Sending request to:', `${API_BASE_URL}/narration/record-reference`);

    const response = await fetch(`${API_BASE_URL}/narration/record-reference`, {
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
    console.log('Received response:', data);
    return data;
  } catch (error) {
    console.error('Error saving recorded audio:', error);
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
        end_time: endTime
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
 * Generate narration for subtitles
 * @param {string} referenceAudio - Path to reference audio file
 * @param {string} referenceText - Reference text for the audio
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {Promise<Object>} - Generation response
 */
export const generateNarration = async (referenceAudio, referenceText, subtitles) => {
  try {
    console.log('Generating narration:', {
      referenceAudio,
      referenceText,
      subtitlesCount: subtitles.length
    });

    const response = await fetch(`${API_BASE_URL}/narration/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference_audio: referenceAudio,
        reference_text: referenceText,
        subtitles: subtitles
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
    console.log('Generation response:', data);
    return data;
  } catch (error) {
    console.error('Error generating narration:', error);
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
