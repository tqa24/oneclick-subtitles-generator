/**
 * <audio> element lifecycle for file-mode aligned narration playback.
 *
 * Owns the `alignedAudioElement` binding. It mirrors that binding onto
 * `window.alignedAudioElement` so cacheState's syncWindowState can read it
 * without importing this module (avoiding a needless cycle). Volume/rate are
 * read from the shared timelinePlayback state.
 */
import { getCurrentCache, syncWindowState } from "./cacheState";
import { timelinePlayback } from "./timelinePlaybackEngine";

let alignedAudioElement = null;

export const resetFileAudioElement = (clearSource = true) => {
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
  window.alignedAudioElement = null;
  syncWindowState();
};

export const ensureFileAudioElement = () => {
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

export const playFileModeNarration = (currentTime, isPlaying) => {
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
