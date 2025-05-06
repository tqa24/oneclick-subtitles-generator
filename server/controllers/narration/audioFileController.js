/**
 * Audio file controller for narration
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Import directory paths
const { REFERENCE_AUDIO_DIR, OUTPUT_AUDIO_DIR, TEMP_AUDIO_DIR } = require('./directoryManager');

/**
 * Serve audio file from narration directories
 */
const serveAudioFile = (req, res) => {
  console.log('Received request to serve audio file');

  try {
    // Get the filename from the request parameters
    const { filename } = req.params;

    if (!filename) {
      console.error('No filename provided');
      return res.status(400).json({ error: 'No filename provided' });
    }

    console.log(`Looking for audio file: ${filename}`);

    // Check if the file is in the output directory
    const outputPath = path.join(OUTPUT_AUDIO_DIR, filename);
    if (fs.existsSync(outputPath)) {
      console.log(`Serving audio file from output directory: ${outputPath}`);
      return res.sendFile(outputPath);
    }

    // Check if the file is in the reference directory
    const referencePath = path.join(REFERENCE_AUDIO_DIR, filename);
    if (fs.existsSync(referencePath)) {
      console.log(`Serving audio file from reference directory: ${referencePath}`);
      return res.sendFile(referencePath);
    }

    // Check if the file is in the temp directory
    const tempPath = path.join(TEMP_AUDIO_DIR, filename);
    if (fs.existsSync(tempPath)) {
      console.log(`Serving audio file from temp directory: ${tempPath}`);
      return res.sendFile(tempPath);
    }

    // If the file is not found in any directory
    console.error(`Audio file not found: ${filename}`);
    return res.status(404).json({ error: 'Audio file not found' });
  } catch (error) {
    console.error('Error serving audio file:', error);
    return res.status(500).json({ error: `Failed to serve audio file: ${error.message}` });
  }
};

