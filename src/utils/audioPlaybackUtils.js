/**
 * Utility functions for audio playback
 */

import { pcmToFloat32 } from './audioConversionUtils';

/**
 * Play PCM audio using Web Audio API
 * @param {ArrayBuffer} pcmData - PCM audio data
 * @param {number} sampleRate - Sample rate in Hz (default: 24000)
 * @returns {Object} - Audio player object with controls
 */
export const playPcmWithAudioAPI = (pcmData, sampleRate = 24000) => {
  try {


    // Convert PCM to float32 for Web Audio API
    const floatData = pcmToFloat32(pcmData);

    // Create audio context with the correct sample rate
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: sampleRate
    });



    // Create buffer with the float data
    const audioBuffer = audioContext.createBuffer(1, floatData.length, sampleRate);

    // Copy the float data to the buffer
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(floatData);



    // Create a buffer source and connect it to the destination
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Add a gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0; // Full volume

    // Connect the source to the gain node and then to the destination
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Track whether the audio context has been closed
    let isContextClosed = false;

    // Return the source, context, and controls
    return {
      source,
      audioContext,
      gainNode,
      play: () => {

        source.start(0);
        return Promise.resolve();
      },
      stop: () => {


        // Only try to stop the source if the context is not closed
        if (!isContextClosed) {
          try {
            source.stop();
          } catch (e) {
            console.warn('Error stopping source:', e);
          }
        }

        // Only try to close the context if it's not already closed
        if (!isContextClosed) {
          try {
            audioContext.close();
            isContextClosed = true;
          } catch (e) {
            console.warn('Error closing audio context:', e);
            // If we get an error about the context being closed, mark it as closed
            if (e.name === 'InvalidStateError' && e.message.includes('closed')) {
              isContextClosed = true;
            }
          }
        }
      },
      getDuration: () => audioBuffer.duration,
      isContextClosed: () => isContextClosed
    };
  } catch (error) {
    console.error('Error creating audio with Web Audio API:', error);
    throw error;
  }
};
