/**
 * Service for managing aligned narration preview playback.
 *
 * Preview mode uses a timing plan plus the original clip files for low-latency
 * local playback. File mode is still supported for existing merged-audio flows.
 *
 * The Web-Audio timeline engine and the <audio> file-mode lifecycle live in
 * ./alignedNarration/*; the shared cache state lives in
 * ./alignedNarration/cacheState. This module keeps the public API plus the pure
 * plan/payload helpers.
 */
import i18n from "../i18n/i18n";
import { SERVER_URL } from "../config";
import { hydrateNarrationResultsForAlignment } from "../utils/narrationAlignmentUtils";
import {
  emptyAlignedNarrationCache,
  getCurrentCache,
  getLocalCache,
  resolveServerUrl,
  revokeObjectUrlIfNeeded,
  setAlignedNarrationCache,
  syncWindowState,
} from "./alignedNarration/cacheState";
import {
  getTimelineCurrentTime,
  prewarmTimelineWindow,
  resetTimelinePlayback,
  startTimelinePlayback,
  stopTimelinePlayback,
  timelinePlayback,
  TIMELINE_RESYNC_THRESHOLD,
} from "./alignedNarration/timelinePlaybackEngine";
import {
  ensureFileAudioElement,
  playFileModeNarration,
  resetFileAudioElement,
} from "./alignedNarration/fileAudioElement";

const PREVIEW_PLAN_URL = `${SERVER_URL}/api/narration/preview-aligned`;

const createSubtitleTimestampMap = (narrationData) => {
  const timestamps = {};

  narrationData.forEach((item) => {
    timestamps[item.subtitle_id] = {
      start: item.start,
      end: item.end,
    };
  });

  return timestamps;
};

const haveSubtitleTimestampsChanged = (newSubtitleTimestamps, cache) => {
  const oldSubtitleTimestamps = cache?.subtitleTimestamps || {};
  const newIds = Object.keys(newSubtitleTimestamps);
  const oldIds = Object.keys(oldSubtitleTimestamps);

  if (newIds.length !== oldIds.length) {
    return true;
  }

  return newIds.some((id) => {
    const oldItem = oldSubtitleTimestamps[id];
    const newItem = newSubtitleTimestamps[id];

    return (
      !oldItem || oldItem.start !== newItem.start || oldItem.end !== newItem.end
    );
  });
};

const normalizePreviewPlan = (items = []) => {
  return items
    .filter((item) => item && typeof item.start === "number" && item.url)
    .map((item, index) => ({
      ...item,
      id: item.id || `${item.subtitle_id || "segment"}_${index}`,
      url: resolveServerUrl(item.url),
      actualDuration:
        typeof item.actualDuration === "number"
          ? item.actualDuration
          : Math.max(0, (item.naturalEnd || 0) - item.start),
      naturalEnd:
        typeof item.naturalEnd === "number"
          ? item.naturalEnd
          : item.start + (item.actualDuration || 0),
    }))
    .sort((a, b) => a.start - b.start);
};

const buildNarrationPayload = (generationResults) => {
  const narrationData = hydrateNarrationResultsForAlignment(generationResults)
    .filter((result) => result.success && (result.filename || result.audioData))
    .map((result) => {
      const start = typeof result.start === "number" ? result.start : 0;
      const end = typeof result.end === "number" ? result.end : start + 5;

      const narration = {
        subtitle_id: result.subtitle_id,
        start,
        end,
        text: result.text || "",
      };

      if (result.filename) {
        narration.filename = result.filename;
      }

      if (result.audioData) {
        narration.audioData = result.audioData;
        narration.mimeType = result.mimeType;
        narration.sampleRate = result.sampleRate;
      }

      if (typeof result.actualDuration === "number") {
        narration.actualDuration = result.actualDuration;
      } else if (typeof result.audioDuration === "number") {
        narration.audioDuration = result.audioDuration;
      }

      if (result.original_ids) {
        narration.original_ids = result.original_ids;
      }

      if (result.forceRegenerate) {
        narration.forceRegenerate = true;
      }

      if (result.retriedAt) {
        narration.retriedAt = result.retriedAt;
      }

      return narration;
    });

  narrationData.sort((a, b) => a.start - b.start);

  return {
    narrationData,
    subtitleTimestamps: createSubtitleTimestampMap(narrationData),
  };
};

