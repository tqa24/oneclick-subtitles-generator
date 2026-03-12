/**
 * Module for reading persisted audio duration metadata.
 */

const path = require('path');
const fs = require('fs');
const { OUTPUT_AUDIO_DIR } = require('../directoryManager');
const { resolveDurationMetadata } = require('./mediaMetadata');

/**
 * Get duration of a single audio file in output folder
 * Body: { filename }
 */
const getAudioDuration = async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ success: false, error: 'Missing filename' });
    const audioPath = path.join(OUTPUT_AUDIO_DIR, filename);
    if (!fs.existsSync(audioPath)) return res.status(404).json({ success: false, error: 'File not found' });
    const durationMetadata = await resolveDurationMetadata(audioPath);
    res.json({
      success: true,
      filename,
      duration: durationMetadata?.durationSeconds ?? null,
      source: durationMetadata?.source || 'unknown',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get duration for multiple files
 * Body: { filenames: string[] }
 */
const batchGetAudioDurations = async (req, res) => {
  try {
    const { filenames } = req.body || {};
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing filenames[]' });
    }
    // Run ffprobe in parallel for all files
    const entries = await Promise.all(
      filenames.map(async (fn) => {
        try {
          const p = path.join(OUTPUT_AUDIO_DIR, fn);
          if (!fs.existsSync(p)) return [fn, null];
          const durationMetadata = await resolveDurationMetadata(p);
          return [fn, durationMetadata?.durationSeconds ?? null];
        } catch (_) {
          return [fn, null];
        }
      })
    );
    const results = Object.fromEntries(entries);
    res.json({ success: true, durations: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getAudioDuration,
  batchGetAudioDurations,
};

