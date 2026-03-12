/**
 * Module for batch processing of audio segments
 * Handles large numbers of audio segments by splitting them into batches
 * Includes smart overlap detection and resolution for natural narration
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { getFfmpegPath } = require('../../../services/shared/ffmpegUtils');
const {
  resolveDurationMetadata,
  toDurationNumber,
} = require('./mediaMetadata');

// Import directory paths
const { TEMP_AUDIO_DIR } = require('../directoryManager');

const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_CHANNEL_LAYOUT = 'stereo';
const DURATION_PROBE_CONCURRENCY = 8;
const FFMPEG_PROGRESS_BUFFER_MAX_LENGTH = 512;
const FFMPEG_TIME_PATTERN = /(?:time|out_time)=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g;
const MAX_VERBOSE_ADJUSTMENT_LOGS = 25;
const MIN_GAP_DURATION = 0.005;

const mediaDurationCache = new Map();

// Simple media duration utility (replacement for removed durationUtils)

function getMediaDuration(mediaPath) {
  const cacheKey = (() => {
    try {
      const stats = fs.statSync(mediaPath);
      return `${mediaPath}:${stats.size}:${stats.mtimeMs}`;
    } catch {
      return mediaPath;
    }
  })();

  if (mediaDurationCache.has(cacheKey)) {
    return mediaDurationCache.get(cacheKey);
  }

  const durationPromise = resolveDurationMetadata(mediaPath, {
    timeoutMs: 10000,
  }).then((metadata) => {
    if (!metadata || typeof metadata.durationSeconds !== 'number') {
      throw new Error('Could not determine duration');
    }

    return metadata.durationSeconds;
  });

  durationPromise.catch(() => {
    mediaDurationCache.delete(cacheKey);
  });

  mediaDurationCache.set(cacheKey, durationPromise);
  return durationPromise;
}

const getKnownSegmentDuration = (segment) =>
  toDurationNumber(
    segment?.actualDuration ??
      segment?.audioDuration ??
      segment?.duration ??
      segment?.metadataDuration,
  );

async function mapWithConcurrency(items, concurrency, mapper, onItemComplete) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      const mappedResult = await mapper(items[currentIndex], currentIndex);
      results[currentIndex] = mappedResult;
      if (typeof onItemComplete === 'function') {
        onItemComplete({
          index: currentIndex,
          item: items[currentIndex],
          result: mappedResult,
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function enrichSegmentsWithDurations(audioSegments, onProgress) {
  let completed = 0;
  const total = audioSegments.length;

  return mapWithConcurrency(
    audioSegments,
    DURATION_PROBE_CONCURRENCY,
    async (segment) => {
      try {
        const knownDuration = getKnownSegmentDuration(segment);
        if (knownDuration !== null) {
          return {
            ...segment,
            actualDuration: knownDuration,
            naturalEnd: segment.start + knownDuration,
          };
        }

        const actualDuration = await getMediaDuration(segment.path);
        return {
          ...segment,
          actualDuration,
          naturalEnd: segment.start + actualDuration
        };
      } catch (error) {
        console.error(`Error getting duration for audio segment ${segment.path}: ${error.message}`);
        const fallbackDuration = Math.max(0, (segment.end || 0) - (segment.start || 0)) || 5;
        return {
          ...segment,
          actualDuration: fallbackDuration,
          naturalEnd: segment.start + fallbackDuration
        };
      }
    },
    ({ index }) => {
      completed += 1;
      if (typeof onProgress === 'function') {
        onProgress({
          stage: 'durations',
          completed,
          total,
          percent: total > 0 ? completed / total : 1,
          message: `Loading audio durations ${completed}/${total}`,
          currentIndex: index,
        });
      }
    },
  );
}

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
const findBlankSpaces = (segments) => {
  const blankSpaces = [];

  // Sort segments by start time
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const currentSegment = sortedSegments[i];
    const nextSegment = sortedSegments[i + 1];

    // Calculate the effective end time (allowing 0.3s overlap at the end)
    const currentEffectiveEnd = currentSegment.naturalEnd - 0.3;

    // Check if there's a gap between current segment's effective end and next segment's start
    if (nextSegment.start > currentEffectiveEnd) {
      const gapStart = currentEffectiveEnd;
      const gapEnd = nextSegment.start;
      const gapDuration = gapEnd - gapStart;

      if (gapDuration > 0.1) { // Only consider gaps larger than 0.1s
        blankSpaces.push({
          start: gapStart,
          end: gapEnd,
          duration: gapDuration,
          afterSegmentId: currentSegment.subtitle_id,
          beforeSegmentId: nextSegment.subtitle_id
        });
      }
    }
  }

  return blankSpaces;
};

/**
 * Calculate distributed shifting across multiple blank spaces with gradual decrease
 * @param {Array} segmentsToShift - The segments that need to be shifted (current and following)
 * @param {Array} blankSpaces - Available blank spaces to the left
 * @param {number} requiredShift - How much shift is needed to avoid overlap
 * @returns {Object} - Object with distributed shift amounts and strategy info
 */
