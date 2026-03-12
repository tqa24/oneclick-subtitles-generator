/**
 * Persistent per-file audio metadata helpers.
 *
 * Durations are stored next to each generated audio file so later alignment
 * and edit flows do not need to probe the media again.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getFfprobePath } = require('../../../services/shared/ffmpegUtils');

const METADATA_SUFFIX = '.meta.json';
const DEFAULT_FFPROBE_TIMEOUT_MS = 15000;

const toDurationNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Number(numericValue.toFixed(6));
};

const getAudioMetadataPath = (audioPath) => `${audioPath}${METADATA_SUFFIX}`;

const isRegularFile = (filePath) => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const readFileStats = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return null;
    }

    return stats;
  } catch {
    return null;
  }
};

const parseWavDurationFromHeader = (audioPath) => {
  let fd = null;

  try {
    const stats = fs.statSync(audioPath);
    if (!stats.isFile() || stats.size < 44) {
      return null;
    }

    fd = fs.openSync(audioPath, 'r');
    const headerLength = Math.min(stats.size, 1024 * 1024);
    const headerBuffer = Buffer.alloc(headerLength);
    fs.readSync(fd, headerBuffer, 0, headerLength, 0);

    if (
      headerBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
      headerBuffer.toString('ascii', 8, 12) !== 'WAVE'
    ) {
      return null;
    }

    let offset = 12;
    let byteRate = 0;
    let dataSize = null;

    while (offset + 8 <= headerBuffer.length) {
      const chunkId = headerBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = headerBuffer.readUInt32LE(offset + 4);
      const chunkDataOffset = offset + 8;

      if (chunkId === 'fmt ' && chunkSize >= 16 && chunkDataOffset + 16 <= headerBuffer.length) {
        byteRate = headerBuffer.readUInt32LE(chunkDataOffset + 8);
      } else if (chunkId === 'data' && chunkDataOffset <= headerBuffer.length) {
        dataSize = chunkSize;
        break;
      }

      offset = chunkDataOffset + chunkSize + (chunkSize % 2);
    }

    if (byteRate > 0 && dataSize !== null) {
      return toDurationNumber(dataSize / byteRate);
    }

    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
};

const probeDurationWithFfprobe = (audioPath, timeoutMs = DEFAULT_FFPROBE_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const ffprobe = spawn(getFfprobePath(), [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (handler) => (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      handler(value);
    };

    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);

    const timeoutId = setTimeout(() => {
      try {
        ffprobe.kill();
      } catch {}
      rejectOnce(new Error('ffprobe timeout'));
    }, timeoutMs);

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('error', (error) => {
      rejectOnce(error);
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        rejectOnce(new Error(stderr || `ffprobe exited with code ${code}`));
        return;
      }

      const durationSeconds = toDurationNumber(stdout.trim());
      if (durationSeconds === null) {
        rejectOnce(new Error('Failed to parse duration'));
        return;
      }

      resolveOnce(durationSeconds);
    });
  });

const removeAudioMetadata = (audioPath) => {
  const metadataPath = getAudioMetadataPath(audioPath);
  try {
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
  } catch (error) {
    console.warn(`Failed to remove audio metadata ${metadataPath}: ${error.message}`);
  }
};

const readAudioMetadata = (audioPath) => {
  const metadataPath = getAudioMetadataPath(audioPath);
  const stats = readFileStats(audioPath);
  if (!stats || !fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const durationSeconds = toDurationNumber(
      metadata.durationSeconds ?? metadata.duration ?? metadata.actualDuration,
    );

    if (durationSeconds === null) {
      return null;
    }

    if (
      typeof metadata.fileSizeBytes === 'number' &&
      metadata.fileSizeBytes !== stats.size
    ) {
      return null;
    }

    if (
      typeof metadata.fileMtimeMs === 'number' &&
      Math.round(metadata.fileMtimeMs) !== Math.round(stats.mtimeMs)
    ) {
      return null;
    }

    return {
      ...metadata,
      durationSeconds,
      audioPath,
      metadataPath,
    };
  } catch (error) {
    console.warn(`Failed to read audio metadata ${metadataPath}: ${error.message}`);
    return null;
  }
};

const writeAudioMetadata = (audioPath, durationSeconds, options = {}) => {
  const normalizedDuration = toDurationNumber(durationSeconds);
  const stats = readFileStats(audioPath);
  if (!stats || normalizedDuration === null) {
    return null;
  }

  const metadataPath = getAudioMetadataPath(audioPath);
  const metadata = {
    version: 1,
    durationSeconds: normalizedDuration,
    fileSizeBytes: stats.size,
    fileMtimeMs: stats.mtimeMs,
    updatedAt: new Date().toISOString(),
    source: options.source || 'unknown',
  };

  if (options.copiedFrom) {
    metadata.copiedFrom = options.copiedFrom;
  }

  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    return {
      ...metadata,
      audioPath,
      metadataPath,
    };
  } catch (error) {
    console.warn(`Failed to write audio metadata ${metadataPath}: ${error.message}`);
    return null;
  }
};

const copyAudioMetadataSync = (sourceAudioPath, targetAudioPath) => {
  const sourceMetadata = readAudioMetadata(sourceAudioPath);
  if (!sourceMetadata || !isRegularFile(targetAudioPath)) {
    return null;
  }

  return writeAudioMetadata(targetAudioPath, sourceMetadata.durationSeconds, {
    source: 'copied',
    copiedFrom: sourceAudioPath,
  });
};

const resolveDurationMetadata = async (audioPath, options = {}) => {
  const cachedMetadata = readAudioMetadata(audioPath);
  if (cachedMetadata) {
    return cachedMetadata;
  }

  if (!isRegularFile(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const wavDuration = parseWavDurationFromHeader(audioPath);
  if (wavDuration !== null) {
    return (
      writeAudioMetadata(audioPath, wavDuration, { source: 'wav-header' }) || {
        durationSeconds: wavDuration,
        audioPath,
        metadataPath: getAudioMetadataPath(audioPath),
        source: 'wav-header',
      }
    );
  }

  if (options.allowProbe === false) {
    return null;
  }

  const probedDuration = await probeDurationWithFfprobe(
    audioPath,
    options.timeoutMs,
  );

  return (
    writeAudioMetadata(audioPath, probedDuration, { source: 'ffprobe' }) || {
      durationSeconds: probedDuration,
      audioPath,
      metadataPath: getAudioMetadataPath(audioPath),
      source: 'ffprobe',
    }
  );
};

module.exports = {
  DEFAULT_FFPROBE_TIMEOUT_MS,
  copyAudioMetadataSync,
  getAudioMetadataPath,
  parseWavDurationFromHeader,
  probeDurationWithFfprobe,
  readAudioMetadata,
  removeAudioMetadata,
  resolveDurationMetadata,
  toDurationNumber,
  writeAudioMetadata,
};
