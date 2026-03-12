/**
 * Service for managing aligned narration preview playback.
 *
 * Preview mode uses a timing plan plus the original clip files for low-latency
 * local playback. File mode is still supported for existing merged-audio flows.
 */
import { SERVER_URL } from "../config";
import i18n from "../i18n/i18n";
import { hydrateNarrationResultsForAlignment } from "../utils/narrationAlignmentUtils";

const PREVIEW_PLAN_URL = `${SERVER_URL}/api/narration/preview-aligned`;
const TIMELINE_PREROLL_SEC = 0.03;
const TIMELINE_LOOKAHEAD_WALL_SEC = 2.0;
const TIMELINE_RESYNC_THRESHOLD_SEC = 0.12;
const TIMELINE_END_GUARD_SEC = 0.01;
const TIMELINE_RAMP_SEC = 0.005;
const TIMELINE_SCHEDULER_INTERVAL_MS = 100;
const TIMELINE_PRELOAD_COUNT = 8;

const emptyAlignedNarrationCache = () => ({
  blob: null,
  url: null,
  filename: null,
  mode: null,
  previewPlan: null,
  timestamp: null,
  subtitleTimestamps: {},
});

const revokeObjectUrlIfNeeded = (url) => {
  if (typeof url === "string" && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Error revoking object URL:", error);
    }
  }
};