const shouldReusePreviewPlan = (narrationData, subtitleTimestamps) => {
  const cache = getCurrentCache();
  if (!cache.previewPlan || !cache.previewPlan.length) {
    return false;
  }

  if (haveSubtitleTimestampsChanged(subtitleTimestamps, cache)) {
    return false;
  }

  return !narrationData.some(
    (item) =>
      item.forceRegenerate === true ||
      (item.retriedAt &&
        (!cache.timestamp || item.retriedAt > cache.timestamp)),
  );
};

const applyPreviewPlanToCache = (previewPlan, subtitleTimestamps) => {
  revokeObjectUrlIfNeeded(getLocalCache().url);
  resetFileAudioElement();
  resetTimelinePlayback();

  timelinePlayback.plan = previewPlan;
  prewarmTimelineWindow(0);

  setAlignedNarrationCache({
    blob: null,
    url: null,
    filename: null,
    mode: "timeline",
    previewPlan,
    timestamp: Date.now(),
    subtitleTimestamps,
  });
};

export const prepareAlignedNarrationPreview = async (
  narrationData,
  onProgress = null,
  subtitleTimestamps = createSubtitleTimestampMap(narrationData),
) => {
  if (!Array.isArray(narrationData) || narrationData.length === 0) {
    const errorMessage = i18n.t(
      "errors.noNarrationResults",
      "No narration results to generate aligned audio",
    );
    console.error(errorMessage);
    return null;
  }

  if (shouldReusePreviewPlan(narrationData, subtitleTimestamps)) {
    if (onProgress) {
      onProgress({
        status: "complete",
        message: "Using cached aligned narration",
      });
    }
    return getCurrentCache().previewPlan;
  }

  if (onProgress) {
    onProgress({
      status: "generating",
      message: "Preparing aligned narration preview...",
    });
  }

  const response = await fetch(PREVIEW_PLAN_URL, {
    method: "POST",
    mode: "cors",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ narrations: narrationData }),
  });

  if (response.ok) {
    const { checkAudioAlignmentFromResponse } =
      await import("../utils/audioAlignmentNotification.js");
    checkAudioAlignmentFromResponse(response);
  }

  if (!response.ok) {
    let errorMessage = `Failed to prepare aligned narration preview: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMessage =
        errorJson.details?.message || errorJson.error || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const responseJson = await response.json();
  const previewPlan = normalizePreviewPlan(responseJson.items);
  if (!previewPlan.length) {
    throw new Error(
      "Aligned narration preview plan did not include any playable clips",
    );
  }

  applyPreviewPlanToCache(previewPlan, subtitleTimestamps);

  if (onProgress) {
    onProgress({ status: "complete", message: "Aligned narration ready" });
  }

  return previewPlan;
};

/**
 * Generate aligned narration preview and store it in cache.
 * Returns a symbolic URL-like string for compatibility with existing callers.
 */
export const generateAlignedNarration = async (
  generationResults,
  onProgress = null,
) => {
  if (!generationResults || generationResults.length === 0) {
    const errorMessage = i18n.t(
      "errors.noNarrationResults",
      "No narration results to generate aligned audio",
    );
    console.error(errorMessage);
    return null;
  }

  try {
    if (onProgress) {
      onProgress({
        status: "preparing",
        message: "Preparing aligned narration...",
      });
    }

    const { narrationData, subtitleTimestamps } =
      buildNarrationPayload(generationResults);
    if (!narrationData.length) {
      throw new Error(
        i18n.t(
          "errors.noNarrationResults",
          "No narration results to generate aligned audio",
        ),
      );
    }

    await prepareAlignedNarrationPreview(
      narrationData,
      onProgress,
      subtitleTimestamps,
    );
    return "aligned-preview://timeline";
  } catch (error) {
    console.error("Error generating aligned narration:", error);
    if (onProgress) {
      onProgress({ status: "error", message: `Error: ${error.message}` });
    }
    return null;
  }
};

/**
 * Get the aligned narration audio element for file-mode playback only.
 */
export const getAlignedAudioElement = () => {
  const cache = getCurrentCache();
  if (cache.previewPlan?.length) {
    return null;
  }

  return ensureFileAudioElement();
};

export const playAlignedNarration = (currentTime, isPlaying) => {
  const cache = getCurrentCache();
  const previewPlan = cache.previewPlan;

  if (Array.isArray(previewPlan) && previewPlan.length > 0) {
    timelinePlayback.plan = previewPlan;

    if (!isPlaying) {
      stopTimelinePlayback(currentTime);
      return true;
    }

    const timelineDrift = Math.abs(currentTime - getTimelineCurrentTime());
    const playbackRateChanged = false;
    const shouldResync =
      !timelinePlayback.isPlaying ||
      timelineDrift > TIMELINE_RESYNC_THRESHOLD ||
      playbackRateChanged;

    if (shouldResync) {
      startTimelinePlayback(currentTime, timelinePlayback.playbackRate).catch(
        (error) => {
          console.error(
            "Error starting aligned narration preview playback:",
            error,
          );
        },
      );
    }

    return true;
  }

  return playFileModeNarration(currentTime, isPlaying);
};

export const setAlignedNarrationPlaybackRate = (
  playbackRate,
  currentTime = null,
) => {
  const safePlaybackRate = Math.max(0.1, Number(playbackRate) || 1);
  timelinePlayback.playbackRate = safePlaybackRate;

  const cache = getCurrentCache();
  if (cache.previewPlan?.length) {
    if (timelinePlayback.isPlaying) {
      const resumeTime =
        typeof currentTime === "number"
          ? currentTime
          : getTimelineCurrentTime();
      startTimelinePlayback(resumeTime, safePlaybackRate).catch((error) => {
        console.error(
          "Error resyncing aligned narration preview after rate change:",
          error,
        );
      });
    }
    return;
  }

  const audio = ensureFileAudioElement();
  if (audio) {
    audio.playbackRate = safePlaybackRate;
  }
};

export const setAlignedNarrationVolume = (volume) => {
  const safeVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  timelinePlayback.volume = safeVolume;

  if (timelinePlayback.masterGainNode) {
    timelinePlayback.masterGainNode.gain.value = safeVolume;
  }

  const audio = ensureFileAudioElement();
  if (audio) {
    audio.volume = safeVolume;
  }
};

export const resetAlignedAudioElement = () => {
  stopTimelinePlayback();
  resetFileAudioElement();
};

export const resetAlignedNarration = () => {
  stopTimelinePlayback();
  resetFileAudioElement();
  revokeObjectUrlIfNeeded(getLocalCache().url);

  resetTimelinePlayback({ clearBuffers: true });
  timelinePlayback.plan = null;

  setAlignedNarrationCache(emptyAlignedNarrationCache());
};

window.resetAlignedNarration = resetAlignedNarration;

window.addEventListener("subtitle-timing-changed", () => {
  resetAlignedNarration();
});

export const cleanupAlignedNarration = (
  preserveAudioElement = true,
  preserveCache = true,
) => {
  if (!preserveAudioElement) {
    stopTimelinePlayback();
    resetFileAudioElement();
  }

  if (!preserveCache) {
    revokeObjectUrlIfNeeded(getLocalCache().url);
    resetTimelinePlayback({ clearBuffers: true });
    timelinePlayback.plan = null;
    setAlignedNarrationCache(emptyAlignedNarrationCache());
  }
};

export const isAlignedNarrationAvailable = () => {
  const cache = getCurrentCache();
  return !!(cache.url || (cache.previewPlan && cache.previewPlan.length > 0));
};

export const getAlignedNarrationUrl = () => {
  return getCurrentCache().url;
};

syncWindowState();
