/**
 * Shared directory scan/clear helpers for the cache routes.
 *
 * Each helper accumulates into a `target` accumulator of shape { count, size, files }.
 * They produce byte-identical results to the per-directory blocks that used to be
 * copy-pasted ~25 times across the /cache-info (GET) and /clear-cache (DELETE) handlers.
 */

const fs = require('fs');
const path = require('path');
const { formatBytes } = require('./fileUtils');
const { safeDeleteFile } = require('./windowsSafeFileOperations');

/** The 15 cache categories, in response order, used to total and format details. */
const CACHE_CATEGORY_KEYS = [
  'subtitles', 'videos', 'userSubtitles', 'rules', 'narrationReference', 'narrationOutput',
  'lyrics', 'albumArt', 'uploads', 'output', 'videoRendered', 'videoTemp', 'videoAlbumArt',
  'videoRendererUploads', 'videoRendererOutput',
];

/** Scan a flat directory (skipping sub-directories), tallying file count/size into target. */
const scanFlatDir = (dir, target) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) continue;
      const fileSize = stats.size;
      target.count++;
      target.size += fileSize;
      target.files.push({ name: file, size: fileSize });
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
};

/** Recursively scan a directory tree, naming files by their "<dir>/<file>" relative path. */
const scanRecursiveDir = (dir, target) => {
  if (!fs.existsSync(dir)) return;
  const walk = (dirPath, prefix = '') => {
    for (const item of fs.readdirSync(dirPath)) {
      const itemPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(itemPath);
        const name = prefix ? `${prefix}/${item}` : item;
        if (stats.isDirectory()) {
          walk(itemPath, name);
        } else {
          const fileSize = stats.size;
          target.count++;
          target.size += fileSize;
          target.files.push({ name, size: fileSize });
        }
      } catch (error) {
        console.error(`Error processing item ${itemPath}:`, error);
      }
    }
  };
  walk(dir);
};

/** Scan a flat directory and safely delete each file, tallying into target. */
const clearFlatDir = async (dir, target) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) continue;
      const fileSize = stats.size;
      target.count++;
      target.size += fileSize;
      target.files.push({ name: file, size: fileSize });
      await safeDeleteFile(filePath);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
};

/** Recursively delete a directory tree (files + now-empty dirs), tallying into target. */
const clearRecursiveDir = async (dir, target) => {
  if (!fs.existsSync(dir)) return;
  const walk = async (dirPath, prefix = '') => {
    for (const item of fs.readdirSync(dirPath)) {
      const itemPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(itemPath);
        const name = prefix ? `${prefix}/${item}` : item;
        if (stats.isDirectory()) {
          await walk(itemPath, name);
          try {
            fs.rmdirSync(itemPath);
          } catch (rmError) {
            console.error(`Error removing directory ${itemPath}:`, rmError);
          }
        } else {
          const fileSize = stats.size;
          target.count++;
          target.size += fileSize;
          target.files.push({ name, size: fileSize });
          await safeDeleteFile(itemPath);
        }
      } catch (error) {
        console.error(`Error processing item ${itemPath}:`, error);
      }
    }
  };
  await walk(dir);
};

/** Sum per-category counts/sizes into totals and attach human-readable sizes. */
const finalizeCacheDetails = (details) => {
  let totalCount = 0;
  let totalSize = 0;
  for (const key of CACHE_CATEGORY_KEYS) {
    if (!details[key]) continue;
    totalCount += details[key].count;
    totalSize += details[key].size;
    details[key].formattedSize = formatBytes(details[key].size);
  }
  details.totalCount = totalCount;
  details.totalSize = totalSize;
  details.formattedTotalSize = formatBytes(totalSize);
  return details;
};

module.exports = {
  CACHE_CATEGORY_KEYS,
  scanFlatDir,
  scanRecursiveDir,
  clearFlatDir,
  clearRecursiveDir,
  finalizeCacheDetails,
};