const calculateDistributedGroupShift = (segmentsToShift, blankSpaces, requiredShift) => {
  if (blankSpaces.length === 0) {
    return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
  }

  // Find up to 5 blank spaces to the left, sorted by distance from the first segment (nearest first)
  const usableBlankSpaces = blankSpaces
    .filter(space => space.end <= segmentsToShift[0].start)
    .map(space => ({
      ...space,
      distanceFromSegment: segmentsToShift[0].start - space.end,
      maxUsableSpace: Math.min(space.duration - 0.1, segmentsToShift[0].start - space.start)
    }))
    .sort((a, b) => a.distanceFromSegment - b.distanceFromSegment) // Nearest first
    .slice(0, 5); // Take up to 5 blank spaces

  if (usableBlankSpaces.length === 0) {
    return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
  }

  // Calculate total available space across all usable blank spaces
  const totalAvailableSpace = usableBlankSpaces.reduce((sum, space) => sum + space.maxUsableSpace, 0);

  if (totalAvailableSpace < 0.1) {
    return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
  }

  // Calculate how much we can actually shift (limited by available space and required shift)
  const actualShiftAmount = Math.min(requiredShift, totalAvailableSpace);

  // Distribute the shift across blank spaces with gradual decrease (giảm dần)
  // Nearest space gets the most shift, furthest gets the least
  const distributedShifts = [];
  let remainingShift = actualShiftAmount;

  // Create a decreasing weight system: nearest = 1.0, next = 0.8, next = 0.6, etc.
  const weights = usableBlankSpaces.map((_, index) => Math.max(0.2, 1.0 - (index * 0.2)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  for (let i = 0; i < usableBlankSpaces.length && remainingShift > 0.05; i++) {
    const space = usableBlankSpaces[i];
    const weight = weights[i];

    // Calculate this space's share of the total shift (proportional to weight)
    const proposedShift = (actualShiftAmount * weight) / totalWeight;

    // Limit by space availability and remaining shift
    const actualSpaceShift = Math.min(
      proposedShift,
      space.maxUsableSpace,
      remainingShift
    );

    if (actualSpaceShift > 0.05) { // Only use shifts larger than 0.05s
      distributedShifts.push({
        blankSpace: space,
        shiftAmount: actualSpaceShift,
        weight: weight,
        segmentRange: i === 0 ? 'all' : `from-${i}`
      });
      remainingShift -= actualSpaceShift;
    }
  }

  const totalShiftAchieved = distributedShifts.reduce((sum, shift) => sum + shift.shiftAmount, 0);

  if (totalShiftAchieved > 0.1) {
    return {
      totalShiftAmount: totalShiftAchieved,
      strategy: `distributed-shift-across-${distributedShifts.length}-spaces`,
      canUseBlankSpaces: true,
      distributedShifts: distributedShifts,
      totalAvailableSpace: totalAvailableSpace
    };
  }

  return { totalShiftAmount: 0, strategy: 'push-right', canUseBlankSpaces: false, distributedShifts: [] };
};

/**
 * Analyze audio segments and adjust their timing to avoid overlaps
 * This creates a more natural narration by ensuring segments don't talk over each other
 *
 * Improvements:
 * 1. Allows 0.3s overlap at the end of each segment (more natural)
 * 2. When large adjustments (>0.5s) are needed, tries to find blank spaces to the left
 *    to move segments into, reducing the overall audio length
 *
 * @param {Array} audioSegments - Array of audio segments to analyze
 * @returns {Promise<Array>} - Array of adjusted audio segments
 */
const analyzeAndAdjustSegments = async (audioSegments, options = {}) => {
  const { onProgress } = options;
  if (!audioSegments || audioSegments.length <= 1) {
    return audioSegments; // No adjustment needed for 0 or 1 segments
  }

  console.log(`Analyzing ${audioSegments.length} audio segments for smart overlap resolution...`);

  // Sort segments by start time (should already be sorted, but ensure it)
  audioSegments.sort((a, b) => a.start - b.start);

  // First pass: get actual durations in parallel
  const segmentsWithDuration = await enrichSegmentsWithDurations(
    audioSegments,
    onProgress,
  );

  // Second pass: Detect and resolve overlaps naturally (like in Premiere Pro)
  const adjustedSegments = [];
  let detailedLogs = 0;
  let suppressedLogs = 0;

  const logAdjustmentDetail = (...args) => {
    if (detailedLogs < MAX_VERBOSE_ADJUSTMENT_LOGS) {
      console.log(...args);
      detailedLogs += 1;
    } else {
      suppressedLogs += 1;
    }
  };

  for (let i = 0; i < segmentsWithDuration.length; i++) {
    const segment = segmentsWithDuration[i];

    if (i === 0) {
      // First segment doesn't need adjustment
      adjustedSegments.push(segment);
      continue;
    }

    const previousSegment = adjustedSegments[i - 1];

    // Check if this segment would overlap with the previous one
    // Allow 0.3s overlap at the end of the previous segment
    const previousEffectiveEnd = previousSegment.naturalEnd - 0.3;
    const wouldOverlap = segment.start < previousEffectiveEnd;

    if (wouldOverlap) {
      // Calculate how much overlap would occur
      const overlapAmount = previousEffectiveEnd - segment.start;

      // Log the overlap detection
      const prevIsGrouped = previousSegment.isGrouped ? ` (grouped with ${previousSegment.original_ids?.length || 0} original IDs)` : '';
      const currIsGrouped = segment.isGrouped ? ` (grouped with ${segment.original_ids?.length || 0} original IDs)` : '';

      logAdjustmentDetail(`Detected overlap of ${overlapAmount.toFixed(2)}s between segments:
        - Previous: ID ${previousSegment.subtitle_id}${prevIsGrouped}, Start: ${previousSegment.start.toFixed(2)}, Effective End: ${previousEffectiveEnd.toFixed(2)}
        - Current: ID ${segment.subtitle_id}${currIsGrouped}, Start: ${segment.start.toFixed(2)}, End: ${segment.end.toFixed(2)}`);

      // Calculate the basic adjustment (push to the right)
      const basicAdjustedStart = previousEffectiveEnd + 0.1;
      const basicShiftAmount = basicAdjustedStart - segment.start;

      let finalAdjustedStart = basicAdjustedStart;
      let finalShiftAmount = basicShiftAmount;
      let adjustmentStrategy = 'push-right';

      // If the adjustment is significant (>0.5s), try to shift THIS segment left into blank spaces
      if (basicShiftAmount > 0.5) {
        logAdjustmentDetail(`Adjustment needed (${basicShiftAmount.toFixed(2)}s), looking for blank spaces to minimize duration extension...`);

        // Find all blank spaces in the current adjusted segments
        const blankSpaces = findBlankSpaces(adjustedSegments);

        if (blankSpaces.length > 0) {
          logAdjustmentDetail(`Found ${blankSpaces.length} blank spaces:`,
            blankSpaces.map(space => `${space.duration.toFixed(2)}s gap after segment ${space.afterSegmentId}`));

          // Calculate distributed shift for this segment across multiple blank spaces
          const distributedShiftResult = calculateDistributedGroupShift([segment], blankSpaces, basicShiftAmount);

          if (distributedShiftResult.canUseBlankSpaces && distributedShiftResult.totalShiftAmount > 0) {
            // Apply the distributed shift to reduce the rightward push
            const totalLeftShift = Math.min(distributedShiftResult.totalShiftAmount, basicShiftAmount);

            logAdjustmentDetail(`Using distributed shift across ${distributedShiftResult.distributedShifts.length} blank spaces`);
            
            // Reduce the rightward push by the amount we can shift left
            finalAdjustedStart = basicAdjustedStart - totalLeftShift;
            const maxAllowedOverlapStart = previousSegment.naturalEnd - 0.3;
            if (finalAdjustedStart < maxAllowedOverlapStart) {
              finalAdjustedStart = maxAllowedOverlapStart;
            }
            finalShiftAmount = finalAdjustedStart - segment.start;
            adjustmentStrategy = `hybrid-shift-${distributedShiftResult.distributedShifts.length}-spaces`;
            
            logAdjustmentDetail(`Net adjustment: ${finalShiftAmount.toFixed(2)}s for segment ${segment.subtitle_id}`);
          } else {
            // No usable blank spaces, accept the full rightward push
            logAdjustmentDetail(`No usable blank spaces. Accepting full rightward push of ${basicShiftAmount.toFixed(2)}s`);
          }
        } else {
          logAdjustmentDetail(`No blank spaces found. Accepting full rightward push of ${basicShiftAmount.toFixed(2)}s`);
        }
      }

      // Create adjusted segment
      const adjustedSegment = {
        ...segment,
        start: finalAdjustedStart,
        // Update the natural end based on the new start time
        naturalEnd: finalAdjustedStart + segment.actualDuration,
        // Keep track of the original timing for reference
        originalStart: segment.start,
        // Note how much we shifted this segment
        shiftAmount: finalShiftAmount,
        adjustmentStrategy
      };

      // Log the adjustment
      const direction = finalShiftAmount > 0 ? 'right' : 'left';
      logAdjustmentDetail(`Adjusted segment ${segment.subtitle_id}: ${adjustmentStrategy}, shifted by ${Math.abs(finalShiftAmount).toFixed(2)}s ${direction} to start at ${finalAdjustedStart.toFixed(2)}s`);

      adjustedSegments.push(adjustedSegment);
    } else {
      // No overlap detected, add segment as-is
      adjustedSegments.push(segment);
    }

    if (typeof onProgress === 'function') {
      onProgress({
        stage: 'overlaps',
        completed: i + 1,
        total: segmentsWithDuration.length,
        percent:
          segmentsWithDuration.length > 0
            ? (i + 1) / segmentsWithDuration.length
            : 1,
        message: `Analyzing overlap ${i + 1}/${segmentsWithDuration.length}`,
        currentIndex: i,
      });
    }
  }

  // Log summary of adjustments and calculate statistics
  const adjustedCount = adjustedSegments.filter(s => s.shiftAmount).length;
  const leftMoves = adjustedSegments.filter(s => s.shiftAmount && s.shiftAmount < 0).length;
  const rightMoves = adjustedSegments.filter(s => s.shiftAmount && s.shiftAmount > 0).length;

  // Find the segment with the maximum adjustment (rightward push)
  let maxAdjustmentSegment = null;
  let maxAdjustmentAmount = 0;

  adjustedSegments.forEach(segment => {
    if (segment.shiftAmount && segment.shiftAmount > maxAdjustmentAmount) {
      maxAdjustmentAmount = segment.shiftAmount;
      maxAdjustmentSegment = {
        segmentId: segment.subtitle_id,
        adjustmentAmount: segment.shiftAmount,
        strategy: segment.adjustmentStrategy
      };
    }
  });

  // Skip the final 0.5s earlier adjustment to avoid creating new overlaps
  // Since we're strictly avoiding overlaps, we don't want to risk creating new ones
  console.log(`Skipping final timing adjustment to maintain strict overlap prevention.`);
  const finalAdjustedSegments = adjustedSegments;

  if (adjustedCount > 0) {
    console.log(`Smart overlap resolution complete: Adjusted ${adjustedCount} of ${audioSegments.length} segments (${leftMoves} moved left, ${rightMoves} moved right) for optimized narration flow.`);
    if (maxAdjustmentSegment) {
      console.log(`Maximum adjustment: Segment ${maxAdjustmentSegment.segmentId} pushed ${maxAdjustmentSegment.adjustmentAmount.toFixed(2)}s right via ${maxAdjustmentSegment.strategy}`);
    }
    if (suppressedLogs > 0) {
      console.log(`Suppressed ${suppressedLogs} verbose overlap-resolution log lines.`);
    }
    
    // Calculate total duration extension
    const originalLastEnd = audioSegments[audioSegments.length - 1].end;
    const adjustedLastEnd = finalAdjustedSegments[finalAdjustedSegments.length - 1].naturalEnd;
    const durationExtension = adjustedLastEnd - originalLastEnd;
    if (durationExtension > 0) {
      console.log(`  - Total duration extended by ${durationExtension.toFixed(2)}s to prevent overlaps`);
    }
  } else {
    console.log(`No overlaps detected among ${audioSegments.length} segments. No adjustments needed.`);
  }
  
  // Verify overlaps don't exceed the allowed 0.3s
  let hasExcessiveOverlaps = false;
  let allowedOverlapCount = 0;
  for (let i = 1; i < finalAdjustedSegments.length; i++) {
    const prev = finalAdjustedSegments[i - 1];
    const curr = finalAdjustedSegments[i];
    const overlapAmount = prev.naturalEnd - curr.start;
    
    if (overlapAmount > 0.3) {
      // This is more than the allowed 0.3s overlap
      hasExcessiveOverlaps = true;
      console.error(`ERROR: Excessive overlap detected between segments ${prev.subtitle_id} and ${curr.subtitle_id}`);
      console.error(`  Overlap: ${overlapAmount.toFixed(2)}s (max allowed: 0.3s)`);
      console.error(`  Previous ends at ${prev.naturalEnd.toFixed(2)}s, Current starts at ${curr.start.toFixed(2)}s`);
    } else if (overlapAmount > 0) {
      // This is within the allowed 0.3s overlap
      allowedOverlapCount++;
    }
  }
  
  if (!hasExcessiveOverlaps) {
    console.log(`✅ Verification complete: All overlaps within allowed 0.3s threshold.`);
    if (allowedOverlapCount > 0) {
      console.log(`  - ${allowedOverlapCount} segments have natural overlaps (≤0.3s) for smooth transitions`);
    }
  } else {
    console.error(`❌ Some segments have excessive overlaps exceeding the 0.3s threshold!`);
  }

  // Return both adjusted segments and adjustment statistics
  return {
    adjustedSegments: finalAdjustedSegments,
    adjustmentStats: {
      adjustedCount,
      leftMoves,
      rightMoves,
      maxAdjustment: maxAdjustmentSegment
    }
  };
};

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

/**
 * Process a batch of audio segments to create an intermediate audio file
 * Includes smart overlap detection and resolution for natural narration
 *
 * @param {Array} audioSegments - Array of audio segments to process
 * @param {string} outputPath - Path to save the output file
 * @param {number} batchIndex - Index of the current batch
 * @param {number} totalDuration - Total duration of the audio
 * @param {boolean} [smartOverlapResolution=true] - Whether to use smart overlap resolution
 * @returns {Promise<string>} - Path to the created audio file
 */
const processBatch = async (audioSegments, outputPath, batchIndex, totalDuration, smartOverlapResolution = true) => {

  // Apply smart overlap resolution if enabled
  let segmentsToProcess = audioSegments;
  let adjustmentStats = null;
  if (smartOverlapResolution && audioSegments.length > 1) {
    try {
      // Analyze and adjust segments to avoid overlaps
      const result = await analyzeAndAdjustSegments(audioSegments);
      segmentsToProcess = result.adjustedSegments;
      adjustmentStats = result.adjustmentStats;
    } catch (error) {
      console.error(`Error during smart overlap resolution: ${error.message}`);
      console.error('Falling back to original segments without overlap resolution');
      segmentsToProcess = audioSegments;
    }
  }

  // Create a temporary directory for the filter complex file
  const tempDir = path.join(TEMP_AUDIO_DIR);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Create a filter complex for precise audio placement
  let filterComplex = '';
  let amixInputs = []; // Will hold the names of the delayed streams like [a0], [a1], ...

  // Process each audio segment for the filter complex
  segmentsToProcess.forEach((segment, index) => {
    // Calculate delay in milliseconds for the current segment
    const delayMs = Math.round(segment.start * 1000);

    // Log the delay being applied for each segment with enhanced information
    let adjustmentInfo = '';
    if (segment.shiftAmount) {
      const direction = segment.shiftAmount > 0 ? 'right' : 'left';
      const strategy = segment.adjustmentStrategy || 'push-right';
      adjustmentInfo = ` (adjusted ${Math.abs(segment.shiftAmount).toFixed(2)}s ${direction} via ${strategy})`;
    }

    // Add final timing adjustment info
    let finalTimingInfo = '';
    if (segment.finalTimingAdjustment) {
      finalTimingInfo = ` + ${segment.finalTimingAdjustment.toFixed(2)}s earlier`;
    }

    const isGrouped = segment.isGrouped ? ` (grouped subtitle with ${segment.original_ids?.length || 0} original IDs)` : '';
    console.log(`[SERVER] Segment ${segment.subtitle_id}: Applying delay of ${delayMs}ms${adjustmentInfo}${finalTimingInfo}${isGrouped}`);

    // Use `index + 1` because input [0] is anullsrc
    const inputIndex = index + 1;
    const delayedStreamName = `a${index}`; // Name for the output stream of this filter chain part

    // Apply resampling (safety), delay, and volume to the correct input stream
    // Output this processed stream as [a<index>] (e.g., [a0], [a1], ...)
    // Use a moderate volume boost (1.5) as we'll preserve full volume during mixing
    filterComplex += `[${inputIndex}]aresample=44100,adelay=${delayMs}|${delayMs},volume=1.5[${delayedStreamName}]; `;
    amixInputs.push(`[${delayedStreamName}]`); // Add the delayed stream name to the list for amix
  });

  // Combine all delayed audio streams
  if (segmentsToProcess.length > 0) {
    if (segmentsToProcess.length === 1) {
      // If there's only one segment, just map it directly to output
      filterComplex += `${amixInputs[0]}asetpts=PTS-STARTPTS[aout]`;
    } else {
      // For multiple segments, use amix with appropriate settings
      // normalize=0 maintains full volume (important since we're preventing overlaps anyway)
      // dropout_transition=2 provides smooth transitions if any micro-overlaps occur
      filterComplex += `${amixInputs.join('')}amix=inputs=${segmentsToProcess.length}:dropout_transition=2:normalize=0[aout]`;
    }
  } else {
    // If there are no audio segments, the output is just the silent track
    filterComplex = '[0:a]acopy[aout]'; // Map the anullsrc input directly
  }

  // Create a temporary file for the filter complex to avoid command line length limitations
  const timestamp = Date.now();
  const filterComplexFilename = `filter_complex_batch${batchIndex}_${timestamp}.txt`;
  const filterComplexPath = path.join(tempDir, filterComplexFilename);

  // Write the filter complex to a file
  fs.writeFileSync(filterComplexPath, filterComplex);


  // Build the ffmpeg command arguments as an array
  // Input [0] is the silent anullsrc base track.
  // Inputs [1], [2], ... are the actual audio files.

  // Start with the base arguments
  const ffmpegArgs = [
    '-f', 'lavfi',
    '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${totalDuration}`
  ];

  // Add each audio file as an input
  segmentsToProcess.forEach(segment => {
    ffmpegArgs.push('-i', segment.path);
  });

  // Add the filter complex script and output options
  ffmpegArgs.push(
    '-filter_complex_script', filterComplexPath,
    '-map', '[aout]',
    '-c:a', 'pcm_s16le',
    '-ar', '44100',
    '-y',
    outputPath
  );



  // Execute the ffmpeg command using spawn
  await new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let stdoutData = '';
    let stderrData = '';

    ffmpegProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      // Log progress indicators
      if (chunk.includes('size=')) {
        process.stdout.write('.');
      }
    });

    ffmpegProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      // Log progress indicators
      if (chunk.includes('size=')) {
        process.stdout.write('.');
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg process exited with code ${code}`);
        console.error(`stderr: ${stderrData.substring(0, 500)}${stderrData.length > 500 ? '...' : ''}`);
        reject(new Error(`ffmpeg process failed with code ${code}`));
        return;
      }

      // Log only snippets of potentially long stdout/stderr



      // Clean up the filter complex file
      try {
        if (fs.existsSync(filterComplexPath)) {
          fs.unlinkSync(filterComplexPath);

        }
      } catch (cleanupError) {
        console.error(`Error cleaning up filter complex file: ${cleanupError.message}`);
      }

      resolve(outputPath);
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`Error spawning ffmpeg process: ${err.message}`);
      reject(err);
    });
  });

  return { outputPath, adjustmentStats };
};

/**
 * Concatenate multiple audio files into a single file
 *
 * @param {Array<string>} inputFiles - Array of input file paths
 * @param {string} outputPath - Path to save the concatenated file
 * @returns {Promise<string>} - Path to the concatenated file
 */
const concatenateAudioFiles = async (inputFiles, outputPath) => {


  // Create a temporary file list for ffmpeg
  const tempDir = path.join(TEMP_AUDIO_DIR);
  const timestamp = Date.now();
  const fileListPath = path.join(tempDir, `concat_list_${timestamp}.txt`);

  // Write the file list
  const fileListContent = inputFiles.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(fileListPath, fileListContent);

  // Build the ffmpeg command arguments
  const ffmpegArgs = [
    '-f', 'concat',
    '-safe', '0',
    '-i', fileListPath,
    '-c', 'copy',
    '-y',
    outputPath
  ];

  // Execute the ffmpeg command
  await new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let stdoutData = '';
    let stderrData = '';

    ffmpegProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    ffmpegProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg concat process exited with code ${code}`);
        console.error(`stderr: ${stderrData}`);
        reject(new Error(`ffmpeg concat process failed with code ${code}`));
        return;
      }



      // Clean up the file list
      try {
        if (fs.existsSync(fileListPath)) {
          fs.unlinkSync(fileListPath);

        }
      } catch (cleanupError) {
        console.error(`Error cleaning up file list: ${cleanupError.message}`);
      }

      resolve(outputPath);
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`Error spawning ffmpeg concat process: ${err.message}`);
      reject(err);
    });
  });

  return outputPath;
};

module.exports = {
  processBatch,
  concatenateAudioFiles,
  analyzeAndAdjustSegments,
  getMediaDuration,
  renderAlignedAudioTimeline
};
