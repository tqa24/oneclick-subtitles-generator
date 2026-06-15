/**
 * API routes for media (video and audio) operations.
 *
 * This file is intentionally thin: it creates the shared router and delegates
 * each domain group of route handlers to its own registrar module (kept in this
 * same directory so their relative `../config` / helper requires resolve identically):
 *   - videoDownloadRoutes      download-video / download-progress / cancel-download
 *   - videoMediaInfoRoutes     copy-large-file / video-exists / segment-exists /
 *                              video-dimensions / probe-media / delete-videos
 *   - videoSplitOptimizeRoutes split-existing-file / optimize-existing-file /
 *                              create-analysis-video
 *   - videoAudioRoutes         extract-audio* / converted-audio-exists /
 *                              convert-audio-to-video / extract-video-segment
 */

const express = require('express');
const router = express.Router();

const registerVideoDownloadRoutes = require('./videoDownloadRoutes');
const registerVideoMediaInfoRoutes = require('./videoMediaInfoRoutes');
const registerVideoSplitOptimizeRoutes = require('./videoSplitOptimizeRoutes');
const registerVideoAudioRoutes = require('./videoAudioRoutes');

registerVideoMediaInfoRoutes(router);
registerVideoDownloadRoutes(router);
registerVideoSplitOptimizeRoutes(router);
registerVideoAudioRoutes(router);

module.exports = router;