/**
 * Download aligned narration audio (one file)
 *
 * This function handles both F5-TTS and Gemini narrations in the same way,
 * ensuring consistent alignment and playback in the video player.
 *
 * Audio processing includes:
 * 1. Individual audio segments are boosted by 1.5x for clarity
 * 2. Using amix with normalize=0 to prevent automatic volume reduction during overlaps
 *
 * The key setting is normalize=0 in the amix filter, which ensures that when audio segments
 * overlap (even partially), they maintain their full volume without any reduction.
 * By default, amix would reduce the volume of overlapping segments to prevent clipping.
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
      // Handle both F5-TTS and Gemini narrations
      // F5-TTS narrations have a filename property
      // Gemini narrations might have audioData property (base64 encoded audio)
      if (narration.filename) {
        const filePath = path.join(OUTPUT_AUDIO_DIR, narration.filename);
        if (!fs.existsSync(filePath)) {
          console.log(`File not found: ${filePath}`);
          // Clean up temp dir before exiting on error
          // Consider adding a general cleanup function or try/finally block for robustness
          return res.status(404).json({ error: `Audio file not found: ${narration.filename}` });
        }
      } else if (!narration.audioData) {
        // If neither filename nor audioData is present, return an error
        console.log(`No audio data or filename for narration with subtitle ID: ${narration.subtitle_id}`);
        return res.status(400).json({ error: `No audio data or filename for narration with subtitle ID: ${narration.subtitle_id}` });
      }

      // Check file size to ensure it's a valid audio file (only for file-based narrations)
      if (narration.filename) {
        const filePath = path.join(OUTPUT_AUDIO_DIR, narration.filename);
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          console.log(`Empty file: ${filePath}`);
          return res.status(400).json({ error: `Audio file is empty: ${narration.filename}` });
        }
      }

      // Ensure we have valid timing information
      const start = typeof narration.start === 'number' ? narration.start : 0;
      const end = typeof narration.end === 'number' ? narration.end : (start + 5); // Default 5 seconds if no end time

      // Ensure each segment has a reasonable duration
      const duration = end - start;
      if (duration <= 0) {
        console.log(`Invalid duration for ${narration.filename}: ${duration}s`);
        return res.status(400).json({ error: `Invalid duration for audio file: ${narration.filename}` });
      }

      // For file-based narrations (F5-TTS)
      if (narration.filename) {
        const filePath = path.join(OUTPUT_AUDIO_DIR, narration.filename);
        audioSegments.push({
          path: filePath,
          start: start,
          end: end,
          subtitle_id: narration.subtitle_id,
          type: 'file'
        });
      }
      // For base64-encoded narrations (Gemini)
      else if (narration.audioData) {
        // Create a temporary file for the base64 audio data
        const tempFilename = `temp_gemini_${narration.subtitle_id}_${Date.now()}.wav`;
        const tempFilePath = path.join(TEMP_AUDIO_DIR, tempFilename);

        // Ensure the temp directory exists
        if (!fs.existsSync(TEMP_AUDIO_DIR)) {
          fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
        }

        // Decode and write the base64 audio data to a temporary file
        try {
          // Extract the base64 data (remove data URL prefix if present)
          let base64Data = narration.audioData;
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }

          // Write the decoded data to a file
          fs.writeFileSync(tempFilePath, Buffer.from(base64Data, 'base64'));

          // Add to our segments list
          audioSegments.push({
            path: tempFilePath,
            start: start,
            end: end,
            subtitle_id: narration.subtitle_id,
            type: 'temp',
            tempFile: tempFilePath // Track for cleanup later
          });
        } catch (error) {
          console.error(`Error processing base64 audio data for subtitle ${narration.subtitle_id}:`, error);
          return res.status(500).json({ error: `Failed to process audio data for subtitle ${narration.subtitle_id}` });
        }
      }
    }

    // Sort segments by start time (redundant if narrations already sorted, but safe)
    audioSegments.sort((a, b) => a.start - b.start);

    // Find the total duration needed (end time of the last subtitle)
    // Use 0 as initial value for max in case audioSegments is empty (though handled earlier)
    const totalDuration = audioSegments.length > 0
      ? Math.max(...audioSegments.map(s => s.end)) + 1 // Add 1 second buffer at the end
      : 1; // Default to 1 second if no segments


    console.log(`Creating aligned audio with total duration: ${totalDuration}s`);
    console.log(`Using ${audioSegments.length} audio segments with precise timing`);

    // --- Removed redundant silent track generation ---

    // Create a complex filter for precise audio placement
    let filterComplex = '';
    let inputs = '';
    let amixInputs = []; // Will hold the names of the delayed streams like [a0], [a1], ...

    // Add each audio file as an input
    audioSegments.forEach((segment, index) => {
      inputs += `-i "${segment.path}" `;

      // Calculate delay in milliseconds for the current segment
      const delayMs = Math.round(segment.start * 1000);

      // Log the delay being applied for each segment
      console.log(`Segment ${index} (ID: ${segment.subtitle_id}): Input index [${index + 1}], Positioning at ${segment.start}s (delay: ${delayMs}ms)`);

      // --- CORRECTED INDEXING ---
      // Use `index + 1` because input [0] is anullsrc
      const inputIndex = index + 1;
      const delayedStreamName = `a${index}`; // Name for the output stream of this filter chain part

      // Apply resampling (safety), delay, and volume to the correct input stream
      // Output this processed stream as [a<index>] (e.g., [a0], [a1], ...)
      // Use a moderate volume boost (1.5) as we'll preserve full volume during mixing
      filterComplex += `[${inputIndex}]aresample=44100,adelay=${delayMs}|${delayMs},volume=1.5[${delayedStreamName}]; `;
      amixInputs.push(`[${delayedStreamName}]`); // Add the delayed stream name to the list for amix
    });

    // Combine all delayed audio streams
    if (audioSegments.length > 0) {
      if (audioSegments.length === 1) {
        // If there's only one segment, just map it directly to output
        filterComplex += `${amixInputs[0]}asetpts=PTS-STARTPTS[aout]`;
      } else {
        // For multiple segments, use amix with normalize=0 to prevent volume reduction during overlaps
        // This is the key setting that ensures overlapping segments maintain their volume
        filterComplex += `${amixInputs.join('')}amix=inputs=${audioSegments.length}:dropout_transition=0:normalize=0[aout]`;
      }
    } else {
      // If there are no audio segments, the output is just the silent track
      filterComplex = '[0:a]acopy[aout]'; // Map the anullsrc input directly
    }


    // Build the complete ffmpeg command
    // Input [0] is the silent anullsrc base track.
    // Inputs [1], [2], ... are the actual audio files.
    // The filter_complex positions inputs [1], [2], ... based on their timing.
    const ffmpegCommand = `ffmpeg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100:duration=${totalDuration} ${inputs} -filter_complex "${filterComplex}" -map "[aout]" -c:a pcm_s16le -ar 44100 "${outputPath}" -y`;

    console.log(`Running ffmpeg command: ${ffmpegCommand}`);

    // Execute the ffmpeg command
    await new Promise((resolve, reject) => {
      // Increase maxBuffer size if commands/output might be very long
      exec(ffmpegCommand, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing ffmpeg: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          reject(error);
          return;
        }
        // Log only snippets of potentially long stdout/stderr
        console.log(`ffmpeg stdout: ${stdout.substring(0, 200)}${stdout.length > 200 ? '...' : ''}`);
        console.log(`ffmpeg stderr: ${stderr.substring(0, 200)}${stderr.length > 200 ? '...' : ''}`);

        // Check stderr for potential warnings even if exec doesn't return an error code
        if (stderr.toLowerCase().includes('error') || stderr.toLowerCase().includes('failed')) {
            console.warn(`Potential ffmpeg warnings detected in stderr: ${stderr.substring(0, 500)}...`);
        }

        resolve();
      });
    });

    // Check if the output file was created
    if (!fs.existsSync(outputPath)) {
      console.error(`Output file was not created: ${outputPath}`);
      return res.status(500).json({ error: 'Failed to create aligned audio file' });
    }

    // Check if the output file has content
    const outputStats = fs.statSync(outputPath);
    if (outputStats.size === 0) {
      console.error(`Output file is empty: ${outputPath}`);
      // Attempt cleanup even on error
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) { console.error('Error cleaning up empty output file:', e); }
      return res.status(500).json({ error: 'Created aligned audio file is empty' });
    }

    console.log(`Successfully created aligned audio file: ${outputPath} (${outputStats.size} bytes)`);

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
      }

      // Clean up the temporary files AFTER sending is complete or failed
      try {
        // Clean up the output file
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
          console.log('Cleaned up temporary output file');
        }

        // Clean up any temporary files created for base64 audio data
        for (const segment of audioSegments) {
          if (segment.type === 'temp' && segment.tempFile && fs.existsSync(segment.tempFile)) {
            fs.unlinkSync(segment.tempFile);
            console.log(`Cleaned up temporary file: ${segment.tempFile}`);
          }
        }
      } catch (cleanupError) {
        console.error(`Error cleaning up temporary files: ${cleanupError.message}`);
      }
    });
  } catch (error) {
    console.error('Error creating aligned audio file:', error);

    // Clean up any temporary files that might have been created
    try {
      // Clean up the output file if it exists
      if (outputPath && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        console.log('Cleaned up temporary output file after error');
      }

      // Clean up any temporary files created for base64 audio data
      if (audioSegments) {
        for (const segment of audioSegments) {
          if (segment.type === 'temp' && segment.tempFile && fs.existsSync(segment.tempFile)) {
            fs.unlinkSync(segment.tempFile);
            console.log(`Cleaned up temporary file after error: ${segment.tempFile}`);
          }
        }
      }
    } catch (cleanupError) {
      console.error(`Error cleaning up temporary files after error: ${cleanupError.message}`);
    }

    // Ensure response is sent even if error happens before sending file
    if (!res.headersSent) {
      res.status(500).json({ error: `Failed to create aligned audio file: ${error.message}` });
    }
  }
};

/**
 * Download all narration audio files as a zip
 */
