/**
 * Narration audio handlers: self-contained fetch wrappers for reference/example
 * audio upload, recording, listing, and segment extraction.
 */

import { API_BASE_URL } from '../config';

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
      mode: 'cors',
      credentials: 'include',
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
      mode: 'cors',
      credentials: 'include',
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
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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

/**
 * Get list of example audio files
 * @returns {Promise<Object>} - List of example audio files
 */
export const getExampleAudioList = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/narration/example-audio`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Upload example audio as reference
 * @param {string} filename - Example audio filename
 * @returns {Promise<Object>} - Upload response
 */
export const uploadExampleAudio = async (filename) => {
  try {
    const response = await fetch(`${API_BASE_URL}/narration/upload-example-audio`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename })
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
