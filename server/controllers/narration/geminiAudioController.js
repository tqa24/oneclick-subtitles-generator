/**
 * Controller for Gemini audio processing
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Import directory paths
const { OUTPUT_AUDIO_DIR } = require('./directoryManager');

/**
 * Save Gemini audio data to disk
 */
const saveGeminiAudio = (req, res) => {
  console.log('Received save-gemini-audio request');

  try {
    const { audioData, subtitle_id, sampleRate, mimeType } = req.body;

    if (!audioData || !subtitle_id) {
      console.error('Missing required data');
      return res.status(400).json({ error: 'Missing required data (audioData or subtitle_id)' });
    }

    // Generate a unique filename
    const unique_id = uuidv4();
    const filename = `gemini_${subtitle_id}_${unique_id}.wav`;
    const filepath = path.join(OUTPUT_AUDIO_DIR, filename);

    console.log(`Saving Gemini audio for subtitle ${subtitle_id} to ${filepath}`);

    try {
      // Decode the base64 audio data
      const audioBuffer = Buffer.from(audioData, 'base64');

      console.log(`Audio data size: ${audioBuffer.length} bytes`);
      console.log(`MIME type: ${mimeType || 'Not specified'}`);

      // Create file stream
      const fileStream = fs.createWriteStream(filepath);

      // Ensure we're using the correct sample rate (defined here so it's available for all code paths)
      const actualSampleRate = sampleRate || 24000;
      console.log(`Using sample rate: ${actualSampleRate}Hz`);

      // Check if the data is already in WAV format (converted on client side)
      if (mimeType === 'audio/wav') {
        console.log('Audio is already in WAV format, writing directly to file');

        // Write the WAV file directly
        fileStream.write(audioBuffer);
      } else {
        // If not in WAV format, assume it's PCM and add WAV header
        console.log('Audio is in PCM format, adding WAV header');

        // Create WAV header with the correct format
        const wavHeader = createWavHeader(audioBuffer.length, actualSampleRate);
        console.log(`Created WAV header with sample rate: ${actualSampleRate}Hz`);

        // Write the WAV file with header
        fileStream.write(wavHeader);
        fileStream.write(audioBuffer);
      }

      // End the file stream
      fileStream.end();

      // Wait for the file to be fully written
      fileStream.on('finish', () => {
        console.log(`Successfully saved Gemini audio to ${filepath}`);

        // Verify the file exists and has content
        try {
          const stats = fs.statSync(filepath);
          console.log(`Verified file exists with size: ${stats.size} bytes`);

          // Return success response with the filename
          res.json({
            success: true,
            filename: filename,
            subtitle_id: subtitle_id,
            sampleRate: actualSampleRate
          });
        } catch (statError) {
          console.error(`Error verifying file: ${statError.message}`);
          res.status(500).json({ error: `Error verifying audio file: ${statError.message}` });
        }
      });

      fileStream.on('error', (writeError) => {
        console.error(`Error writing file: ${writeError.message}`);
        res.status(500).json({ error: `Error writing audio file: ${writeError.message}` });
      });
    } catch (error) {
      console.error(`Error saving Gemini audio: ${error.message}`);
      res.status(500).json({ error: `Error saving Gemini audio: ${error.message}` });
    }
  } catch (error) {
    console.error('Error processing Gemini audio:', error);
    res.status(500).json({ error: 'Error processing Gemini audio' });
  }
};

/**
 * Create a WAV header for PCM audio data
 * @param {number} dataLength - Length of the PCM data in bytes
 * @param {number} sampleRate - Sample rate of the audio (default: 24000)
 * @returns {Buffer} - WAV header as a Buffer
 */
const createWavHeader = (dataLength, sampleRate = 24000) => {
  // Gemini returns 16-bit PCM data, mono channel
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  console.log(`Creating WAV header with parameters:
    - Sample Rate: ${sampleRate}Hz
    - Channels: ${numChannels}
    - Bits Per Sample: ${bitsPerSample}
    - Block Align: ${blockAlign}
    - Byte Rate: ${byteRate}
    - Data Length: ${dataLength} bytes
  `);

  // Create WAV header (44 bytes)
  const header = Buffer.alloc(44);

  // "RIFF" chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4); // Chunk size (file size - 8)
  header.write('WAVE', 8);

  // "fmt " sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1 size (16 for PCM)
  header.writeUInt16LE(1, 20); // Audio format (1 for PCM)
  header.writeUInt16LE(numChannels, 22); // Number of channels
  header.writeUInt32LE(sampleRate, 24); // Sample rate
  header.writeUInt32LE(byteRate, 28); // Byte rate
  header.writeUInt16LE(blockAlign, 32); // Block align
  header.writeUInt16LE(bitsPerSample, 34); // Bits per sample

  // "data" sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40); // Subchunk2 size (data size)

  return header;
};

module.exports = {
  saveGeminiAudio,
  createWavHeader
};
