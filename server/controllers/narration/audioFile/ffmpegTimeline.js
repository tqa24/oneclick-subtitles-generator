/**
 * ffmpeg execution + aligned-timeline render for the aligned-audio pipeline (split from batchProcessor.js).
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { getFfmpegPath } = require('../../../services/shared/ffmpegUtils');
const { TEMP_AUDIO_DIR } = require('../directoryManager');
const { enrichSegmentsWithDurations } = require('./durationProber');
const { analyzeAndAdjustSegments } = require('./overlapResolver');

const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNEL_LAYOUT = 'stereo';
const FFMPEG_PROGRESS_BUFFER_MAX_LENGTH = 512;
const FFMPEG_TIME_PATTERN = /(?:time|out_time)=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g;

const formatFilterDuration = (durationSeconds) => {
  const safeDuration = Math.max(0, Number(durationSeconds) || 0);
  return safeDuration.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') || '0';
};

const escapeFilterPath = (filePath) => {
  return path.resolve(filePath)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
};

const extractFfmpegProgressSeconds = (buffer) => {
  let latestSeconds = null;
  let match = null;

  FFMPEG_TIME_PATTERN.lastIndex = 0;
  while ((match = FFMPEG_TIME_PATTERN.exec(buffer)) !== null) {
    latestSeconds =
      Number(match[1]) * 3600 +
      Number(match[2]) * 60 +
      Number(match[3]);
  }

  return latestSeconds;
};

function runFfmpeg(ffmpegArgs, description, options = {}) {
  const {
    onProgress,
    totalDurationSeconds = 0,
  } = options;

  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let stderrData = '';
    let progressBuffer = '';
    let lastReportedPercent = 0;

    ffmpegProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;

      if (typeof onProgress !== 'function' || totalDurationSeconds <= 0) {
        return;
      }

      progressBuffer = `${progressBuffer}${chunk}`.slice(
        -FFMPEG_PROGRESS_BUFFER_MAX_LENGTH,
      );

      const progressSeconds = extractFfmpegProgressSeconds(progressBuffer);
      if (progressSeconds === null) {
        return;
      }

      const rawPercent = Math.max(
        0,
        Math.min(1, progressSeconds / totalDurationSeconds),
      );

      if (rawPercent < 1 && rawPercent <= lastReportedPercent + 0.002) {
        return;
      }

      lastReportedPercent = Math.max(lastReportedPercent, rawPercent);
      onProgress({
        percent: lastReportedPercent,
        currentTimeSeconds: progressSeconds,
        totalDurationSeconds,
      });
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg ${description} exited with code ${code}`);
        console.error(`stderr: ${stderrData.substring(0, 1000)}${stderrData.length > 1000 ? '...' : ''}`);
        reject(new Error(`ffmpeg ${description} failed with code ${code}`));
        return;
      }

      if (
        typeof onProgress === 'function' &&
        totalDurationSeconds > 0 &&
        lastReportedPercent < 1
      ) {
        onProgress({
          percent: 1,
          currentTimeSeconds: totalDurationSeconds,
          totalDurationSeconds,
        });
      }

      resolve();
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`Error spawning ffmpeg for ${description}: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Find blank spaces (gaps) between segments where we can potentially move segments
 * @param {Array} segments - Array of segments with timing information
 * @returns {Array} - Array of blank spaces with start and end times
 */

