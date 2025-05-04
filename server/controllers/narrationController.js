/**
 * Controller for narration-related endpoints
 */

const path = require('path');
const fs = require('fs');
const { safeMoveFileSync } = require('../utils/fileOperations');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Import narration service client
const narrationServiceClient = require('../services/narrationServiceClient');

// Import narration directory from config
const { NARRATION_DIR } = require('../config');

// Directories - use only root directory
const REFERENCE_AUDIO_DIR = path.join(NARRATION_DIR, 'reference');
const OUTPUT_AUDIO_DIR = path.join(NARRATION_DIR, 'output');
const TEMP_AUDIO_DIR = path.join(NARRATION_DIR, 'temp');

/**
 * Clear all narration output files
 */
const clearNarrationOutputFiles = () => {
  console.log('Clearing all narration output files for fresh generation');
  if (fs.existsSync(OUTPUT_AUDIO_DIR)) {
    const outputFiles = fs.readdirSync(OUTPUT_AUDIO_DIR);
    let deletedCount = 0;

    outputFiles.forEach(file => {
      const filePath = path.join(OUTPUT_AUDIO_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${filePath}`);
          return;
        }

        // Delete the file
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
      }
    });

    console.log(`Cleared ${deletedCount} narration output files`);
  } else {
    console.log('Narration output directory does not exist');
  }
};

/**
 * Serve audio file from local filesystem or proxy to narration service
 */
const serveAudioFile = async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(REFERENCE_AUDIO_DIR, filename);
  const outputPath = path.join(OUTPUT_AUDIO_DIR, filename);

  console.log(`Serving audio file: ${filename}`);
  console.log(`Checking paths: ${filePath} or ${outputPath}`);

  // First try to serve directly from the filesystem for better performance
  // Check if file exists in reference directory
  if (fs.existsSync(filePath)) {
    console.log(`Serving from reference directory: ${filePath}`);
    // Set the content type header for audio files
    res.setHeader('Content-Type', 'audio/wav');
    return res.sendFile(filePath);
  }

  // Check if file exists in output directory
  if (fs.existsSync(outputPath)) {
    console.log(`Serving from output directory: ${outputPath}`);
    // Set the content type header for audio files
    res.setHeader('Content-Type', 'audio/wav');
    return res.sendFile(outputPath);
  }

  // If file not found locally, proxy the request to the narration service
  console.log(`Audio file not found locally, proxying to narration service: ${filename}`);

  try {
    const audioData = await narrationServiceClient.fetchAudioFile(filename);

    // Set the content type header
    if (audioData.contentType) {
      res.setHeader('Content-Type', audioData.contentType);
    } else {
      // Default to audio/wav if no content type is provided
      res.setHeader('Content-Type', 'audio/wav');
    }

    // Send the audio data
    res.send(audioData.buffer);

    // After successfully serving from the narration service, cache the file locally for future requests
    try {
      fs.writeFileSync(outputPath, audioData.buffer);
      console.log(`Cached audio file to: ${outputPath}`);
    } catch (cacheError) {
      console.error(`Error caching audio file: ${cacheError.message}`);
    }
  } catch (error) {
    console.error(`Error proxying audio file: ${error.message}`);
    res.status(502).send('Failed to fetch audio file from narration service');
  }
};

/**
 * Download all narration audio files as a zip
 */
const downloadAllAudio = (req, res) => {
  console.log('Received download-all request');

  try {
    // Get the filenames from the request body
    const { filenames } = req.body;
    console.log(`Requested filenames: ${filenames ? filenames.join(', ') : 'none'}`);

    if (!filenames || filenames.length === 0) {
      console.log('No filenames provided, returning 400');
      return res.status(400).json({ error: 'No filenames provided' });
    }

    // Create a new zip file
    const zip = new AdmZip();

    // Add each requested file to the zip
    const addedFiles = [];

    for (const filename of filenames) {
      const filePath = path.join(OUTPUT_AUDIO_DIR, filename);

      // Check if the file exists
      if (fs.existsSync(filePath)) {
        console.log(`Adding file to zip: ${filePath}`);
        zip.addLocalFile(filePath);
        addedFiles.push(filename);
      } else {
        console.log(`File not found: ${filePath}`);
      }
    }

    if (addedFiles.length === 0) {
      console.log('No files found, returning 404');
      return res.status(404).json({ error: 'No audio files found' });
    }

    // Set the appropriate headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=narration_audio.zip');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // Send the zip file
    const zipBuffer = zip.toBuffer();
    console.log(`Created zip buffer with size: ${zipBuffer.length} bytes`);
    res.send(zipBuffer);

    console.log(`Sent zip file with ${addedFiles.length} audio files`);
  } catch (error) {
    console.error('Error creating zip file:', error);
    res.status(500).json({ error: `Failed to create zip file: ${error.message}` });
  }
};

/**
 * Download aligned narration audio (one file)
 */
const downloadAlignedAudio = async (req, res) => {
  console.log('Received download-aligned request');

  try {
    // Get the narration data from the request body
    const { narrations } = req.body;
    console.log(`Received ${narrations ? narrations.length : 0} narrations for alignment`);

    if (!narrations || narrations.length === 0) {
      console.log('No narrations provided, returning 400');
      return res.status(400).json({ error: 'No narrations provided' });
    }

    // Sort narrations by start time to ensure correct order
    narrations.sort((a, b) => a.start - b.start);

    // Create a temporary directory for the aligned audio files
    const tempDir = path.join(NARRATION_DIR, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create a list of files to concatenate
    const filesToConcatenate = [];
    const fileList = path.join(tempDir, 'file_list.txt');

    // Check if all files exist
    for (const narration of narrations) {
      const filePath = path.join(OUTPUT_AUDIO_DIR, narration.filename);
      if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return res.status(404).json({ error: `Audio file not found: ${narration.filename}` });
      }
      filesToConcatenate.push(filePath);
    }

    // Create the output file path
    const timestamp = Date.now();
    const outputFilename = `aligned_narration_${timestamp}.wav`;
    const outputPath = path.join(tempDir, outputFilename);

    // Create a file list for ffmpeg
    let fileListContent = '';
    for (const file of filesToConcatenate) {
      fileListContent += `file '${file.replace(/'/g, "'\\''")}'
`;
    }
    fs.writeFileSync(fileList, fileListContent);

    // Use ffmpeg to concatenate the files
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileList}" -c copy "${outputPath}" -y`;

    console.log(`Running ffmpeg command: ${ffmpegCommand}`);

    // Execute the ffmpeg command
    await new Promise((resolve, reject) => {
      exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing ffmpeg: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          reject(error);
          return;
        }
        console.log(`ffmpeg stdout: ${stdout}`);
        console.log(`ffmpeg stderr: ${stderr}`);
        resolve();
      });
    });

    // Check if the output file was created
    if (!fs.existsSync(outputPath)) {
      console.error(`Output file was not created: ${outputPath}`);
      return res.status(500).json({ error: 'Failed to create aligned audio file' });
    }

    console.log(`Successfully created aligned audio file: ${outputPath}`);

    // Set the appropriate headers
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename=${outputFilename}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // Send the file
    res.sendFile(outputPath, (err) => {
      if (err) {
        console.error(`Error sending file: ${err.message}`);
        // Don't send another response if headers are already sent
        if (!res.headersSent) {
          res.status(500).json({ error: `Failed to send audio file: ${err.message}` });
        }
      } else {
        console.log(`Successfully sent aligned narration audio file`);

        // Clean up the temporary files
        try {
          fs.unlinkSync(fileList);
          fs.unlinkSync(outputPath);
          console.log('Cleaned up temporary files');
        } catch (cleanupError) {
          console.error(`Error cleaning up temporary files: ${cleanupError.message}`);
        }
      }
    });
  } catch (error) {
    console.error('Error creating aligned audio file:', error);
    res.status(500).json({ error: `Failed to create aligned audio file: ${error.message}` });
  }
};

