/**
 * Shared mutable cache state for aligned narration.
 *
 * The cache is a reassigned `let`, so it MUST be read and written through the
 * accessor functions (a reassigned binding does not propagate across ES module
 * boundaries). `window.alignedAudioElement` is kept authoritative by
 * fileAudioElement.js; syncWindowState reads it rather than the audio element's
 * private binding so the file-mode module can own that piece of state.
 */
import { SERVER_URL } from "../../config";

export const emptyAlignedNarrationCache = () => ({
  blob: null,
  url: null,
  filename: null,
  mode: null,
  previewPlan: null,
  timestamp: null,
  subtitleTimestamps: {},
});

export const revokeObjectUrlIfNeeded = (url) => {
  if (typeof url === "string" && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("Error revoking object URL:", error);
    }
  }
};

export const resolveServerUrl = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${SERVER_URL}${url}`;
};

let alignedNarrationCache = emptyAlignedNarrationCache();

export const syncWindowState = () => {
  window.alignedNarrationCache = alignedNarrationCache;
  window.isAlignedNarrationAvailable = !!(
    alignedNarrationCache.url ||
    (alignedNarrationCache.previewPlan &&
      alignedNarrationCache.previewPlan.length > 0)
  );
  window.alignedAudioElement = window.alignedAudioElement || null;
};

export const setAlignedNarrationCache = (nextCache) => {
  alignedNarrationCache = nextCache;
  syncWindowState();
};

export const getCurrentCache = () =>
  window.alignedNarrationCache || alignedNarrationCache;

/**
 * Direct read of the locally-held cache (not the window mirror). Used where the
 * original code referenced the raw `alignedNarrationCache` binding to read the
 * current URL before revoking it.
 */
export const getLocalCache = () => alignedNarrationCache;
