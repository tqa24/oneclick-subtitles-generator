/**
 * Module for batch processing of audio segments
 * Handles large numbers of audio segments by splitting them into batches
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import directory paths
const { TEMP_AUDIO_DIR } = require('../directoryManager');

/**
 * Process a batch of audio segments to create an intermediate audio file
 * 
 * @param {Array} audioSegments - Array of audio segments to process
 * @param {string} outputPath - Path to save the output file
 * @param {number} batchIndex - Index of the current batch
 * @param {number} totalDuration - Total duration of the audio
 * @returns {Promise<string>} - Path to the created audio file
 */
const processBatch = async (audioSegments, outputPath, batchIndex, totalDuration) => {

  
  // Create a temporary directory for the filter complex file
  const tempDir = path.join(TEMP_AUDIO_DIR);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create a filter complex for precise audio placement
  let filterComplex = '';
  let amixInputs = []; // Will hold the names of the delayed streams like [a0], [a1], ...
  
  // Process each audio segment for the filter complex
  audioSegments.forEach((segment, index) => {
    // Calculate delay in milliseconds for the current segment
    const delayMs = Math.round(segment.start * 1000);
    
    // Log the delay being applied for each segment

    
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
  audioSegments.forEach(segment => {
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
  concatenateAudioFiles
};
