/**
 * Unit tests for shared yt-dlp helpers. Runs on Node's built-in test runner (no extra deps):
 *   node --test server/
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { qualityToResolution } = require('./ytdlpUtils');

test('qualityToResolution maps known quality labels to yt-dlp heights', () => {
  assert.strictEqual(qualityToResolution('144p'), '144');
  assert.strictEqual(qualityToResolution('240p'), '240');
  assert.strictEqual(qualityToResolution('360p'), '360');
  assert.strictEqual(qualityToResolution('480p'), '480');
  assert.strictEqual(qualityToResolution('720p'), '720');
  assert.strictEqual(qualityToResolution('1080p'), '1080');
});

test('qualityToResolution falls back to 360 for unknown/empty input', () => {
  assert.strictEqual(qualityToResolution('4k'), '360');
  assert.strictEqual(qualityToResolution('best'), '360');
  assert.strictEqual(qualityToResolution(''), '360');
  assert.strictEqual(qualityToResolution(undefined), '360');
  assert.strictEqual(qualityToResolution(null), '360');
});
