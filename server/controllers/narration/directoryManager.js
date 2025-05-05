/**
 * Directory management and utility functions for narration
 */

const path = require('path');
const fs = require('fs');

// Import narration directory from config
const { NARRATION_DIR } = require('../../config');

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
 * Ensure narration directories exist
 */
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
 * Clear narration output files endpoint handler
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

module.exports = {
  REFERENCE_AUDIO_DIR,
  OUTPUT_AUDIO_DIR,
  TEMP_AUDIO_DIR,
  clearNarrationOutputFiles,
  ensureNarrationDirectories,
  clearOutput
};
