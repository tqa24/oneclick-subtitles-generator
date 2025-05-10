/**
 * Module for serving audio files from narration directories
 */

const path = require('path');
const fs = require('fs');

// Import directory paths
const { REFERENCE_AUDIO_DIR, OUTPUT_AUDIO_DIR, TEMP_AUDIO_DIR } = require('../directoryManager');

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

module.exports = {
  serveAudioFile
};
