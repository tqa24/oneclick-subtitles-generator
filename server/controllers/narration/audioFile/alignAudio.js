/**
 * Aligned narration generation and download handlers.
 *
 * Large jobs are rendered to a temp file first, then either:
 * - returned as JSON metadata for streamed playback, or
 * - streamed directly for an explicit download.
 */

const path = require("path");
const fs = require("fs");

const { OUTPUT_AUDIO_DIR, TEMP_AUDIO_DIR } = require("../directoryManager");
const {
  analyzeAndAdjustSegments,
  getMediaDuration,
  renderAlignedAudioTimeline,
} = require("./batchProcessor");

const DEFAULT_PLAYBACK_FORMAT = "m4a";
const DEFAULT_DOWNLOAD_FORMAT = "wav";
const ALIGNED_FILE_PREFIX = "aligned_narration_";
const TEMP_SEGMENT_FILE_PREFIX = "temp_aligned_";
const STALE_ALIGNED_FILE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const ALIGNED_RESPONSE_HEADERS = [
  "Content-Disposition",
  "X-Duration-Difference",
  "X-Expected-Duration",
  "X-Actual-Duration",
  "X-Max-Adjustment-Segment",
  "X-Max-Adjustment-Amount",
  "X-Max-Adjustment-Strategy",
].join(", ");

const getAudioContentType = (format) => {
  if (format === "wav") {
    return "audio/wav";
  }

  return "audio/mp4";
};

const inferDownloadFormat = (req) => {
  const requestedFormat = String(req.body?.format || "").toLowerCase();
  if (requestedFormat === "wav" || requestedFormat === "m4a") {
    return requestedFormat;
  }

  const acceptHeader = String(req.headers?.accept || "");
  if (acceptHeader.includes("audio/wav")) {
    return "wav";
  }

  return DEFAULT_DOWNLOAD_FORMAT;
};

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

