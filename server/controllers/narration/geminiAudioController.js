/**
 * Controller for Gemini audio processing
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Import directory paths and functions
const { OUTPUT_AUDIO_DIR, ensureSubtitleDirectory } = require('./directoryManager');

/**
 * Save Gemini audio data to disk
 */
const saveGeminiAudio = (req, res) => {
  try {
    const { audioData, subtitle_id, sampleRate, mimeType } = req.body;

    if (!audioData || !subtitle_id) {
      console.error('Missing required data');
      return res.status(400).json({ error: 'Missing required data (audioData or subtitle_id)' });
    }

    // Ensure the subtitle directory exists
    const subtitleDir = ensureSubtitleDirectory(subtitle_id);

    // Count existing files to determine the next file number
    let fileNumber = 1;
    if (fs.existsSync(subtitleDir)) {
      const existingFiles = fs.readdirSync(subtitleDir);
      fileNumber = existingFiles.length + 1;
    }

    // Generate a filename with sequential numbering
    const filename = `${fileNumber}.wav`;

    // Full path includes the subtitle directory - use forward slashes for URLs
    const fullFilename = `subtitle_${subtitle_id}/${filename}`;
    const filepath = path.join(subtitleDir, filename);

    try {
      // Decode the base64 audio data
      const audioBuffer = Buffer.from(audioData, 'base64');

      // Create file stream
      const fileStream = fs.createWriteStream(filepath);

      // Ensure we're using the correct sample rate (defined here so it's available for all code paths)
      const actualSampleRate = sampleRate || 24000;

      // Check if the data is already in WAV format (converted on client side)
      if (mimeType === 'audio/wav') {
        console.log(`[DEBUG] Writing WAV data directly for subtitle ${subtitle_id}, length: ${audioBuffer.length} bytes`);

        // Check if the WAV header is valid
        if (audioBuffer.length >= 44) {
          const headerStr = audioBuffer.slice(0, 4).toString('utf8');
          console.log(`[DEBUG] WAV header check: ${headerStr}`);

          if (headerStr !== 'RIFF') {
            console.warn(`[DEBUG] WAV data does not start with RIFF header for subtitle ${subtitle_id}`);

            // If the header is invalid, add a proper WAV header
            const wavHeader = createWavHeader(audioBuffer.length, actualSampleRate);
            fileStream.write(wavHeader);
            fileStream.write(audioBuffer);
          } else {
            // Write the WAV file directly
            fileStream.write(audioBuffer);
          }
        } else {
          console.warn(`[DEBUG] WAV data too short for subtitle ${subtitle_id}: ${audioBuffer.length} bytes`);

          // Add a proper WAV header
          const wavHeader = createWavHeader(audioBuffer.length, actualSampleRate);
          fileStream.write(wavHeader);
          fileStream.write(audioBuffer);
        }
      } else {
        // If not in WAV format, assume it's PCM and add WAV header
        console.log(`[DEBUG] Adding WAV header to PCM data for subtitle ${subtitle_id}, length: ${audioBuffer.length} bytes, sample rate: ${actualSampleRate}`);

        // Create WAV header with the correct format
        const wavHeader = createWavHeader(audioBuffer.length, actualSampleRate);

        // Write the WAV file with header
        fileStream.write(wavHeader);
        fileStream.write(audioBuffer);
      }

      // End the file stream
      fileStream.end();

      // Wait for the file to be fully written
      fileStream.on('finish', () => {
        // Verify the file exists and has content
        try {
          const stats = fs.statSync(filepath);
          console.log(`[DEBUG] Verified file saved: ${filepath}, size: ${stats.size} bytes`);

          // Check if the file is a valid WAV file
          if (stats.size >= 44) { // WAV header is 44 bytes
            const header = Buffer.alloc(12);
            const fd = fs.openSync(filepath, 'r');
            fs.readSync(fd, header, 0, 12, 0);
            fs.closeSync(fd);

            const headerStr = header.toString('utf8', 0, 4);
            console.log(`[DEBUG] WAV header check for saved file: ${headerStr}`);

            if (headerStr !== 'RIFF') {
              console.warn(`[DEBUG] WARNING: Saved file does not have a valid RIFF header: ${filepath}`);

              // Try to fix the file by adding a proper WAV header
              try {
                const fileData = fs.readFileSync(filepath);
                const wavHeader = createWavHeader(fileData.length, actualSampleRate);
                const fixedData = Buffer.concat([wavHeader, fileData]);
                fs.writeFileSync(filepath, fixedData);
                console.log(`[DEBUG] Fixed WAV header for file: ${filepath}`);
              } catch (fixError) {
                console.error(`[DEBUG] Error fixing WAV header: ${fixError.message}`);
              }
            }
          } else {
            console.warn(`[DEBUG] WARNING: Saved file is too small to be a valid WAV file: ${filepath}, size: ${stats.size} bytes`);
          }

          // Return success response with the filename
          res.json({
            success: true,
            filename: fullFilename, // Return the path relative to OUTPUT_AUDIO_DIR
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

  console.log(`[DEBUG] Created WAV header for ${dataLength} bytes of PCM data, sample rate: ${sampleRate}`);

  return header;
};

module.exports = {
  saveGeminiAudio,
  createWavHeader
};
