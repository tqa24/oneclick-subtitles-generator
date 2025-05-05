/**
 * Controller for audio file serving and downloading
 */

const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const { exec } = require('child_process');

// Import narration service client
const narrationServiceClient = require('../../services/narrationServiceClient');

// Import directory paths
const {
  REFERENCE_AUDIO_DIR,
  OUTPUT_AUDIO_DIR,
  TEMP_AUDIO_DIR
} = require('./directoryManager');

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
    const tempDir = path.join(TEMP_AUDIO_DIR);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create the output file path
    const timestamp = Date.now();
    const outputFilename = `aligned_narration_${timestamp}.wav`;
    const outputPath = path.join(tempDir, outputFilename);

    // Check if all files exist and get their durations
    const audioSegments = [];

    // Log the received narrations for debugging
    console.log('Received narrations with timing info:');
    narrations.forEach(n => {
      console.log(`Subtitle ID: ${n.subtitle_id}, Start: ${n.start}s, End: ${n.end}s, Filename: ${n.filename}`);
    });

    for (const narration of narrations) {
      const filePath = path.join(OUTPUT_AUDIO_DIR, narration.filename);
      if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return res.status(404).json({ error: `Audio file not found: ${narration.filename}` });
      }

      // Ensure we have valid timing information
      const start = typeof narration.start === 'number' ? narration.start : 0;
      const end = typeof narration.end === 'number' ? narration.end : (start + 5); // Default 5 seconds if no end time

      // Add to our segments list with timing information
      audioSegments.push({
        path: filePath,
        start: start,
        end: end,
        subtitle_id: narration.subtitle_id
      });
    }

    // Sort segments by start time to ensure proper ordering
    audioSegments.sort((a, b) => a.start - b.start);

    // Find the total duration needed (end time of the last subtitle)
    const totalDuration = Math.max(...audioSegments.map(s => s.end)) + 1; // Add 1 second buffer at the end

    console.log(`Creating aligned audio with total duration: ${totalDuration}s`);
    console.log(`Using ${audioSegments.length} audio segments with precise timing`);

    // Create a complex filter for precise audio placement
    let filterComplex = '';
    let inputs = '';
    let amixInputs = [];

    // Add each audio file as an input
    audioSegments.forEach((segment, index) => {
      inputs += `-i "${segment.path}" `;

      // Add an adelay filter to position each audio at the exact timestamp
      // adelay takes delay in milliseconds, so multiply by 1000
      const delayMs = Math.round(segment.start * 1000);

      // Log the delay being applied for each segment
      console.log(`Segment ${index} (ID: ${segment.subtitle_id}): Positioning at ${segment.start}s (delay: ${delayMs}ms)`);

      filterComplex += `[${index}]adelay=${delayMs}|${delayMs}[a${index}]; `;
      amixInputs.push(`[a${index}]`);
    });

    // Combine all delayed audio streams
    filterComplex += `${amixInputs.join('')}amix=inputs=${audioSegments.length}:dropout_transition=0:normalize=0[aout]`;

    // Build the complete ffmpeg command
    // We create a silent audio track of the total duration, then mix our positioned audio segments on top
    const ffmpegCommand = `ffmpeg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100:duration=${totalDuration} ${inputs} -filter_complex "${filterComplex}" -map "[aout]" -c:a pcm_s16le -ar 44100 "${outputPath}" -y`;

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

module.exports = {
  serveAudioFile,
  downloadAllAudio,
  downloadAlignedAudio
};
