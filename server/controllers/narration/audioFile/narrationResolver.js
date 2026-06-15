/**
 * Narration segment resolution helpers.
 *
 * Resolves narration descriptors into concrete audio segments on disk
 * (existing files or temp files written from inline base64 data) and
 * cleans up any temporary segment files afterwards.
 */

const path = require("path");
const fs = require("fs");

const { OUTPUT_AUDIO_DIR, TEMP_AUDIO_DIR } = require("../directoryManager");
const { removeAudioMetadata, toDurationNumber } = require("./mediaMetadata");

const AUDIO_FILE_EXTENSIONS = new Set([".wav", ".mp3", ".m4a"]);

const listAudioFiles = (directoryPath) => {
  try {
    return fs
      .readdirSync(directoryPath)
      .filter((file) =>
        AUDIO_FILE_EXTENSIONS.has(path.extname(file).toLowerCase()),
      )
      .sort();
  } catch {
    return [];
  }
};

const resolveAudioFileCandidate = (filePath, publicFilename) => {
  try {
    if (!fs.existsSync(filePath)) {
      const parentDir = path.dirname(filePath);
      if (
        !fs.existsSync(parentDir) ||
        !path.basename(parentDir).startsWith("subtitle_")
      ) {
        return { filePath, publicFilename };
      }

      const audioFiles = listAudioFiles(parentDir);
      if (audioFiles.length === 0) {
        return { filePath, publicFilename };
      }

      return {
        filePath: path.join(parentDir, audioFiles[0]),
        publicFilename: `${path.basename(parentDir)}/${audioFiles[0]}`,
      };
    }

    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      return { filePath, publicFilename };
    }

    if (!stats.isDirectory()) {
      return { filePath, publicFilename };
    }

    const audioFiles = listAudioFiles(filePath);
    if (audioFiles.length === 0) {
      return { filePath, publicFilename };
    }

    return {
      filePath: path.join(filePath, audioFiles[0]),
      publicFilename: `${path.basename(filePath)}/${audioFiles[0]}`,
    };
  } catch (error) {
    console.error(
      `Error resolving audio candidate ${publicFilename || filePath}: ${error.message}`,
    );
    return { filePath, publicFilename };
  }
};

const getNarrationDurationHint = (narration) =>
  toDurationNumber(
    narration?.actualDuration ??
      narration?.audioDuration ??
      narration?.duration ??
      narration?.metadataDuration,
  );

const resolveNarrationSegments = (narrations) => {
  const audioSegments = [];

  for (const narration of narrations) {
    if (narration.filename) {
      let filePath = path.join(OUTPUT_AUDIO_DIR, narration.filename);

      try {
        if (
          !fs.existsSync(filePath) &&
          narration.filename.includes("f5tts_1.wav")
        ) {
          const alternativeFilename = narration.filename.replace(
            "f5tts_1.wav",
            "1.wav",
          );
          const alternativePath = path.join(
            OUTPUT_AUDIO_DIR,
            alternativeFilename,
          );
          if (fs.existsSync(alternativePath)) {
            filePath = alternativePath;
            narration.filename = alternativeFilename;
          }
        }
        const resolvedCandidate = resolveAudioFileCandidate(
          filePath,
          narration.filename,
        );
        filePath = resolvedCandidate.filePath;
        narration.filename = resolvedCandidate.publicFilename;
      } catch (dirError) {
        console.error(
          `Error resolving narration file ${narration.filename}: ${dirError.message}`,
        );
      }

      if (!fs.existsSync(filePath)) {
        console.warn(`Skipping missing narration file: ${narration.filename}`);
        continue;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        console.warn(`Skipping non-file narration path: ${narration.filename}`);
        continue;
      }
      if (stats.size === 0) {
        throw new Error(`Audio file is empty: ${narration.filename}`);
      }

      const start = typeof narration.start === "number" ? narration.start : 0;
      const end = typeof narration.end === "number" ? narration.end : start + 5;
      if (end <= start) {
        throw new Error(
          `Invalid duration for audio file: ${narration.filename}`,
        );
      }

      audioSegments.push({
        path: filePath,
        start,
        end,
        subtitle_id: narration.subtitle_id,
        original_ids: narration.original_ids,
        publicFilename: narration.filename,
        type: "file",
        isGrouped: narration.original_ids && narration.original_ids.length > 1,
        actualDuration: getNarrationDurationHint(narration),
      });
      continue;
    }

    if (narration.audioData) {
      const tempFilename = `temp_aligned_${narration.subtitle_id}_${Date.now()}.wav`;
      const tempFilePath = path.join(TEMP_AUDIO_DIR, tempFilename);

      if (!fs.existsSync(TEMP_AUDIO_DIR)) {
        fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
      }

      let base64Data = narration.audioData;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      fs.writeFileSync(tempFilePath, Buffer.from(base64Data, "base64"));

      const start = typeof narration.start === "number" ? narration.start : 0;
      const end = typeof narration.end === "number" ? narration.end : start + 5;
      if (end <= start) {
        throw new Error(
          `Invalid duration for narration ${narration.subtitle_id}`,
        );
      }

      audioSegments.push({
        path: tempFilePath,
        start,
        end,
        subtitle_id: narration.subtitle_id,
        original_ids: narration.original_ids,
        publicFilename: tempFilename,
        type: "temp",
        isGrouped: narration.original_ids && narration.original_ids.length > 1,
        tempFile: tempFilePath,
        actualDuration: getNarrationDurationHint(narration),
      });
      continue;
    }

    console.warn(
      `Skipping narration ${narration.subtitle_id}: no filename or audioData`,
    );
  }

  return audioSegments;
};

const cleanupTemporarySegmentFiles = (audioSegments) => {
  for (const segment of audioSegments) {
    if (
      segment.type === "temp" &&
      segment.tempFile &&
      fs.existsSync(segment.tempFile)
    ) {
      try {
        fs.unlinkSync(segment.tempFile);
        removeAudioMetadata(segment.tempFile);
      } catch (error) {
        console.error(
          `Failed to clean temp narration segment ${segment.tempFile}: ${error.message}`,
        );
      }
    }
  }
};

module.exports = {
  AUDIO_FILE_EXTENSIONS,
  listAudioFiles,
  resolveAudioFileCandidate,
  getNarrationDurationHint,
  resolveNarrationSegments,
  cleanupTemporarySegmentFiles,
};
