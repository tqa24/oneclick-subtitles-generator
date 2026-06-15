/**
 * Stale aligned audio file cleanup.
 *
 * Removes old aligned-narration outputs and temporary segment files from the
 * temp directory, while always keeping the most recent few so an in-flight
 * download is never deleted out from under itself.
 */

const path = require("path");
const fs = require("fs");

const { TEMP_AUDIO_DIR } = require("../directoryManager");
const { removeAudioMetadata } = require("./mediaMetadata");

const ALIGNED_FILE_PREFIX = "aligned_narration_";
const TEMP_SEGMENT_FILE_PREFIX = "temp_aligned_";
const STALE_ALIGNED_FILE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const cleanupStaleAlignedAudioFiles = () => {
  try {
    if (!fs.existsSync(TEMP_AUDIO_DIR)) {
      return;
    }

    const now = Date.now();
    const candidates = fs
      .readdirSync(TEMP_AUDIO_DIR)
      .filter(
        (filename) =>
          filename.startsWith(ALIGNED_FILE_PREFIX) ||
          filename.startsWith(TEMP_SEGMENT_FILE_PREFIX),
      )
      .map((filename) => {
        const filePath = path.join(TEMP_AUDIO_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          filePath,
          mtimeMs: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    candidates.forEach((candidate, index) => {
      const isRecentEnough =
        now - candidate.mtimeMs < STALE_ALIGNED_FILE_MAX_AGE_MS;
      const keepRecentFiles = index < 5;
      if (isRecentEnough || keepRecentFiles) {
        return;
      }

      try {
        fs.unlinkSync(candidate.filePath);
        removeAudioMetadata(candidate.filePath);
      } catch (error) {
        console.error(
          `Failed to remove stale aligned audio file ${candidate.filename}: ${error.message}`,
        );
      }
    });
  } catch (error) {
    console.error(
      `Failed to clean stale aligned audio files: ${error.message}`,
    );
  }
};

module.exports = {
  ALIGNED_FILE_PREFIX,
  TEMP_SEGMENT_FILE_PREFIX,
  STALE_ALIGNED_FILE_MAX_AGE_MS,
  cleanupStaleAlignedAudioFiles,
};
