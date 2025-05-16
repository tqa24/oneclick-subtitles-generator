/**
 * Module for modifying audio speed using ffmpeg
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import directory paths
const { OUTPUT_AUDIO_DIR, TEMP_AUDIO_DIR } = require('../directoryManager');

/**
 * Modify the speed of an audio file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const modifyAudioSpeed = async (req, res) => {
  try {
    // Get the filename and speed factor from the request body
    const { filename, speedFactor } = req.body;

    if (!filename || !speedFactor) {
      return res.status(400).json({ error: 'Missing required parameters (filename, speedFactor)' });
    }

    // Validate speed factor (between 0.5 and 2.0)
    const speed = parseFloat(speedFactor);
    if (isNaN(speed) || speed < 0.5 || speed > 2.0) {
      return res.status(400).json({ error: 'Speed factor must be between 0.5 and 2.0' });
    }

    // Get the full path to the audio file
    const audioPath = path.join(OUTPUT_AUDIO_DIR, filename);

    // Check if the file exists
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: `Audio file not found: ${filename}` });
    }

    // Create a backup of the original file if it doesn't exist already
    const backupFilename = `${path.dirname(filename)}/backup_${path.basename(filename)}`;
    const backupPath = path.join(OUTPUT_AUDIO_DIR, backupFilename);
    
    if (!fs.existsSync(backupPath)) {
      // Copy the original file to the backup location
      fs.copyFileSync(audioPath, backupPath);
    }

    // Use the backup file as the source to preserve quality
    const sourceFile = fs.existsSync(backupPath) ? backupPath : audioPath;

    // Construct ffmpeg command to modify audio speed
    // atempo filter allows speed adjustment between 0.5 and 2.0
    // For values outside this range, we can chain multiple atempo filters
    let filterComplex = '';
    
    if (speed >= 0.5 && speed <= 2.0) {
      // Simple case: single atempo filter
      filterComplex = `atempo=${speed}`;
    } else if (speed > 2.0 && speed <= 4.0) {
      // Chain two atempo filters for speeds between 2.0 and 4.0
      const halfSpeed = Math.sqrt(speed);
      filterComplex = `atempo=${halfSpeed},atempo=${halfSpeed}`;
    } else if (speed < 0.5 && speed >= 0.25) {
      // Chain two atempo filters for speeds between 0.25 and 0.5
      const halfSpeed = Math.sqrt(speed);
      filterComplex = `atempo=${halfSpeed},atempo=${halfSpeed}`;
    } else {
      return res.status(400).json({ error: 'Speed factor must be between 0.25 and 4.0' });
    }

    // Build the ffmpeg command arguments
    const ffmpegArgs = [
      '-i', sourceFile,
      '-filter:a', filterComplex,
      '-c:a', 'pcm_s16le',  // Use same codec as original files
      '-ar', '44100',       // Maintain sample rate
      '-y',                 // Overwrite output file
      audioPath             // Output to the original file location
    ];

    // Execute the ffmpeg command
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
      if (code === 0) {
        // Success
        res.json({
          success: true,
          message: `Successfully modified audio speed to ${speed}x`,
          filename: filename
        });
      } else {
        // Error
        console.error(`Error modifying audio speed: ${stderrData}`);
        res.status(500).json({
          success: false,
          error: `Error modifying audio speed: ffmpeg process exited with code ${code}`
        });
      }
    });
  } catch (error) {
    console.error(`Error in modifyAudioSpeed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `Server error: ${error.message}`
    });
  }
};

/**
 * Batch modify the speed of multiple audio files
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const batchModifyAudioSpeed = async (req, res) => {
  try {
    // Get the filenames and speed factor from the request body
    const { filenames, speedFactor } = req.body;

    if (!filenames || !Array.isArray(filenames) || filenames.length === 0 || !speedFactor) {
      return res.status(400).json({ error: 'Missing required parameters (filenames array, speedFactor)' });
    }

    // Validate speed factor (between 0.5 and 2.0)
    const speed = parseFloat(speedFactor);
    if (isNaN(speed) || speed < 0.5 || speed > 2.0) {
      return res.status(400).json({ error: 'Speed factor must be between 0.5 and 2.0' });
    }

    // Process each file
    const results = [];
    const errors = [];

    // Process files sequentially to avoid overwhelming the system
    for (const filename of filenames) {
      try {
        // Get the full path to the audio file
        const audioPath = path.join(OUTPUT_AUDIO_DIR, filename);

        // Check if the file exists
        if (!fs.existsSync(audioPath)) {
          errors.push({ filename, error: 'File not found' });
          continue;
        }

        // Create a backup of the original file if it doesn't exist already
        const backupFilename = `${path.dirname(filename)}/backup_${path.basename(filename)}`;
        const backupPath = path.join(OUTPUT_AUDIO_DIR, backupFilename);
        
        if (!fs.existsSync(backupPath)) {
          // Copy the original file to the backup location
          fs.copyFileSync(audioPath, backupPath);
        }

        // Use the backup file as the source to preserve quality
        const sourceFile = fs.existsSync(backupPath) ? backupPath : audioPath;

        // Construct ffmpeg filter complex
        let filterComplex = '';
        
        if (speed >= 0.5 && speed <= 2.0) {
          filterComplex = `atempo=${speed}`;
        } else if (speed > 2.0 && speed <= 4.0) {
          const halfSpeed = Math.sqrt(speed);
          filterComplex = `atempo=${halfSpeed},atempo=${halfSpeed}`;
        } else if (speed < 0.5 && speed >= 0.25) {
          const halfSpeed = Math.sqrt(speed);
          filterComplex = `atempo=${halfSpeed},atempo=${halfSpeed}`;
        } else {
          errors.push({ filename, error: 'Speed factor must be between 0.25 and 4.0' });
          continue;
        }

        // Build the ffmpeg command arguments
        const ffmpegArgs = [
          '-i', sourceFile,
          '-filter:a', filterComplex,
          '-c:a', 'pcm_s16le',
          '-ar', '44100',
          '-y',
          audioPath
        ];

        // Execute the ffmpeg command and wait for it to complete
        await new Promise((resolve, reject) => {
          const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
          
          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              results.push({ filename, success: true });
              resolve();
            } else {
              errors.push({ filename, error: `ffmpeg process exited with code ${code}` });
              resolve(); // Still resolve to continue with other files
            }
          });
          
          ffmpegProcess.on('error', (err) => {
            errors.push({ filename, error: err.message });
            resolve(); // Still resolve to continue with other files
          });
        });
      } catch (error) {
        errors.push({ filename, error: error.message });
      }
    }

    // Return the results
    res.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error(`Error in batchModifyAudioSpeed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: `Server error: ${error.message}`
    });
  }
};

module.exports = {
  modifyAudioSpeed,
  batchModifyAudioSpeed
};
