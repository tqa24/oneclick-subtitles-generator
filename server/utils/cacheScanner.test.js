const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanFlatDir, scanRecursiveDir, clearFlatDir, finalizeCacheDetails } = require('./cacheScanner');

const mkTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cachescan-'));
const target = () => ({ count: 0, size: 0, files: [] });

test('scanFlatDir tallies files and skips subdirectories', () => {
  const dir = mkTmp();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello'); // 5 bytes
  fs.writeFileSync(path.join(dir, 'b.txt'), 'worldwide'); // 9 bytes
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'sub', 'c.txt'), 'ignored');
  const t = target();
  scanFlatDir(dir, t);
  assert.strictEqual(t.count, 2);
  assert.strictEqual(t.size, 14);
  assert.deepStrictEqual(t.files.map((f) => f.name).sort(), ['a.txt', 'b.txt']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('scanFlatDir on a missing directory is a no-op', () => {
  const t = target();
  scanFlatDir(path.join(os.tmpdir(), 'cachescan-definitely-missing-xyz'), t);
  assert.strictEqual(t.count, 0);
  assert.strictEqual(t.size, 0);
});

test('scanRecursiveDir uses prefixed relative names', () => {
  const dir = mkTmp();
  fs.writeFileSync(path.join(dir, 'root.txt'), 'a'); // 1
  fs.mkdirSync(path.join(dir, 'nested'));
  fs.writeFileSync(path.join(dir, 'nested', 'deep.txt'), 'bb'); // 2
  const t = target();
  scanRecursiveDir(dir, t);
  assert.strictEqual(t.count, 2);
  assert.strictEqual(t.size, 3);
  assert.deepStrictEqual(t.files.map((f) => f.name).sort(), ['nested/deep.txt', 'root.txt']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('clearFlatDir counts then deletes files', async () => {
  const dir = mkTmp();
  fs.writeFileSync(path.join(dir, 'gone.txt'), 'bye'); // 3
  const t = target();
  await clearFlatDir(dir, t);
  assert.strictEqual(t.count, 1);
  assert.strictEqual(t.size, 3);
  assert.strictEqual(fs.existsSync(path.join(dir, 'gone.txt')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('finalizeCacheDetails sums totals and attaches formatted sizes', () => {
  const details = {
    subtitles: { count: 2, size: 100, files: [] },
    videos: { count: 1, size: 1024, files: [] },
  };
  finalizeCacheDetails(details);
  assert.strictEqual(details.totalCount, 3);
  assert.strictEqual(details.totalSize, 1124);
  assert.strictEqual(typeof details.subtitles.formattedSize, 'string');
  assert.strictEqual(typeof details.formattedTotalSize, 'string');
});