const downloadAllAudio = async (req, res) => {
  console.log('Received download-all request');

  try {
    // Get the filenames from the request body
    const { filenames } = req.body;
    console.log(`Received ${filenames ? filenames.length : 0} filenames for download`);

    if (!filenames || filenames.length === 0) {
      console.log('No filenames provided, returning 400');
      return res.status(400).json({ error: 'No filenames provided' });
    }

    // Create a temporary directory for the zip file
    const tempDir = path.join(TEMP_AUDIO_DIR);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create the output zip file path
    const timestamp = Date.now();
    const zipFilename = `narration_audio_${timestamp}.zip`;
    const zipPath = path.join(tempDir, zipFilename);

    // Check if all files exist
    const validFiles = [];
    for (const filename of filenames) {
      const filePath = path.join(OUTPUT_AUDIO_DIR, filename);
      if (fs.existsSync(filePath)) {
        validFiles.push(filePath);
      } else {
        console.log(`File not found: ${filePath}`);
      }
    }

    if (validFiles.length === 0) {
      console.log('No valid files found, returning 404');
      return res.status(404).json({ error: 'No valid audio files found' });
    }

    console.log(`Found ${validFiles.length} valid files for download`);

    // Create a zip file using the zip command
    const zipCommand = `zip -j "${zipPath}" ${validFiles.map(file => `"${file}"`).join(' ')}`;
    console.log(`Running zip command: ${zipCommand}`);

    await new Promise((resolve, reject) => {
      exec(zipCommand, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing zip: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          reject(error);
          return;
        }
        console.log(`zip stdout: ${stdout}`);
        resolve();
      });
    });

    // Check if the zip file was created
    if (!fs.existsSync(zipPath)) {
      console.error(`Zip file was not created: ${zipPath}`);
      return res.status(500).json({ error: 'Failed to create zip file' });
    }

    // Check if the zip file has content
    const zipStats = fs.statSync(zipPath);
    if (zipStats.size === 0) {
      console.error(`Zip file is empty: ${zipPath}`);
      try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch (e) { console.error('Error cleaning up empty zip file:', e); }
      return res.status(500).json({ error: 'Created zip file is empty' });
    }

    console.log(`Successfully created zip file: ${zipPath} (${zipStats.size} bytes)`);

    // Set the appropriate headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${zipFilename}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    // Send the file
    res.sendFile(zipPath, (err) => {
      if (err) {
        console.error(`Error sending file: ${err.message}`);
        // Don't send another response if headers are already sent
        if (!res.headersSent) {
          res.status(500).json({ error: `Failed to send zip file: ${err.message}` });
        }
      } else {
        console.log(`Successfully sent zip file`);
      }

      // Clean up the temporary zip file AFTER sending is complete or failed
      try {
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);
          console.log('Cleaned up temporary zip file');
        }
      } catch (cleanupError) {
        console.error(`Error cleaning up temporary zip file: ${cleanupError.message}`);
      }
    });
  } catch (error) {
    console.error('Error creating zip file:', error);
    // Ensure response is sent even if error happens before sending file
    if (!res.headersSent) {
      res.status(500).json({ error: `Failed to create zip file: ${error.message}` });
    }
  }
};

