// Pure helpers for the narration lane, which is a client-side STAGING track of narration
// placement (clip start times + a global speed) — decoupled from subtitle timing until the user
// commits with "Pull subtitles to narration". Subtitles only change at the commit step.

/** Stable key matching a subtitle/lyric to its narration result. */
export const lyricKey = (lyric, index) => lyric?.id ?? lyric?.subtitle_id ?? index + 1;

/** Effective on-timeline length of a clip at the given global speed (audio plays 1/speed as long). */
export const placementLength = (audioDuration, speed = 1) =>
  Math.max(0.05, (audioDuration > 0 ? audioDuration : 0.5) / (speed || 1));

/**
 * Sequential, non-overlapping placement starts for narration clips, in time order. Each clip
 * keeps its current start unless pushed right by the previous clip's end (so gaps are preserved).
 * @param {Array} segments - lane segments ({ id, start, audioDuration })
 * @param {number} [speed=1]
 * @returns {Object} { [id]: startSec }
 */
export const arrangePlacement = (segments, speed = 1) => {
  const ordered = [...(segments || [])].sort((a, b) => a.start - b.start);
  const starts = {};
  let previousEnd = -Infinity;
  for (const seg of ordered) {
    const start = Math.max(seg.start, previousEnd);
    starts[seg.id] = start;
    previousEnd = start + placementLength(seg.audioDuration, speed);
  }
  return starts;
};

/** Move a clip's placement start by deltaSec, snapping to nearby targets within snapTol seconds. */
export const movePlacementStart = (currentStart, deltaSec, { snapTargets = [], snapTol = 0.12 } = {}) => {
  const value = Math.max(0, currentStart + deltaSec);
  let best = value;
  let bestDist = snapTol;
  for (const target of snapTargets) {
    const dist = Math.abs(target - value);
    if (dist < bestDist) { bestDist = dist; best = target; }
  }
  return best;
};

/**
 * Commit the staged placement to subtitle timings: each subtitle becomes
 * [placementStart, placementStart + clipLength]. Returns new lyrics for applyTimings (undoable).
 * @param {Array} lyrics
 * @param {Array} segments - lane segments ({ id, start, audioDuration })
 * @param {Object|null} placementStarts - { [id]: startSec } overrides (falls back to the segment's start)
 * @param {number} [speed=1]
 */
export const placementToLyrics = (lyrics, segments, placementStarts, speed = 1) => {
  const byId = new Map((segments || []).map((s) => [s.id, s]));
  return (lyrics || []).map((lyric, i) => {
    const seg = byId.get(lyricKey(lyric, i));
    if (!seg) return lyric;
    const start = placementStarts && placementStarts[seg.id] != null ? placementStarts[seg.id] : seg.start;
    return { ...lyric, start, end: start + placementLength(seg.audioDuration, speed) };
  });
};
