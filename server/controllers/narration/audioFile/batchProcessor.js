/**
 * Aggregator for the aligned-audio batch pipeline. Implementation split into durationProber.js
 * (probing), overlapResolver.js (overlap analysis), ffmpegTimeline.js (ffmpeg + render).
 */
const { getMediaDuration } = require('./durationProber');
const { analyzeAndAdjustSegments } = require('./overlapResolver');
const { renderAlignedAudioTimeline } = require('./ffmpegTimeline');

module.exports = {
  analyzeAndAdjustSegments,
  getMediaDuration,
  renderAlignedAudioTimeline,
};
