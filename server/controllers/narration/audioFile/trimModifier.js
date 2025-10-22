/**
 * Module for trimming audio files using ffmpeg
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Import directory paths
const { OUTPUT_AUDIO_DIR } = require('../directoryManager');

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
 * Ensure we have a dedicated "backup_for_trim" created after any speed adjustments,
 * and return it as the immutable source for trimming. If it doesn't exist yet (no speed done),
 * create it from the current audio file before performing the first trim.
 */
const ensureBackupAndGetSource = (filename) => {
  const audioPath = path.join(OUTPUT_AUDIO_DIR, filename);
  const dir = path.dirname(filename);
  const base = path.basename(filename);

  // Preferred source for trim: backup_for_trim_<filename>
  const trimBackupFilename = `${dir}/backup_for_trim_${base}`;
  const trimBackupPath = path.join(OUTPUT_AUDIO_DIR, trimBackupFilename);

  if (!fs.existsSync(trimBackupPath) && fs.existsSync(audioPath)) {
    // First time trimming (or speed hasn't created the trim backup yet): create it now
    fs.mkdirSync(path.dirname(trimBackupPath), { recursive: true });
    fs.copyFileSync(audioPath, trimBackupPath);
  }

  return fs.existsSync(trimBackupPath)
    ? { sourceFile: trimBackupPath, audioPath }
    : { sourceFile: audioPath, audioPath }; // Fallback (shouldn't happen if audio exists)
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

module.exports = {
  modifyAudioTrim,
  batchModifyAudioTrim,
};