const renderAlignedAudioTimeline = async (audioSegments, outputPath, options = {}) => {
  const {
    smartOverlapResolution = true,
    format = 'm4a',
    audioBitrate = '96k',
    onProgress,
  } = options;

  let segmentsToProcess = audioSegments;
  let adjustmentStats = null;

  if (smartOverlapResolution && audioSegments.length > 1) {
    if (typeof onProgress === 'function') {
      onProgress({
        progress: 12,
        status: 'loading-durations',
        messageKey: 'alignedDownloadLoadingDurations',
        message: 'Loading audio durations...',
        processedSegments: 0,
        totalSegments: audioSegments.length,
      });
    }
    const result = await analyzeAndAdjustSegments(audioSegments, {
      onProgress: (progressInfo) => {
        if (typeof onProgress !== 'function') {
          return;
        }

        const stageBase =
          progressInfo.stage === 'durations' ? 12 : 42;
        const stageSpan =
          progressInfo.stage === 'durations' ? 28 : 36;

        onProgress({
          progress: Math.min(
            80,
            Math.round(stageBase + stageSpan * (progressInfo.percent || 0)),
          ),
          status:
            progressInfo.stage === 'durations'
              ? 'loading-durations'
              : 'analyzing-overlaps',
          messageKey:
            progressInfo.stage === 'durations'
              ? 'alignedDownloadLoadingDurations'
              : 'alignedDownloadAnalyzingOverlaps',
          message: progressInfo.message,
          processedSegments: progressInfo.completed,
          totalSegments: progressInfo.total,
        });
      },
    });
    segmentsToProcess = result.adjustedSegments;
    adjustmentStats = result.adjustmentStats;
  } else if (audioSegments.length > 0) {
    segmentsToProcess = await enrichSegmentsWithDurations(
      audioSegments,
      (progressInfo) => {
        if (typeof onProgress !== 'function') {
          return;
        }

        onProgress({
          progress: Math.min(
            80,
            Math.round(12 + 68 * (progressInfo.percent || 0)),
          ),
          status: 'loading-durations',
          messageKey: 'alignedDownloadLoadingDurations',
          message: progressInfo.message,
          processedSegments: progressInfo.completed,
          totalSegments: progressInfo.total,
        });
      },
    );
  }

  if (typeof onProgress === 'function') {
    onProgress({
      progress: 82,
      status: 'rendering',
      messageKey: 'alignedDownloadRendering',
      message: 'Rendering aligned audio timeline...',
      processedSegments: audioSegments.length,
      totalSegments: audioSegments.length,
    });
  }

  const finalTimelineDuration = segmentsToProcess.length > 0
    ? Math.max(...segmentsToProcess.map(segment => segment.naturalEnd || (segment.start + segment.actualDuration) || segment.end)) + 0.25
    : 1;

  const tempDir = path.join(TEMP_AUDIO_DIR);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filterScriptPath = path.join(tempDir, `aligned_timeline_${Date.now()}.txt`);
  const filterParts = [];
  const concatInputs = [];
  let currentCursor = 0;
  let silenceIndex = 0;
  let audioIndex = 0;

  const appendGap = (gapDuration) => {
    if (gapDuration <= MIN_GAP_DURATION) {
      return;
    }

    const label = `s${silenceIndex++}`;
    filterParts.push(
      `[0:a]atrim=0:${formatFilterDuration(gapDuration)},asetpts=PTS-STARTPTS[${label}]`
    );
    concatInputs.push(`[${label}]`);
  };

  for (const segment of segmentsToProcess) {
    const segmentStart = Math.max(0, Number(segment.start) || 0);
    const segmentEnd = segment.naturalEnd || (segmentStart + (segment.actualDuration || 0));
    appendGap(segmentStart - currentCursor);

    const label = `a${audioIndex++}`;
    filterParts.push(
      `amovie='${escapeFilterPath(segment.path)}',aresample=${AUDIO_SAMPLE_RATE},aformat=sample_rates=${AUDIO_SAMPLE_RATE}:channel_layouts=${AUDIO_CHANNEL_LAYOUT},volume=1.5,asetpts=PTS-STARTPTS[${label}]`
    );
    concatInputs.push(`[${label}]`);

    currentCursor = Math.max(currentCursor, segmentEnd);
  }

  appendGap(finalTimelineDuration - currentCursor);

  if (concatInputs.length === 0) {
    filterParts.push('[0:a]atrim=0:1,asetpts=PTS-STARTPTS[aout]');
  } else if (concatInputs.length === 1) {
    filterParts.push(`${concatInputs[0]}acopy[aout]`);
  } else {
    filterParts.push(`${concatInputs.join('')}concat=n=${concatInputs.length}:v=0:a=1[aout]`);
  }

  fs.writeFileSync(filterScriptPath, filterParts.join(';\n'));

  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', `anullsrc=channel_layout=${AUDIO_CHANNEL_LAYOUT}:sample_rate=${AUDIO_SAMPLE_RATE}`,
    '-filter_complex_script', filterScriptPath,
    '-map', '[aout]'
  ];

  if (format === 'wav') {
    ffmpegArgs.push(
      '-c:a', 'pcm_s16le',
      '-ar', String(AUDIO_SAMPLE_RATE)
    );
  } else {
    ffmpegArgs.push(
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      '-movflags', '+faststart'
    );
  }

  ffmpegArgs.push(
    '-progress', 'pipe:2',
    '-nostats',
    '-y', outputPath,
  );

  try {
    await runFfmpeg(ffmpegArgs, 'aligned timeline render', {
      totalDurationSeconds: finalTimelineDuration,
      onProgress: (ffmpegProgress) => {
        if (typeof onProgress !== 'function') {
          return;
        }

        onProgress({
          progress: Math.min(
            96,
            Math.round(82 + 14 * (ffmpegProgress.percent || 0)),
          ),
          status: 'rendering',
          messageKey: 'alignedDownloadRendering',
          message: 'Rendering aligned audio timeline...',
          processedSegments: audioSegments.length,
          totalSegments: audioSegments.length,
        });
      },
    });
    if (typeof onProgress === 'function') {
      onProgress({
        progress: 97,
        status: 'finalizing',
        messageKey: 'alignedDownloadFinalizing',
        message: 'Finalizing aligned audio file...',
        processedSegments: audioSegments.length,
        totalSegments: audioSegments.length,
      });
    }
  } finally {
    try {
      if (fs.existsSync(filterScriptPath)) {
        fs.unlinkSync(filterScriptPath);
      }
    } catch (cleanupError) {
      console.error(`Error cleaning up aligned timeline script: ${cleanupError.message}`);
    }
  }

  return {
    outputPath,
    adjustmentStats,
    adjustedSegments: segmentsToProcess,
    totalDuration: finalTimelineDuration
  };
};


module.exports = { runFfmpeg, renderAlignedAudioTimeline };
