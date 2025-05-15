/**
 * Module for batch processing of audio segments
 * Handles large numbers of audio segments by splitting them into batches
 * Includes smart overlap detection and resolution for natural narration
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import directory paths
const { TEMP_AUDIO_DIR } = require('../directoryManager');

// Import media duration utility
const { getMediaDuration } = require('../../../services/videoProcessing/durationUtils');

/**
 * Analyze audio segments and adjust their timing to avoid overlaps
 * This creates a more natural narration by ensuring segments don't talk over each other
 *
 * @param {Array} audioSegments - Array of audio segments to analyze
 * @returns {Promise<Array>} - Array of adjusted audio segments
 */
const analyzeAndAdjustSegments = async (audioSegments) => {
  if (!audioSegments || audioSegments.length <= 1) {
    return audioSegments; // No adjustment needed for 0 or 1 segments
  }

  console.log(`Analyzing ${audioSegments.length} audio segments for smart overlap resolution...`);

  // Sort segments by start time (should already be sorted, but ensure it)
  audioSegments.sort((a, b) => a.start - b.start);

  // First pass: Get actual durations of each audio file
  const segmentsWithDuration = [];
  for (const segment of audioSegments) {
    try {
      // Get the actual duration of the audio file
      const actualDuration = await getMediaDuration(segment.path);

      // Add the actual duration to the segment
      segmentsWithDuration.push({
        ...segment,
        actualDuration,
        // Calculate a "natural end" based on start time + actual duration
        // This represents when the audio would naturally end if played at the start time
        naturalEnd: segment.start + actualDuration
      });
    } catch (error) {
      console.error(`Error getting duration for audio segment: ${error.message}`);
      // If we can't get the duration, use the subtitle timing as fallback
      segmentsWithDuration.push({
        ...segment,
        actualDuration: segment.end - segment.start,
        naturalEnd: segment.end
      });
    }
  }

  // Second pass: Detect and resolve overlaps
  const adjustedSegments = [];
  let previousSegment = null;

  for (const segment of segmentsWithDuration) {
    if (!previousSegment) {
      // First segment doesn't need adjustment
      adjustedSegments.push(segment);
      previousSegment = segment;
      continue;
    }

    // Check if this segment would overlap with the previous one
    const wouldOverlap = segment.start < previousSegment.naturalEnd;

    if (wouldOverlap) {
      // Calculate how much overlap would occur
      const overlapAmount = previousSegment.naturalEnd - segment.start;

      // Log the overlap detection
      console.log(`Detected overlap of ${overlapAmount.toFixed(2)}s between segments:
        - Previous: ID ${previousSegment.subtitle_id}, Start: ${previousSegment.start.toFixed(2)}, Natural End: ${previousSegment.naturalEnd.toFixed(2)}
        - Current: ID ${segment.subtitle_id}, Start: ${segment.start.toFixed(2)}, End: ${segment.end.toFixed(2)}`);

      // Adjust the start time of the current segment to avoid overlap
      // Add a small gap (0.1s) between segments for natural pacing
      const adjustedStart = previousSegment.naturalEnd + 0.1;

      // Calculate how much we need to shift this segment
      const shiftAmount = adjustedStart - segment.start;

      // Create adjusted segment
      const adjustedSegment = {
        ...segment,
        start: adjustedStart,
        // Update the natural end based on the new start time
        naturalEnd: adjustedStart + segment.actualDuration,
        // Keep track of the original timing for reference
        originalStart: segment.start,
        // Note how much we shifted this segment
        shiftAmount
      };

      // Log the adjustment
      console.log(`Adjusted segment ${segment.subtitle_id}: Shifted by ${shiftAmount.toFixed(2)}s to start at ${adjustedStart.toFixed(2)}s`);

      adjustedSegments.push(adjustedSegment);
      previousSegment = adjustedSegment;
    } else {
      // No overlap, keep as is
      adjustedSegments.push(segment);
      previousSegment = segment;
    }
  }

  // Log summary of adjustments
  const adjustedCount = adjustedSegments.filter(s => s.shiftAmount).length;
  if (adjustedCount > 0) {
    console.log(`Smart overlap resolution complete: Adjusted ${adjustedCount} of ${audioSegments.length} segments for natural narration flow.`);
  } else {
    console.log(`No overlaps detected among ${audioSegments.length} segments. No adjustments needed.`);
  }

  return adjustedSegments;
};

/**
 * Process a batch of audio segments to create an intermediate audio file
 * Includes smart overlap detection and resolution for natural narration
 *
 * @param {Array} audioSegments - Array of audio segments to process
 * @param {string} outputPath - Path to save the output file
 * @param {number} batchIndex - Index of the current batch
 * @param {number} totalDuration - Total duration of the audio
 * @param {boolean} [smartOverlapResolution=true] - Whether to use smart overlap resolution
 * @returns {Promise<string>} - Path to the created audio file
 */
