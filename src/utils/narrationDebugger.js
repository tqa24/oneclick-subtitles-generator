/**
 * Utility functions for debugging narration issues
 */

import { SERVER_URL } from '../config';

/**
 * Check if a narration audio file is accessible
 * @param {string} filename - The filename to check
 * @returns {Promise<Object>} - Object with status and message
 */
export const checkNarrationAudioFile = async (filename) => {
  if (!filename) {
    return { 
      accessible: false, 
      message: 'No filename provided' 
    };
  }

  try {
    const audioUrl = `${SERVER_URL}/api/narration/audio/${filename}`;

    
    const response = await fetch(audioUrl, {
      method: 'HEAD',
      mode: 'cors',
      credentials: 'include'
    });

    if (response.ok) {
      return { 
        accessible: true, 
        message: `File ${filename} is accessible`,
        contentType: response.headers.get('Content-Type'),
        contentLength: response.headers.get('Content-Length')
      };
    } else {
      return { 
        accessible: false, 
        message: `File ${filename} returned status ${response.status}`,
        status: response.status
      };
    }
  } catch (error) {
    return { 
      accessible: false, 
      message: `Error checking file ${filename}: ${error.message}`,
      error: error.message
    };
  }
};

/**
 * Debug narration playback issues
 * @param {Object} narration - The narration object
 * @param {Object} audioRef - Reference to the audio element
 * @param {number} volume - The volume setting
 * @returns {Promise<Object>} - Debug information
 */
export const debugNarrationPlayback = async (narration, audioRef, volume) => {
  const debugInfo = {
    narration: {
      id: narration?.subtitle_id,
      filename: narration?.filename,
      success: narration?.success,
      hasAudioData: !!narration?.audioData
    },
    audio: {
      element: !!audioRef,
      volume: volume,
      currentSrc: audioRef?.currentSrc,
      paused: audioRef?.paused,
      error: audioRef?.error ? {
        code: audioRef.error.code,
        message: audioRef.error.message
      } : null
    },
    fileCheck: null
  };

  // Check if the file is accessible
  if (narration?.filename) {
    debugInfo.fileCheck = await checkNarrationAudioFile(narration.filename);
  }


  return debugInfo;
};

/**
 * Create a test audio element to check if audio can be played
 * @param {string} audioUrl - URL of the audio file to test
 * @returns {Promise<Object>} - Test results
 */
export const testAudioPlayback = (audioUrl) => {
  return new Promise((resolve) => {
    const audio = new Audio(audioUrl);
    
    const onError = (e) => {
      resolve({
        success: false,
        error: audio.error ? {
          code: audio.error.code,
          message: audio.error.message
        } : 'Unknown error',
        event: e
      });
    };
    
    const onCanPlay = () => {
      resolve({
        success: true,
        duration: audio.duration,
        canPlayType: {
          mp3: audio.canPlayType('audio/mpeg'),
          wav: audio.canPlayType('audio/wav'),
          ogg: audio.canPlayType('audio/ogg')
        }
      });
      
      // Clean up
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplaythrough', onCanPlay);
    };
    
    audio.addEventListener('error', onError);
    audio.addEventListener('canplaythrough', onCanPlay);
    
    // Set a timeout in case the events don't fire
    setTimeout(() => {
      if (!audio.error && audio.readyState < 4) {
        resolve({
          success: false,
          message: 'Timeout waiting for audio to load',
          readyState: audio.readyState
        });
      }
    }, 5000);
    
    // Start loading the audio
    audio.load();
  });
};
