/**
 * Web-Audio timeline playback engine for aligned narration preview mode.
 *
 * Owns the shared mutable `timelinePlayback` state object. Because it is a
 * plain object (never reassigned), other modules can mutate its properties and
 * the changes are visible here and vice versa.
 */
import { resolveServerUrl } from "./cacheState";

const TIMELINE_PREROLL_SEC = 0.03;
const TIMELINE_LOOKAHEAD_WALL_SEC = 2.0;
const TIMELINE_RESYNC_THRESHOLD_SEC = 0.12;
const TIMELINE_END_GUARD_SEC = 0.01;
const TIMELINE_RAMP_SEC = 0.005;
const TIMELINE_SCHEDULER_INTERVAL_MS = 100;
const TIMELINE_PRELOAD_COUNT = 8;

export const TIMELINE_RESYNC_THRESHOLD = TIMELINE_RESYNC_THRESHOLD_SEC;

export const timelinePlayback = {
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

export const supportsTimelinePreview = () => {
  return (
    typeof window !== "undefined" &&
    !!(window.AudioContext || window.webkitAudioContext)
  );
};

export const ensureTimelineAudioContext = async () => {
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

export const getTimelineCurrentTime = () => {
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

export const resetTimelinePlayback = ({ clearBuffers = false } = {}) => {
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

export const prewarmTimelineWindow = (currentTime) => {
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

export const startTimelinePlayback = async (currentTime, playbackRate) => {
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

export const stopTimelinePlayback = (currentTime = null) => {
  if (typeof currentTime === "number") {
    timelinePlayback.anchorVideoTime = Math.max(0, currentTime);
  }

  timelinePlayback.isPlaying = false;
  clearTimelineScheduler();
  stopTimelineClips();
};
