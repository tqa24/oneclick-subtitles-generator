/**
 * Utility functions for WAV file creation and manipulation
 */

/**
 * Helper function to write a string to a DataView
 * @param {DataView} view - DataView to write to
 * @param {number} offset - Offset to start writing at
 * @param {string} string - String to write
 */
export const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Create a WAV file from PCM data
 * @param {ArrayBuffer} pcmData - PCM audio data
 * @param {number} sampleRate - Sample rate in Hz (default: 24000)
 * @returns {Blob} - WAV file as a Blob
 */
export const createWavFromPcm = (pcmData, sampleRate = 24000) => {
  try {
    // Gemini returns 16-bit PCM data at 24000Hz
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    // Create WAV header (44 bytes)
    const headerLength = 44;
    const wavBuffer = new ArrayBuffer(headerLength + pcmData.byteLength);
    const wavView = new DataView(wavBuffer);

    // "RIFF" chunk descriptor
    writeString(wavView, 0, 'RIFF');
    wavView.setUint32(4, 36 + pcmData.byteLength, true); // Chunk size
    writeString(wavView, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(wavView, 12, 'fmt ');
    wavView.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    wavView.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    wavView.setUint16(22, numChannels, true); // NumChannels
    wavView.setUint32(24, sampleRate, true);  // SampleRate
    wavView.setUint32(28, byteRate, true);    // ByteRate
    wavView.setUint16(32, blockAlign, true);  // BlockAlign
    wavView.setUint16(34, bitsPerSample, true); // BitsPerSample

    // "data" sub-chunk
    writeString(wavView, 36, 'data');
    wavView.setUint32(40, pcmData.byteLength, true); // Subchunk2Size

    // Copy PCM data
    const pcmView = new Uint8Array(pcmData);
    const wavDataView = new Uint8Array(wavBuffer, headerLength);

    // Copy the PCM data into the WAV buffer
    for (let i = 0; i < pcmView.length; i++) {
      wavDataView[i] = pcmView[i];
    }


    return new Blob([wavBuffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('Error creating WAV file:', error);
    throw error;
  }
};

/**
 * Simpler method to create WAV from PCM for download
 * @param {ArrayBuffer} pcmData - PCM audio data
 * @param {number} sampleRate - Sample rate in Hz (default: 24000)
 * @returns {Blob} - WAV file as a Blob
 */
export const createWavFromPcmForDownload = (pcmData, sampleRate = 24000) => {
  // This is a more reliable method for creating WAV files for download
  try {


    // Ensure we're working with 16-bit PCM data
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);

    // Create WAV header
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // "RIFF" chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.byteLength, true);
    writeString(view, 8, 'WAVE');

    // "fmt " chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // "data" chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.byteLength, true);

    // Combine header and PCM data
    const wavFile = new Uint8Array(header.byteLength + pcmData.byteLength);
    wavFile.set(new Uint8Array(header), 0);
    wavFile.set(new Uint8Array(pcmData), header.byteLength);



    return new Blob([wavFile], { type: 'audio/wav' });
  } catch (error) {
    console.error('Error creating WAV file for download:', error);
    throw error;
  }
};
