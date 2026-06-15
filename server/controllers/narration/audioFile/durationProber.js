/**
 * Media-duration probing for the aligned-audio batch pipeline (split from batchProcessor.js).
 */
const fs = require('fs');
const { spawn } = require('child_process');
const { getFfmpegPath } = require('../../../services/shared/ffmpegUtils');
const { resolveDurationMetadata, toDurationNumber } = require('./mediaMetadata');

const DURATION_PROBE_CONCURRENCY = 8;
const mediaDurationCache = new Map();

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


module.exports = { getMediaDuration, getKnownSegmentDuration, mapWithConcurrency, enrichSegmentsWithDurations, DURATION_PROBE_CONCURRENCY };
