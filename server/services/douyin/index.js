/**
 * Douyin service index file
 */

const {
  downloadDouyinVideo,
  downloadDouyinVideoFallback,
  downloadDouyinVideoShortUrlFallback,
  downloadDouyinVideoSimpleFallback,
  downloadDouyinVideoCustomExtractor,
  downloadDouyinVideoWithRetry,
  normalizeDouyinUrl,
  getYtDlpPath
} = require('./downloader');

module.exports = {
  downloadDouyinVideo,
  downloadDouyinVideoFallback,
  downloadDouyinVideoShortUrlFallback,
  downloadDouyinVideoSimpleFallback,
  downloadDouyinVideoCustomExtractor,
  downloadDouyinVideoWithRetry,
  normalizeDouyinUrl,
  getYtDlpPath
};
