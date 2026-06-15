/**
 * Douyin service index file — re-exports the downloader's public API.
 */

const {
  downloadDouyinVideoPuppeteer,
  downloadDouyinVideoWithRetry,
  normalizeDouyinUrl,
} = require('./downloader');

module.exports = {
  downloadDouyinVideoPuppeteer,
  downloadDouyinVideoWithRetry,
  normalizeDouyinUrl,
};