/**
 * Record reference audio
 */
const recordReference = (req, res) => {
  console.log('Received record-reference request');

  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No audio data' });
  }

  console.log('File uploaded successfully:', req.file);

  try {
    // Generate a unique filename
    const unique_id = uuidv4();
    const filename = `recorded_${unique_id}.wav`;
    const filepath = path.join(REFERENCE_AUDIO_DIR, filename);

    // Copy the file instead of renaming to avoid EPERM errors on Windows
    safeMoveFileSync(req.file.path, filepath);

    // Get reference text if provided
    const reference_text = req.body.reference_text || '';

    // We're now handling transcription directly in the frontend
    console.log('Transcription is handled in frontend');

    // Return success response
    res.json({
      success: true,
      filepath: filepath,
      filename: filename,
      reference_text: reference_text,
      transcribe: false // Indicate that transcription is handled in the frontend
    });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    res.status(500).json({ error: 'Error processing uploaded file' });
  }
};

/**
 * Upload reference audio
 */
const uploadReference = (req, res) => {
  console.log('Received upload-reference request');

  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file part' });
  }

  console.log('File uploaded successfully:', req.file);

  try {
    // Generate a unique filename
    const unique_id = uuidv4();
    const filename = `uploaded_${unique_id}.wav`;
    const filepath = path.join(REFERENCE_AUDIO_DIR, filename);

    // Copy the file instead of renaming to avoid EPERM errors on Windows
    safeMoveFileSync(req.file.path, filepath);

    // Get reference text if provided
    const reference_text = req.body.reference_text || '';

    // We're now handling transcription directly in the frontend
    console.log('Transcription is handled in frontend');

    // Return success response
    res.json({
      success: true,
      filepath: filepath,
      filename: filename,
      reference_text: reference_text,
      transcribe: false // Indicate that transcription is handled in the frontend
    });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    res.status(500).json({ error: 'Error processing uploaded file' });
  }
};