const resolveServerUrl = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${SERVER_URL}${url}`;
};

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

let alignedNarrationCache = emptyAlignedNarrationCache();
let alignedAudioElement = null;

const timelinePlayback = {
  audioContext: null,
  masterGainNode: null,
  activeClips: new Map(),
  decodedBuffers: new Map(),
  schedulerId: null,
  plan: null,
  isPlaying: false,
  anchorVideoTime: 0,
  anchorContextTime: 0,
  playbackRate: 1,
  volume: 1,
  scheduleToken: 0,
};

const syncWindowState = () => {
  window.alignedNarrationCache = alignedNarrationCache;
  window.isAlignedNarrationAvailable = !!(
    alignedNarrationCache.url ||
    (alignedNarrationCache.previewPlan &&
      alignedNarrationCache.previewPlan.length > 0)
  );
  window.alignedAudioElement = alignedAudioElement;
};

const setAlignedNarrationCache = (nextCache) => {
  alignedNarrationCache = nextCache;
  syncWindowState();
};

const getCurrentCache = () =>
  window.alignedNarrationCache || alignedNarrationCache;

const supportsTimelinePreview = () => {
  return (
    typeof window !== "undefined" &&
    !!(window.AudioContext || window.webkitAudioContext)
  );
};

const resetFileAudioElement = (clearSource = true) => {
  if (!alignedAudioElement) {
    return;
  }

  try {
    alignedAudioElement.pause();
    if (clearSource) {
      alignedAudioElement.src = "";
      alignedAudioElement.load();
    }
  } catch (error) {
    console.warn("Error resetting aligned audio element:", error);
  }

  alignedAudioElement = null;
  syncWindowState();
};

const ensureFileAudioElement = () => {
  const cache = getCurrentCache();
  if (!cache.url) {
    return null;
  }

  if (!alignedAudioElement) {
    alignedAudioElement = new Audio();
    alignedAudioElement.preload = "auto";
    alignedAudioElement.crossOrigin = "anonymous";
  }

  if (alignedAudioElement.src !== cache.url) {
    alignedAudioElement.pause();
    alignedAudioElement.src = cache.url;
    alignedAudioElement.load();
  }

  alignedAudioElement.volume = timelinePlayback.volume;
  window.alignedAudioElement = alignedAudioElement;
  return alignedAudioElement;
};

const ensureTimelineAudioContext = async () => {
  if (!supportsTimelinePreview()) {
    return null;
  }

  if (!timelinePlayback.audioContext) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    timelinePlayback.audioContext = new AudioContextCtor();
  }

  if (!timelinePlayback.masterGainNode) {
    timelinePlayback.masterGainNode =
      timelinePlayback.audioContext.createGain();
    timelinePlayback.masterGainNode.gain.value = timelinePlayback.volume;
    timelinePlayback.masterGainNode.connect(
      timelinePlayback.audioContext.destination,
    );
  }

  return timelinePlayback.audioContext;
};

const getTimelineCurrentTime = () => {
  if (!timelinePlayback.isPlaying || !timelinePlayback.audioContext) {
    return timelinePlayback.anchorVideoTime;
  }

  const elapsedContextTime = Math.max(
    0,
    timelinePlayback.audioContext.currentTime -
      timelinePlayback.anchorContextTime,
  );

  return (
    timelinePlayback.anchorVideoTime +
    elapsedContextTime * timelinePlayback.playbackRate
  );
};

const clearTimelineScheduler = () => {
  if (timelinePlayback.schedulerId) {
    window.clearInterval(timelinePlayback.schedulerId);
    timelinePlayback.schedulerId = null;
  }
};

const stopTimelineClips = () => {
  timelinePlayback.scheduleToken += 1;

  timelinePlayback.activeClips.forEach((clipState) => {
    try {
      clipState.source?.stop(0);
    } catch {}
    try {
      clipState.source?.disconnect();
    } catch {}
    try {
      clipState.gainNode?.disconnect();
    } catch {}
  });

  timelinePlayback.activeClips.clear();
};

const resetTimelinePlayback = ({ clearBuffers = false } = {}) => {
  clearTimelineScheduler();
  stopTimelineClips();
  timelinePlayback.isPlaying = false;
  timelinePlayback.anchorContextTime = 0;
  timelinePlayback.anchorVideoTime = 0;

  if (clearBuffers) {
    timelinePlayback.decodedBuffers.clear();
  }
};

const decodeAudioData = (audioContext, arrayBuffer) => {
  const clonedBuffer = arrayBuffer.slice(0);

  return new Promise((resolve, reject) => {
    const decodeResult = audioContext.decodeAudioData(
      clonedBuffer,
      (decoded) => resolve(decoded),
      (error) => reject(error),
    );

    if (decodeResult && typeof decodeResult.then === "function") {
      decodeResult.then(resolve).catch(reject);
    }
  });
};

const getTimelineClipBuffer = async (planItem) => {
  if (!planItem?.url) {
    throw new Error(
      `Aligned narration clip ${planItem?.id || "unknown"} is missing a URL`,
    );
  }

  const clipUrl = resolveServerUrl(planItem.url);
  const cachedBuffer = timelinePlayback.decodedBuffers.get(clipUrl);
  if (cachedBuffer) {
    return cachedBuffer;
  }

  const bufferPromise = (async () => {
    const audioContext = await ensureTimelineAudioContext();
    if (!audioContext) {
      throw new Error("Web Audio API is not available in this browser");
    }

    const response = await fetch(clipUrl, {
      method: "GET",
      mode: "cors",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load aligned narration clip: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return decodeAudioData(audioContext, arrayBuffer);
  })();

  timelinePlayback.decodedBuffers.set(clipUrl, bufferPromise);
  bufferPromise.catch(() => {
    timelinePlayback.decodedBuffers.delete(clipUrl);
  });

  return bufferPromise;
};

const prewarmTimelineWindow = (currentTime) => {
  const plan = timelinePlayback.plan;
  if (!Array.isArray(plan) || plan.length === 0) {
    return;
  }

  const clipsToWarm = [];
  for (const item of plan) {
    const clipEnd = item.naturalEnd || item.start + item.actualDuration;
    if (clipEnd < currentTime - 0.5) {
      continue;
    }
    if (item.start > currentTime + 12) {
      break;
    }

    clipsToWarm.push(item);
    if (clipsToWarm.length >= TIMELINE_PRELOAD_COUNT) {
      break;
    }
  }

  clipsToWarm.forEach((item) => {
    getTimelineClipBuffer(item).catch((error) => {
      console.warn(`Failed to prewarm clip ${item.id}:`, error);
    });
  });
};

const scheduleTimelineClip = async (planItem) => {
  if (timelinePlayback.activeClips.has(planItem.id)) {
    return;
  }

  const activeToken = timelinePlayback.scheduleToken;
  const pendingClipState = {
    id: planItem.id,
    pending: true,
  };

  timelinePlayback.activeClips.set(planItem.id, pendingClipState);

  try {
    const audioContext = await ensureTimelineAudioContext();
    if (
      !audioContext ||
      !timelinePlayback.isPlaying ||
      timelinePlayback.scheduleToken !== activeToken
    ) {
      timelinePlayback.activeClips.delete(planItem.id);
      return;
    }

    const audioBuffer = await getTimelineClipBuffer(planItem);
    if (
      !timelinePlayback.isPlaying ||
      timelinePlayback.scheduleToken !== activeToken
    ) {
      timelinePlayback.activeClips.delete(planItem.id);
      return;
    }

    const timelineNow = getTimelineCurrentTime();
    const clipDuration = Math.max(
      0,
      Math.min(
        audioBuffer.duration,
        planItem.actualDuration || audioBuffer.duration,
      ),
    );
    const clipOffset = Math.max(0, timelineNow - planItem.start);

    if (clipOffset >= clipDuration - TIMELINE_END_GUARD_SEC) {
      timelinePlayback.activeClips.delete(planItem.id);
      return;
    }

    const wallDelay = Math.max(
      0,
      (planItem.start - timelineNow) /
        Math.max(timelinePlayback.playbackRate, 0.01),
    );
    const startAtContextTime =
      audioContext.currentTime + wallDelay + TIMELINE_PREROLL_SEC;
    const remainingDuration = clipDuration - clipOffset;

    const sourceNode = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = timelinePlayback.playbackRate;

    sourceNode.connect(gainNode);
    gainNode.connect(timelinePlayback.masterGainNode);

    gainNode.gain.setValueAtTime(
      0,
      Math.max(
        audioContext.currentTime,
        startAtContextTime - TIMELINE_RAMP_SEC,
      ),
    );
    gainNode.gain.linearRampToValueAtTime(
      1,
      startAtContextTime + TIMELINE_RAMP_SEC,
    );

    const clipEndAtContextTime =
      startAtContextTime +
      remainingDuration / Math.max(timelinePlayback.playbackRate, 0.01);
    gainNode.gain.setValueAtTime(
      1,
      Math.max(
        startAtContextTime + TIMELINE_RAMP_SEC,
        clipEndAtContextTime - TIMELINE_RAMP_SEC,
      ),
    );
    gainNode.gain.linearRampToValueAtTime(0, clipEndAtContextTime);

    const clipState = {
      id: planItem.id,
      source: sourceNode,
      gainNode,
      token: activeToken,
    };

    timelinePlayback.activeClips.set(planItem.id, clipState);

    sourceNode.onended = () => {
      const currentClipState = timelinePlayback.activeClips.get(planItem.id);
      if (currentClipState === clipState) {
        timelinePlayback.activeClips.delete(planItem.id);
      }
    };

    sourceNode.start(startAtContextTime, clipOffset, remainingDuration);
  } catch (error) {
    console.error(
      `Failed to schedule aligned narration clip ${planItem.id}:`,
      error,
    );
    const currentClipState = timelinePlayback.activeClips.get(planItem.id);
    if (currentClipState === pendingClipState) {
      timelinePlayback.activeClips.delete(planItem.id);
    }
  }
};

const scheduleTimelineWindow = () => {
  if (
    !timelinePlayback.isPlaying ||
    !timelinePlayback.plan ||
    !timelinePlayback.plan.length
  ) {
    return;
  }

  const timelineNow = getTimelineCurrentTime();
  const scheduleHorizon =
    timelineNow +
    TIMELINE_LOOKAHEAD_WALL_SEC * Math.max(timelinePlayback.playbackRate, 0.25);
  prewarmTimelineWindow(timelineNow);

  for (const planItem of timelinePlayback.plan) {
    const clipEnd =
      planItem.naturalEnd || planItem.start + planItem.actualDuration;
    if (clipEnd <= timelineNow + TIMELINE_END_GUARD_SEC) {
      continue;
    }

    if (planItem.start > scheduleHorizon) {
      break;
    }

    if (!timelinePlayback.activeClips.has(planItem.id)) {
      scheduleTimelineClip(planItem);
    }
  }
};

const startTimelineScheduler = () => {
  clearTimelineScheduler();
  timelinePlayback.schedulerId = window.setInterval(
    scheduleTimelineWindow,
    TIMELINE_SCHEDULER_INTERVAL_MS,
  );
};

const startTimelinePlayback = async (currentTime, playbackRate) => {
  if (!timelinePlayback.plan || timelinePlayback.plan.length === 0) {
    return false;
  }

  const audioContext = await ensureTimelineAudioContext();
  if (!audioContext) {
    return false;
  }

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } catch (error) {
    console.warn("Unable to resume aligned narration audio context:", error);
  }

  stopTimelineClips();
  timelinePlayback.isPlaying = true;
  timelinePlayback.anchorVideoTime = Math.max(0, currentTime);
  timelinePlayback.anchorContextTime = audioContext.currentTime;
  timelinePlayback.playbackRate = playbackRate;
  timelinePlayback.masterGainNode.gain.value = timelinePlayback.volume;

  prewarmTimelineWindow(currentTime);
  scheduleTimelineWindow();
  startTimelineScheduler();
  return true;
};

const stopTimelinePlayback = (currentTime = null) => {
  if (typeof currentTime === "number") {
    timelinePlayback.anchorVideoTime = Math.max(0, currentTime);
  }

  timelinePlayback.isPlaying = false;
  clearTimelineScheduler();
  stopTimelineClips();
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
  revokeObjectUrlIfNeeded(alignedNarrationCache.url);
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

const playFileModeNarration = (currentTime, isPlaying) => {
  const audio = ensureFileAudioElement();
  if (!audio) {
    return false;
  }

  try {
    const timeDifference = Math.abs(audio.currentTime - currentTime);
    if (timeDifference > 0.25 || !isPlaying) {
      audio.currentTime = Math.max(0, currentTime);
    }

    audio.playbackRate = timelinePlayback.playbackRate;
    audio.volume = timelinePlayback.volume;

    if (isPlaying && audio.paused) {
      audio.play().catch((error) => {
        console.error("Error playing aligned narration audio file:", error);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  } catch (error) {
    console.error("Error controlling aligned narration audio file:", error);
    return false;
  }

  return true;
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
      timelineDrift > TIMELINE_RESYNC_THRESHOLD_SEC ||
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
  revokeObjectUrlIfNeeded(alignedNarrationCache.url);

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
    revokeObjectUrlIfNeeded(alignedNarrationCache.url);
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
