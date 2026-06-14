/**
 * Shared validation for the :videoId route param.
 *
 * Many routes build a filesystem path as `path.join(VIDEOS_DIR, `${videoId}.mp4`)`. If videoId is
 * attacker-controlled (it comes straight from the URL) a value like "../../../Windows/win.ini"
 * would escape VIDEOS_DIR. Legitimate ids are YouTube-style / generated tokens, so allow only
 * `[A-Za-z0-9_-]`. Register once per router: `router.param('videoId', validateVideoIdParam)`.
 */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]+$/;

function isValidVideoId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && VIDEO_ID_RE.test(id);
}

function validateVideoIdParam(req, res, next, id) {
  if (!isValidVideoId(id)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }
  next();
}

module.exports = { isValidVideoId, validateVideoIdParam };
