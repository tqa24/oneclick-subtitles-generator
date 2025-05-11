/**
 * Utility functions for audio processing
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
 * Convert base64 string to ArrayBuffer
 * @param {string} base64 - Base64 encoded string
 * @returns {ArrayBuffer} - Decoded ArrayBuffer
 */
export const base64ToArrayBuffer = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Convert PCM base64 audio to WAV format
 * @param {string} pcmBase64 - Base64 encoded PCM audio data
 * @param {number} sampleRate - Sample rate of the audio (default: 24000)
 * @returns {string} - Base64 encoded WAV audio data
 */
export const convertPcmBase64ToWavBase64 = (pcmBase64, sampleRate = 24000) => {
  try {


    // Validate input
    if (!pcmBase64 || pcmBase64.length === 0) {
      console.error('Empty PCM base64 data provided');
      throw new Error('Empty PCM base64 data');
    }

    // Decode the base64 PCM data to an ArrayBuffer
    const pcmBuffer = base64ToArrayBuffer(pcmBase64);


    if (pcmBuffer.byteLength === 0) {
      console.error('Decoded PCM buffer is empty');
      throw new Error('Empty PCM buffer');
    }

    // Create WAV header
    const numChannels = 1; // Mono
    const bitsPerSample = 16; // 16-bit PCM
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    // Create WAV header (44 bytes)
    const headerLength = 44;
    const wavBuffer = new ArrayBuffer(headerLength + pcmBuffer.byteLength);
    const wavView = new DataView(wavBuffer);

    // "RIFF" chunk descriptor
    writeString(wavView, 0, 'RIFF');
    wavView.setUint32(4, 36 + pcmBuffer.byteLength, true); // Chunk size
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
    wavView.setUint32(40, pcmBuffer.byteLength, true); // Subchunk2Size

    // Copy PCM data
    const pcmView = new Uint8Array(pcmBuffer);
    const wavDataView = new Uint8Array(wavBuffer, headerLength);

    for (let i = 0; i < pcmView.length; i++) {
      wavDataView[i] = pcmView[i];
    }

    // Convert the WAV buffer back to base64
    const wavArray = new Uint8Array(wavBuffer);
    let binary = '';
    for (let i = 0; i < wavArray.length; i++) {
      binary += String.fromCharCode(wavArray[i]);
    }
    const wavBase64 = btoa(binary);

    // Validate the output
    if (!wavBase64 || wavBase64.length === 0) {
      console.error('Generated WAV base64 is empty');
      throw new Error('Empty WAV base64 output');
    }

    // Log the first few bytes of the WAV data to verify the RIFF header
    // const headerCheck = atob(wavBase64.substring(0, 8));
    // Uncomment for debugging if needed


    return wavBase64;
  } catch (error) {
    console.error('Error converting PCM base64 to WAV base64:', error);
    throw error;
  }
};

/**
 * Create a WAV file from PCM audio data
 * @param {ArrayBuffer} pcmData - PCM audio data
 * @param {number} sampleRate - Sample rate of the audio
 * @returns {Blob} - WAV file as a Blob
 */
export const createWavFromPcm = (pcmData, sampleRate = 24000) => {
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
};
