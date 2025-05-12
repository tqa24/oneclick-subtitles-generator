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
 * Get the directory path for a specific subtitle ID
 * @param {string|number} subtitle_id - The subtitle ID
 * @returns {string} - The directory path for the subtitle ID
 */
const getSubtitleDirectory = (subtitle_id) => {
  return path.join(OUTPUT_AUDIO_DIR, `subtitle_${subtitle_id}`);
};

/**
 * Ensure a subtitle-specific directory exists
 * @param {string|number} subtitle_id - The subtitle ID
 * @returns {string} - The directory path that was created
 */
const ensureSubtitleDirectory = (subtitle_id) => {
  const subtitleDir = getSubtitleDirectory(subtitle_id);
  if (!fs.existsSync(subtitleDir)) {
    fs.mkdirSync(subtitleDir, { recursive: true });
  }
  return subtitleDir;
};

/**
 * Clear all narration output files
 */
const clearNarrationOutputFiles = () => {
  if (fs.existsSync(OUTPUT_AUDIO_DIR)) {
    const outputItems = fs.readdirSync(OUTPUT_AUDIO_DIR);
    let deletedCount = 0;

    outputItems.forEach(item => {
      const itemPath = path.join(OUTPUT_AUDIO_DIR, item);
      try {
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // For directories (subtitle folders), delete all files inside
          const subtitleFiles = fs.readdirSync(itemPath);
          subtitleFiles.forEach(file => {
            const filePath = path.join(itemPath, file);
            fs.unlinkSync(filePath);
            deletedCount++;
          });

          // Then remove the directory itself
          fs.rmdirSync(itemPath);
        } else {
          // For files in the root output directory (legacy files)
          fs.unlinkSync(itemPath);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error deleting item ${itemPath}:`, error);
      }
    });
  }
};

/**
 * Ensure narration directories exist
 */
const ensureNarrationDirectories = () => {
  if (!fs.existsSync(NARRATION_DIR)) {
    fs.mkdirSync(NARRATION_DIR, { recursive: true });
  }

  if (!fs.existsSync(REFERENCE_AUDIO_DIR)) {
    fs.mkdirSync(REFERENCE_AUDIO_DIR, { recursive: true });
  }

  if (!fs.existsSync(OUTPUT_AUDIO_DIR)) {
    fs.mkdirSync(OUTPUT_AUDIO_DIR, { recursive: true });
  }

  if (!fs.existsSync(TEMP_AUDIO_DIR)) {
    fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
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
  getSubtitleDirectory,
  ensureSubtitleDirectory,
  clearNarrationOutputFiles,
  ensureNarrationDirectories,
  clearOutput
};