const buildAudioRoutePath = (publicFilename) => {
  if (!publicFilename) {
    return null;
  }

  return `/api/narration/audio/${String(publicFilename)
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
};

const setAlignedResponseHeaders = (res, metadata, format) => {
  res.setHeader(
    "X-Duration-Difference",
    metadata.durationDifference.toFixed(2),
  );
  res.setHeader("X-Expected-Duration", metadata.expectedDuration.toFixed(2));
  res.setHeader("X-Actual-Duration", metadata.actualDuration.toFixed(2));
  res.setHeader("Access-Control-Expose-Headers", ALIGNED_RESPONSE_HEADERS);

  if (metadata.adjustmentStats?.maxAdjustment) {
    res.setHeader(
      "X-Max-Adjustment-Segment",
      metadata.adjustmentStats.maxAdjustment.segmentId,
    );
    res.setHeader(
      "X-Max-Adjustment-Amount",
      metadata.adjustmentStats.maxAdjustment.adjustmentAmount.toFixed(2),
    );
    res.setHeader(
      "X-Max-Adjustment-Strategy",
      metadata.adjustmentStats.maxAdjustment.strategy,
    );
  }

  if (format) {
    res.setHeader("Content-Type", getAudioContentType(format));
  }
};

const resolveNarrationSegments = (narrations) => {
  const audioSegments = [];

  for (const narration of narrations) {
    if (narration.filename) {
      let filePath = path.join(OUTPUT_AUDIO_DIR, narration.filename);
      const subtitleDir = path.dirname(filePath);

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

        if (!fs.existsSync(filePath) && fs.existsSync(subtitleDir)) {
          const audioFiles = fs
            .readdirSync(subtitleDir)
            .filter(
              (file) =>
                file.endsWith(".wav") ||
                file.endsWith(".mp3") ||
                file.endsWith(".m4a"),
            );

          if (audioFiles.length > 0) {
            filePath = path.join(subtitleDir, audioFiles[0]);
            narration.filename = `${path.basename(subtitleDir)}/${audioFiles[0]}`;
          }
        }
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
      } catch (error) {
        console.error(
          `Failed to clean temp narration segment ${segment.tempFile}: ${error.message}`,
        );
      }
    }
  }
};

const createAlignedPreviewPlan = async (narrations) => {
  if (!Array.isArray(narrations) || narrations.length === 0) {
    const error = new Error("No narrations provided");
    error.statusCode = 400;
    throw error;
  }

  cleanupStaleAlignedAudioFiles();

  const sortedNarrations = [...narrations].sort((a, b) => a.start - b.start);
  const audioSegments = resolveNarrationSegments(sortedNarrations);

  if (audioSegments.length === 0) {
    const error = new Error(
      "No valid audio files found for aligned narration generation",
    );
    error.statusCode = 400;
    error.details = {
      total_narrations: narrations.length,
      processed_segments: 0,
      message:
        "All narration files were missing or invalid. Please ensure narrations are generated successfully before creating aligned audio.",
    };
    throw error;
  }

  const analysisResult =
    audioSegments.length > 1
      ? await analyzeAndAdjustSegments(audioSegments)
      : {
          adjustedSegments: await Promise.all(
            audioSegments.map(async (segment) => {
              const actualDuration = await getMediaDuration(segment.path).catch(
                () => {
                  return (
                    Math.max(0, (segment.end || 0) - (segment.start || 0)) || 5
                  );
                },
              );

              return {
                ...segment,
                actualDuration,
                naturalEnd: segment.start + actualDuration,
              };
            }),
          ),
          adjustmentStats: {
            adjustedCount: 0,
            leftMoves: 0,
            rightMoves: 0,
            maxAdjustment: null,
          },
        };

  const previewItems = analysisResult.adjustedSegments.map((segment, index) => {
    const actualDuration =
      segment.actualDuration ||
      Math.max(0, (segment.end || 0) - (segment.start || 0));
    const naturalEnd = segment.naturalEnd || segment.start + actualDuration;
    const originalStart =
      typeof segment.originalStart === "number"
        ? segment.originalStart
        : segment.start;

    return {
      id: `${segment.subtitle_id || "segment"}_${index}`,
      subtitle_id: segment.subtitle_id,
      original_ids: segment.original_ids || [],
      start: segment.start,
      end: segment.end,
      originalStart,
      actualDuration,
      naturalEnd,
      shiftAmount: segment.shiftAmount || 0,
      adjustmentStrategy: segment.adjustmentStrategy || null,
      filename: segment.publicFilename,
      url: buildAudioRoutePath(segment.publicFilename),
    };
  });

  const expectedDuration = Math.max(
    ...sortedNarrations.map((narration) => narration.end || 0),
    0,
  );
  const actualDuration =
    previewItems.length > 0
      ? Math.max(...previewItems.map((item) => item.naturalEnd), 0)
      : expectedDuration;

  return {
    items: previewItems,
    expectedDuration,
    actualDuration,
    durationDifference: actualDuration - expectedDuration,
    adjustmentStats: analysisResult.adjustmentStats,
  };
};

const createAlignedAudioFile = async (narrations, options = {}) => {
  const format = options.format || DEFAULT_PLAYBACK_FORMAT;

  if (!Array.isArray(narrations) || narrations.length === 0) {
    const error = new Error("No narrations provided");
    error.statusCode = 400;
    throw error;
  }

  cleanupStaleAlignedAudioFiles();

  const sortedNarrations = [...narrations].sort((a, b) => a.start - b.start);
  const audioSegments = resolveNarrationSegments(sortedNarrations);

  if (audioSegments.length === 0) {
    const error = new Error(
      "No valid audio files found for aligned narration generation",
    );
    error.statusCode = 400;
    error.details = {
      total_narrations: narrations.length,
      processed_segments: 0,
      message:
        "All narration files were missing or invalid. Please ensure narrations are generated successfully before creating aligned audio.",
    };
    throw error;
  }

  const timestamp = Date.now();
  const outputFilename = `${ALIGNED_FILE_PREFIX}${timestamp}.${format}`;
  const outputPath = path.join(TEMP_AUDIO_DIR, outputFilename);

  try {
    const renderResult = await renderAlignedAudioTimeline(
      audioSegments,
      outputPath,
      { format },
    );
    const expectedDuration = Math.max(
      ...sortedNarrations.map((narration) => narration.end || 0),
      0,
    );
    const actualDuration = await getMediaDuration(outputPath).catch(
      () => renderResult.totalDuration || expectedDuration,
    );
    const durationDifference = actualDuration - expectedDuration;

    return {
      outputFilename,
      outputPath,
      expectedDuration,
      actualDuration,
      durationDifference,
      adjustmentStats: renderResult.adjustmentStats,
    };
  } catch (error) {
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        console.error(
          `Failed to remove partial aligned file ${outputPath}: ${cleanupError.message}`,
        );
      }
    }
    throw error;
  } finally {
    cleanupTemporarySegmentFiles(audioSegments);
  }
};

const previewAlignedAudio = async (req, res) => {
  try {
    const metadata = await createAlignedPreviewPlan(req.body?.narrations);

    setAlignedResponseHeaders(res, metadata, null);

    res.json({
      success: true,
      mode: "timeline",
      items: metadata.items,
      expectedDuration: metadata.expectedDuration,
      actualDuration: metadata.actualDuration,
      durationDifference: metadata.durationDifference,
      adjustmentStats: metadata.adjustmentStats,
    });
  } catch (error) {
    console.error("Error preparing aligned audio preview plan:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

const generateAlignedAudio = async (req, res) => {
  try {
    const format =
      String(req.body?.format || DEFAULT_PLAYBACK_FORMAT).toLowerCase() ===
      "wav"
        ? "wav"
        : DEFAULT_PLAYBACK_FORMAT;
    const metadata = await createAlignedAudioFile(req.body?.narrations, {
      format,
    });

    setAlignedResponseHeaders(res, metadata, null);

    res.json({
      success: true,
      filename: metadata.outputFilename,
      url: `/api/narration/audio/${metadata.outputFilename}`,
      contentType: getAudioContentType(format),
      expectedDuration: metadata.expectedDuration,
      actualDuration: metadata.actualDuration,
      durationDifference: metadata.durationDifference,
    });
  } catch (error) {
    console.error("Error generating aligned audio file:", error);
    res.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

const downloadAlignedAudio = async (req, res) => {
  let metadata = null;

  try {
    const format = inferDownloadFormat(req);
    metadata = await createAlignedAudioFile(req.body?.narrations, { format });

    setAlignedResponseHeaders(res, metadata, format);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${metadata.outputFilename}`,
    );

    res.sendFile(metadata.outputPath, (err) => {
      if (err) {
        console.error(`Error sending aligned audio file: ${err.message}`);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ error: `Failed to send audio file: ${err.message}` });
        }
      }

      if (metadata && fs.existsSync(metadata.outputPath)) {
        try {
          fs.unlinkSync(metadata.outputPath);
        } catch (cleanupError) {
          console.error(
            `Failed to remove downloaded aligned audio file ${metadata.outputPath}: ${cleanupError.message}`,
          );
        }
      }
    });
  } catch (error) {
    console.error("Error creating aligned audio download:", error);
    if (metadata && fs.existsSync(metadata.outputPath)) {
      try {
        fs.unlinkSync(metadata.outputPath);
      } catch (cleanupError) {
        console.error(
          `Failed to remove failed aligned audio file ${metadata.outputPath}: ${cleanupError.message}`,
        );
      }
    }

    res.status(error.statusCode || 500).json({
      error: error.message,
      details: error.details,
    });
  }
};

module.exports = {
  previewAlignedAudio,
  generateAlignedAudio,
  downloadAlignedAudio,
};
