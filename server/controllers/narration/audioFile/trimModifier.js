/**
 * Module for trimming audio files using ffmpeg
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import directory paths
const { OUTPUT_AUDIO_DIR } = require('../directoryManager');

/**
 * Minimal ffprobe helper to get duration in seconds
 */
const runFfprobe = (filePath) => new Promise((resolve, reject) => {
  try {
    const args = ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', filePath];
    const proc = spawn('ffprobe', args);
    let out = '';
    let err = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', (code) => {
      if (code === 0) {
        const val = parseFloat(out.trim());
        if (!isNaN(val)) return resolve(val);
        return reject(new Error('Failed to parse duration'));
      }
      reject(new Error(err || `ffprobe exited with code ${code}`));
    });
  } catch (e) {
    reject(e);
  }
});

/**
 * Build codec args based on file extension
 */
const getCodecArgs = (audioPath) => {
  const ext = path.extname(audioPath).toLowerCase();
  if (ext === '.mp3') {
    return ['-c:a', 'libmp3lame', '-b:a', '192k'];
  }
  if (ext === '.wav') {
    return ['-c:a', 'pcm_s16le', '-ar', '44100'];
  }
  // Default: let ffmpeg decide or copy if compatible
  return ['-c:a', 'copy'];
};

/**
 * Ensure we have a sole immutable backup_<filename> created from the first generated audio.
 * Always use this backup file as the source for any subsequent trim/speed adjustments.
 */
const ensureBackupAndGetSource = (filename) => {
  const audioPath = path.join(OUTPUT_AUDIO_DIR, filename);
  const dir = path.dirname(filename);
  const base = path.basename(filename);

  // Preferred source for all edits: backup_<filename>
  const backupFilename = `${dir}/backup_${base}`;
  const backupPath = path.join(OUTPUT_AUDIO_DIR, backupFilename);

  if (!fs.existsSync(backupPath) && fs.existsSync(audioPath)) {
    // First-time: create the backup from the current audio file
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(audioPath, backupPath);
  }

  // Use backup if exists, otherwise fall back to current audio (shouldn't happen often)
  return fs.existsSync(backupPath)
    ? { sourceFile: backupPath, audioPath }
    : { sourceFile: audioPath, audioPath };
};

/**
 * Modify (trim) a single audio file on disk
 * Expects body: { filename: string, start: number, end: number }
 */
const modifyAudioTrim = async (req, res) => {
  try {
    const { filename, start, end } = req.body || {};
    if (!filename || typeof start !== 'number' || typeof end !== 'number') {
      return res.status(400).json({ success: false, error: 'Missing required parameters (filename, start, end)' });
    }
    if (start < 0 || end <= 0 || end <= start) {
      return res.status(400).json({ success: false, error: 'Invalid trim range. Ensure 0 <= start < end' });
    }

    const { sourceFile, audioPath } = ensureBackupAndGetSource(filename);
    if (!fs.existsSync(sourceFile)) {
      return res.status(404).json({ success: false, error: `Audio file not found: ${filename}` });
    }

    const duration = end - start;
    const codecArgs = getCodecArgs(audioPath);

    // Use accurate seek: place -ss and -t after -i for accuracy
    const ffmpegArgs = [
      '-i', sourceFile,
      '-ss', String(start),
      '-t', String(duration),
      ...codecArgs,
      '-y',
      audioPath
    ];

    const ff = spawn('ffmpeg', ffmpegArgs);
    let stderrData = '';
    ff.stderr.on('data', (d) => { stderrData += d.toString(); });

    ff.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, filename, start, end, message: 'Trim applied' });
      } else {
        console.error('ffmpeg trim error:', stderrData);
        res.status(500).json({ success: false, error: `ffmpeg exited with code ${code}` });
      }
    });
  } catch (error) {
    console.error('modifyAudioTrim error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Batch trim multiple audio files
 * Expects body: { items: Array<{ filename: string, start: number, end: number }> }
 * Streams progress similar to batchModifyAudioSpeed
 */
const batchModifyAudioTrim = async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: items[]' });
    }

    // Stream headers
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const total = items.length;
    let processed = 0;

    res.write(`data: ${JSON.stringify({ success: true, status: 'progress', total, processed })}\n\n`);

    // Sequential processing for simplicity
    for (const item of items) {
      try {
        const { filename, start, end } = item;
        if (!filename || typeof start !== 'number' || typeof end !== 'number' || !(end > start) || start < 0) {
          processed++;
          res.write(`data: ${JSON.stringify({ success: true, status: 'processing', total, processed, filename, message: 'Invalid params' })}\n\n`);
          continue;
        }

        const { sourceFile, audioPath } = ensureBackupAndGetSource(filename);
        if (!fs.existsSync(sourceFile)) {
          processed++;
          res.write(`data: ${JSON.stringify({ success: true, status: 'processing', total, processed, filename, message: 'File not found' })}\n\n`);
          continue;
        }

        const duration = end - start;
        const codecArgs = getCodecArgs(audioPath);
        const ffmpegArgs = [
          '-i', sourceFile,
          '-ss', String(start),
          '-t', String(duration),
          ...codecArgs,
          '-y',
          audioPath
        ];

        await new Promise((resolve) => {
          const ff = spawn('ffmpeg', ffmpegArgs);
          ff.on('close', (code) => {
            processed++;
            if (code === 0) {
              res.write(`data: ${JSON.stringify({ success: true, status: 'processing', total, processed, filename, message: 'Trim applied' })}\n\n`);
            } else {
              res.write(`data: ${JSON.stringify({ success: true, status: 'processing', total, processed, filename, message: `ffmpeg exited ${code}` })}\n\n`);
            }
            resolve();
          });
          ff.on('error', () => {
            processed++;
            res.write(`data: ${JSON.stringify({ success: true, status: 'processing', total, processed, filename, message: 'Spawn error' })}\n\n`);
            resolve();
          });
        });
      } catch (e) {
        processed++;
        res.write(`data: ${JSON.stringify({ success: true, status: 'processing', total, processed, message: e.message })}\n\n`);
      }
    }

    res.end(`data: ${JSON.stringify({ success: true, status: 'completed', total, processed, message: 'Audio trim modification complete' })}\n\n`);
  } catch (error) {
    console.error('batchModifyAudioTrim error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.end(`data: ${JSON.stringify({ success: false, status: 'error', error: error.message })}\n\n`);
    }
  }
};