/**
 * Generate narration
 */
const generateNarration = async (req, res) => {
  console.log('Received generate request');

  // Clear all existing narration output files for fresh generation
  clearNarrationOutputFiles();

  try {
    const { reference_audio, reference_text, subtitles, settings } = req.body;

    console.log(`Generating narration for ${subtitles.length} subtitles`);
    console.log(`Reference audio: ${reference_audio}`);
    console.log(`Reference text: ${reference_text}`);

    // Check if the narration service is available
    const serviceStatus = await narrationServiceClient.checkService(20, 10000);

    if (!serviceStatus.available) {
      console.log('Narration service is required but not available');
      return res.status(503).json({
        success: false,
        error: 'Narration service is not available. Please use npm run dev:cuda to start with Python narration service.'
      });
    }

    // Generate narration using the service client
    try {
      const result = await narrationServiceClient.generateNarration(
        reference_audio,
        reference_text,
        subtitles,
        settings || {},
        res // Pass response object for streaming support
      );

      // If the result is null, it means we're handling streaming in the client
      if (result !== null) {
        return res.json(result);
      }
      // Otherwise, the response is being handled by the streaming logic
    } catch (error) {
      console.error(`Error using narration service: ${error.message}`);
      return res.status(503).json({
        success: false,
        error: `Error connecting to narration service: ${error.message}. Please restart the application with npm run dev:cuda.`
      });
    }
  } catch (error) {
    console.error('Error generating narration:', error);
    res.status(500).json({ error: `Error generating narration: ${error.message}` });
  }
};

/**
 * Get narration service status
 */
const getNarrationStatus = async (req, res) => {
  // Check the narration service with multiple attempts
  const serviceStatus = await narrationServiceClient.checkService(20, 10000);

  // Store the status for other parts of the application
  req.app.set('narrationServiceRunning', serviceStatus.available);
  req.app.set('narrationServiceDevice', serviceStatus.device);
  req.app.set('narrationServiceGpuInfo', serviceStatus.gpu_info);

  res.json({
    available: serviceStatus.available,
    device: serviceStatus.device,
    source: serviceStatus.available ? 'actual' : 'none',
    actualPort: narrationServiceClient.getNarrationPort(),
    gpu_info: serviceStatus.gpu_info
  });
};

/**
 * Clear narration output files
 */
const clearOutput = (_, res) => {
  try {
    clearNarrationOutputFiles();
    res.json({ success: true, message: 'Narration output files cleared successfully' });
  } catch (error) {
    console.error('Error clearing narration output files:', error);
    res.status(500).json({ success: false, error: 'Failed to clear narration output files' });
  }
};

// Ensure narration directories exist
const ensureNarrationDirectories = () => {
  if (!fs.existsSync(NARRATION_DIR)) {
    fs.mkdirSync(NARRATION_DIR, { recursive: true });
    console.log(`Created narration directory at ${NARRATION_DIR}`);
  }

  if (!fs.existsSync(REFERENCE_AUDIO_DIR)) {
    fs.mkdirSync(REFERENCE_AUDIO_DIR, { recursive: true });
    console.log(`Created reference audio directory at ${REFERENCE_AUDIO_DIR}`);
  }

  if (!fs.existsSync(OUTPUT_AUDIO_DIR)) {
    fs.mkdirSync(OUTPUT_AUDIO_DIR, { recursive: true });
    console.log(`Created output audio directory at ${OUTPUT_AUDIO_DIR}`);
  }

  if (!fs.existsSync(TEMP_AUDIO_DIR)) {
    fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
    console.log(`Created temp audio directory at ${TEMP_AUDIO_DIR}`);
  }
};

/**
 * Save Gemini audio data to disk
 */
const saveGeminiAudio = (req, res) => {
  console.log('Received save-gemini-audio request');

  try {
    const { audioData, subtitle_id, sampleRate } = req.body;

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

      // Ensure we're using the correct sample rate
      const actualSampleRate = sampleRate || 24000;
      console.log(`Using sample rate: ${actualSampleRate}Hz`);

      // Create WAV header with the correct format
      const wavHeader = createWavHeader(audioBuffer.length, actualSampleRate);
      console.log(`Created WAV header with sample rate: ${actualSampleRate}Hz`);

      // Write the WAV file
      const fileStream = fs.createWriteStream(filepath);
      fileStream.write(wavHeader);
      fileStream.write(audioBuffer);
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
  serveAudioFile,
  downloadAllAudio,
  downloadAlignedAudio,
  recordReference,
  uploadReference,
  generateNarration,
  getNarrationStatus,
  clearOutput,
  clearNarrationOutputFiles,
  ensureNarrationDirectories,
  saveGeminiAudio
};