const processBatch = async (audioSegments, outputPath, batchIndex, totalDuration, smartOverlapResolution = true) => {

  // Apply smart overlap resolution if enabled
  let segmentsToProcess = audioSegments;
  if (smartOverlapResolution && audioSegments.length > 1) {
    try {
      // Analyze and adjust segments to avoid overlaps
      segmentsToProcess = await analyzeAndAdjustSegments(audioSegments);
    } catch (error) {
      console.error(`Error during smart overlap resolution: ${error.message}`);
      console.error('Falling back to original segments without overlap resolution');
      segmentsToProcess = audioSegments;
    }
  }

  // Create a temporary directory for the filter complex file
  const tempDir = path.join(TEMP_AUDIO_DIR);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Create a filter complex for precise audio placement
  let filterComplex = '';
  let amixInputs = []; // Will hold the names of the delayed streams like [a0], [a1], ...

  // Process each audio segment for the filter complex
  segmentsToProcess.forEach((segment, index) => {
    // Calculate delay in milliseconds for the current segment
    const delayMs = Math.round(segment.start * 1000);

    // Log the delay being applied for each segment
    const wasAdjusted = segment.shiftAmount ? ` (adjusted by ${segment.shiftAmount.toFixed(2)}s)` : '';
    console.log(`Segment ${segment.subtitle_id}: Applying delay of ${delayMs}ms${wasAdjusted}`);

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
  if (segmentsToProcess.length > 0) {
    if (segmentsToProcess.length === 1) {
      // If there's only one segment, just map it directly to output
      filterComplex += `${amixInputs[0]}asetpts=PTS-STARTPTS[aout]`;
    } else {
      // For multiple segments, use amix with normalize=0 to prevent volume reduction during overlaps
      // This is the key setting that ensures overlapping segments maintain their volume
      filterComplex += `${amixInputs.join('')}amix=inputs=${segmentsToProcess.length}:dropout_transition=0:normalize=0[aout]`;
    }
  } else {
    // If there are no audio segments, the output is just the silent track
    filterComplex = '[0:a]acopy[aout]'; // Map the anullsrc input directly
  }

  // Create a temporary file for the filter complex to avoid command line length limitations
  const timestamp = Date.now();
  const filterComplexFilename = `filter_complex_batch${batchIndex}_${timestamp}.txt`;
  const filterComplexPath = path.join(tempDir, filterComplexFilename);

  // Write the filter complex to a file
  fs.writeFileSync(filterComplexPath, filterComplex);


  // Build the ffmpeg command arguments as an array
  // Input [0] is the silent anullsrc base track.
  // Inputs [1], [2], ... are the actual audio files.

  // Start with the base arguments
  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${totalDuration}`
  ];

  // Add each audio file as an input
  segmentsToProcess.forEach(segment => {
    ffmpegArgs.push('-i', segment.path);
  });

  // Add the filter complex script and output options
  ffmpegArgs.push(
    '-filter_complex_script', filterComplexPath,
    '-map', '[aout]',
    '-c:a', 'pcm_s16le',
    '-ar', '44100',
    '-y',
    outputPath
  );



  // Execute the ffmpeg command using spawn
  await new Promise((resolve, reject) => {
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let stdoutData = '';
    let stderrData = '';

    ffmpegProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      // Log progress indicators
      if (chunk.includes('size=')) {
        process.stdout.write('.');
      }
    });

    ffmpegProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      // Log progress indicators
      if (chunk.includes('size=')) {
        process.stdout.write('.');
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg process exited with code ${code}`);
        console.error(`stderr: ${stderrData.substring(0, 500)}${stderrData.length > 500 ? '...' : ''}`);
        reject(new Error(`ffmpeg process failed with code ${code}`));
        return;
      }

      // Log only snippets of potentially long stdout/stderr



      // Clean up the filter complex file
      try {
        if (fs.existsSync(filterComplexPath)) {
          fs.unlinkSync(filterComplexPath);

        }
      } catch (cleanupError) {
        console.error(`Error cleaning up filter complex file: ${cleanupError.message}`);
      }

      resolve(outputPath);
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`Error spawning ffmpeg process: ${err.message}`);
      reject(err);
    });
  });

  return outputPath;
};

/**
 * Concatenate multiple audio files into a single file
 *
 * @param {Array<string>} inputFiles - Array of input file paths
 * @param {string} outputPath - Path to save the concatenated file
 * @returns {Promise<string>} - Path to the concatenated file
 */
const concatenateAudioFiles = async (inputFiles, outputPath) => {


  // Create a temporary file list for ffmpeg
  const tempDir = path.join(TEMP_AUDIO_DIR);
  const timestamp = Date.now();
  const fileListPath = path.join(tempDir, `concat_list_${timestamp}.txt`);

  // Write the file list
  const fileListContent = inputFiles.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(fileListPath, fileListContent);

  // Build the ffmpeg command arguments
  const ffmpegArgs = [
    '-f', 'concat',
    '-safe', '0',
    '-i', fileListPath,
    '-c', 'copy',
    '-y',
    outputPath
  ];

  // Execute the ffmpeg command
  await new Promise((resolve, reject) => {
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    let stdoutData = '';
    let stderrData = '';

    ffmpegProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    ffmpegProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg concat process exited with code ${code}`);
        console.error(`stderr: ${stderrData}`);
        reject(new Error(`ffmpeg concat process failed with code ${code}`));
        return;
      }



      // Clean up the file list
      try {
        if (fs.existsSync(fileListPath)) {
          fs.unlinkSync(fileListPath);

        }
      } catch (cleanupError) {
        console.error(`Error cleaning up file list: ${cleanupError.message}`);
      }

      resolve(outputPath);
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`Error spawning ffmpeg concat process: ${err.message}`);
      reject(err);
    });
  });

  return outputPath;
};

module.exports = {
  processBatch,
  concatenateAudioFiles,
  analyzeAndAdjustSegments
};