/**
 * Enhance F5-TTS narration results with timing information
 * This function ensures F5-TTS narrations have the same metadata as Gemini narrations
 * for proper alignment and playback in the video player.
 *
 * @param {Array} narrationResults - Array of narration results from F5-TTS
 * @param {Array} subtitles - Array of subtitles with timing information
 * @returns {Array} - Enhanced narration results with timing information
 */
const enhanceF5TTSNarrations = (narrationResults, subtitles) => {
  if (!narrationResults || !Array.isArray(narrationResults)) {
    console.log('No narration results to enhance');
    return narrationResults;
  }

  if (!subtitles || !Array.isArray(subtitles)) {
    console.log('No subtitles provided for timing information');
    return narrationResults;
  }

  console.log(`Enhancing ${narrationResults.length} F5-TTS narration results with timing information`);

  // Create a map of subtitles by ID for quick lookup
  const subtitleMap = {};
  subtitles.forEach(subtitle => {
    if (subtitle.id) {
      subtitleMap[subtitle.id] = subtitle;
    }
  });

  // Enhance each narration result with timing information
  return narrationResults.map(result => {
    // Find the corresponding subtitle for timing information
    const subtitle = subtitleMap[result.subtitle_id];

    // If we found a matching subtitle, use its timing
    if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
      console.log(`Found timing for subtitle ${result.subtitle_id}: ${subtitle.start}s - ${subtitle.end}s`);
      return {
        ...result,
        start: subtitle.start,
        end: subtitle.end
      };
    }

    // Otherwise, keep existing timing or use defaults
    return {
      ...result,
      start: result.start || 0,
      end: result.end || (result.start ? result.start + 5 : 5)
    };
  });
};

// Export functions
module.exports = {
  serveAudioFile,
  downloadAlignedAudio,
  downloadAllAudio,
  enhanceF5TTSNarrations
};