/**
 * Combined trim + speed modification in a single ffmpeg command.
 * Expects body: { filename: string, speedFactor?: number, normalizedStart: number, normalizedEnd: number }
 * normalizedStart/normalizedEnd must be in [0,1] and are mapped to the backup source duration.
 * Implementation applies trim first (via -ss/-t) and then speed (via atempo), ensuring UI times map to original backup.
 */
const modifyAudioTrimAndSpeedCombined = async (req, res) => {
  try {
    const { filename, speedFactor, normalizedStart, normalizedEnd } = req.body || {};
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: filename' });
    }

    const { sourceFile, audioPath } = ensureBackupAndGetSource(filename);
    if (!fs.existsSync(sourceFile)) {
      return res.status(404).json({ success: false, error: `Audio file not found: ${filename}` });
    }

    // Require normalized boundaries only
    if (typeof normalizedStart !== 'number' || typeof normalizedEnd !== 'number') {
      return res.status(400).json({ success: false, error: 'normalizedStart and normalizedEnd are required (0..1)' });
    }

    const srcDuration = await runFfprobe(sourceFile).catch(() => null);
    if (!(typeof srcDuration === 'number' && srcDuration > 0)) {
      return res.status(500).json({ success: false, error: 'Failed to read source duration' });
    }

    const ns = Math.max(0, Math.min(1, normalizedStart));
    const ne = Math.max(0, Math.min(1, normalizedEnd));
    const trimStart = ns * srcDuration;
    const trimEnd = ne * srcDuration;

    if (!(trimStart >= 0 && trimEnd > trimStart)) {
      return res.status(400).json({ success: false, error: 'Invalid normalized trim range' });
    }

    // Build audio filter graph: trim then speed
    const filters = [];
    filters.push(`atrim=start=${trimStart}:end=${trimEnd}`);
    filters.push('asetpts=N/SR/TB');

    if (typeof speedFactor === 'number' && !isNaN(speedFactor)) {
      const speed = Number(speedFactor);
      if (speed >= 0.5 && speed <= 2.0) {
        filters.push(`atempo=${speed}`);
      } else if (speed > 2.0 && speed <= 4.0) {
        const half = Math.sqrt(speed);
        filters.push(`atempo=${half}`);
        filters.push(`atempo=${half}`);
      } else if (speed < 0.5 && speed >= 0.25) {
        const half = Math.sqrt(speed);
        filters.push(`atempo=${half}`);
        filters.push(`atempo=${half}`);
      } else {
        return res.status(400).json({ success: false, error: 'Speed factor must be between 0.25 and 4.0' });
      }
    }

    const ffmpegArgs = ['-i', sourceFile, '-vn', '-af', filters.join(','), ...getCodecArgs(audioPath), '-y', audioPath];

    const ff = spawn('ffmpeg', ffmpegArgs);
    let stderrData = '';
    ff.stderr.on('data', (d) => { stderrData += d.toString(); });

    ff.on('close', (code) => {
      if (code === 0) {
        res.json({ success: true, filename, start: trimStart, end: trimEnd, speedFactor, message: 'Edit applied' });
      } else {
        console.error('ffmpeg combined edit error:', stderrData);
        res.status(500).json({ success: false, error: `ffmpeg exited with code ${code}` });
      }
    });
  } catch (error) {
    console.error('modifyAudioTrimAndSpeedCombined error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  modifyAudioTrim,
  batchModifyAudioTrim,
  modifyAudioTrimAndSpeedCombined,
};

