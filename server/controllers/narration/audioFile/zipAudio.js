/**
 * Module for creating zip files of audio files
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import directory paths
const { OUTPUT_AUDIO_DIR, TEMP_AUDIO_DIR } = require('../directoryManager');

/**
 * Download all narration audio files as a zip
 */
const downloadAllAudio = async (req, res) => {


  try {
    // Get the filenames from the request body
    const { filenames } = req.body;


    if (!filenames || filenames.length === 0) {

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
      // Handle both legacy and new directory structure
      const filePath = path.join(OUTPUT_AUDIO_DIR, filename);
      if (fs.existsSync(filePath)) {
        validFiles.push(filePath);
      } else {
        // Log that file wasn't found
        console.log(`Audio file not found: ${filePath}`);
      }
    }

    if (validFiles.length === 0) {

      return res.status(404).json({ error: 'No valid audio files found' });
    }



    // Create a zip file using the zip command with spawn


    // Prepare arguments for zip command
    const zipArgs = ['-j', zipPath, ...validFiles];

    await new Promise((resolve, reject) => {
      const zipProcess = spawn('zip', zipArgs);

      let stdoutData = '';
      let stderrData = '';

      zipProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      zipProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      zipProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`zip process exited with code ${code}`);
          console.error(`stderr: ${stderrData}`);
          reject(new Error(`zip process failed with code ${code}`));
          return;
        }


        resolve();
      });

      zipProcess.on('error', (err) => {
        console.error(`Error spawning zip process: ${err.message}`);
        reject(err);
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

      }

      // Clean up the temporary zip file AFTER sending is complete or failed
      try {
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);

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

module.exports = {
  downloadAllAudio
};
