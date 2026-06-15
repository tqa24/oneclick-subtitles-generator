/**
 * Tests for the smart overlap-resolution math in batchProcessor.
 * Runs on Node's built-in test runner: npm run test:server
 *
 * analyzeAndAdjustSegments pushes overlapping narration segments later in time so that no two
 * adjacent segments overlap by more than 0.3s (a small natural overlap is allowed). We feed
 * segments that already carry `actualDuration`, so the duration probe is skipped (no audio files
 * needed) and the test stays a pure unit test of the timing algorithm.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { analyzeAndAdjustSegments } = require('./batchProcessor');

// The function intentionally logs a lot; silence it so the test report stays readable.
const _log = console.log;
const _err = console.error;
before(() => { console.log = () => {}; console.error = () => {}; });
after(() => { console.log = _log; console.error = _err; });

const seg = (subtitle_id, start, actualDuration) => ({
  subtitle_id, start, end: start + actualDuration, actualDuration,
});

const ALLOWED_OVERLAP = 0.3;
const EPS = 1e-9;

test('non-overlapping segments are returned unchanged', async () => {
  const input = [seg(1, 0, 2), seg(2, 5, 2), seg(3, 10, 2)];
  const { adjustedSegments, adjustmentStats } = await analyzeAndAdjustSegments(input);
  assert.strictEqual(adjustedSegments.length, 3);
  assert.deepStrictEqual(adjustedSegments.map((s) => s.subtitle_id), [1, 2, 3]);
  assert.deepStrictEqual(adjustedSegments.map((s) => s.start), [0, 5, 10]);
  assert.strictEqual(adjustmentStats.adjustedCount, 0);
});

test('an overlapping segment is pushed right and the residual overlap stays within 0.3s', async () => {
  // seg 1 occupies 0..5 (naturalEnd 5); seg 2 starts at 3 -> overlaps (effective end 4.7).
  const input = [seg(1, 0, 5), seg(2, 3, 2)];
  const { adjustedSegments, adjustmentStats } = await analyzeAndAdjustSegments(input);
  const [a, b] = adjustedSegments;
  assert.ok(b.start > 3, 'the overlapping segment should be moved later');
  assert.ok(a.naturalEnd - b.start <= ALLOWED_OVERLAP + EPS, 'residual overlap must be <= 0.3s');
  assert.ok(adjustmentStats.adjustedCount >= 1);
  assert.ok(adjustmentStats.rightMoves >= 1);
});

test('output preserves count/ids/actualDuration, naturalEnd === start + actualDuration, and the 0.3s invariant', async () => {
  const input = [seg(1, 0, 5), seg(2, 3, 2), seg(3, 4, 1)];
  const { adjustedSegments } = await analyzeAndAdjustSegments(input);
  assert.strictEqual(adjustedSegments.length, 3);
  assert.deepStrictEqual(adjustedSegments.map((s) => s.subtitle_id), [1, 2, 3]);
  for (const s of adjustedSegments) {
    assert.ok(Math.abs(s.naturalEnd - (s.start + s.actualDuration)) < EPS, 'naturalEnd must equal start + actualDuration');
  }
  for (let i = 1; i < adjustedSegments.length; i++) {
    const overlap = adjustedSegments[i - 1].naturalEnd - adjustedSegments[i].start;
    assert.ok(overlap <= ALLOWED_OVERLAP + EPS, `adjacent pair ${i} overlaps by ${overlap}s (> 0.3s)`);
  }
});

test('segments are sorted by start time before resolution', async () => {
  const input = [seg(3, 10, 2), seg(1, 0, 2), seg(2, 5, 2)];
  const { adjustedSegments } = await analyzeAndAdjustSegments(input);
  assert.deepStrictEqual(adjustedSegments.map((s) => s.subtitle_id), [1, 2, 3]);
});
