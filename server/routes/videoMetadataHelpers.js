/**
 * Video/audio metadata helpers for media routes.
 */

const { spawn } = require('child_process');
const { getFfprobePath } = require('../services/shared/ffmpegUtils');

/**
 * Get video and audio metadata using ffprobe (JSON parsing for robustness)
 */
function getVideoDimensions(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = getFfprobePath();
    const ff = spawn(ffprobePath, [
      '-v', 'error',
      '-show_streams',
      '-show_format',
      '-of', 'json',
      videoPath
    ]);

    let out = '';
    let err = '';
    // A spawn failure (e.g. ffprobe missing/unlaunchable) emits 'error'. Without this handler the
    // unhandled event would crash the entire server process; reject the promise instead.
    ff.on('error', (spawnErr) => {
      reject(new Error(`Failed to launch ffprobe (${ffprobePath}): ${spawnErr.message}`));
    });
    ff.stdout.on('data', d => { out += d.toString(); });
    ff.stderr.on('data', d => { err += d.toString(); });
    ff.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffprobe error: ${err}`);
        return reject(new Error(`ffprobe failed with code ${code}: ${err}`));
      }
      let data;
      try {
        data = JSON.parse(out);
      } catch (e) {
        return reject(new Error('Failed to parse ffprobe JSON output'));
      }

      const streams = Array.isArray(data.streams) ? data.streams : [];
      const format = data.format || {};

      const vStream = streams.find(s => s.codec_type === 'video');
      if (!vStream || !Number.isFinite(parseInt(vStream.width)) || !Number.isFinite(parseInt(vStream.height))) {
        return reject(new Error('Invalid video dimensions'));
      }
      const widthNum = parseInt(vStream.width);
      const heightNum = parseInt(vStream.height);

      // FPS from avg_frame_rate or r_frame_rate
      let fps = null;
      const rate = vStream.avg_frame_rate || vStream.r_frame_rate;
      if (rate && rate.includes('/')) {
        const [num, den] = rate.split('/').map(n => parseFloat(n));
        if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) fps = Math.round((num / den) * 100) / 100;
      } else if (rate && Number.isFinite(parseFloat(rate))) {
        fps = Math.round(parseFloat(rate) * 100) / 100;
      }

      // Duration: prefer format.duration, fallback to stream.duration
      let duration = null;
      if (format.duration && Number.isFinite(parseFloat(format.duration))) duration = parseFloat(format.duration);
      else if (vStream.duration && Number.isFinite(parseFloat(vStream.duration))) duration = parseFloat(vStream.duration);

      // Bitrate (video stream)
      let vBitRate = null;
      if (vStream.bit_rate && Number.isFinite(parseInt(vStream.bit_rate))) vBitRate = parseInt(vStream.bit_rate);

      // Quality from height
      let quality = 'Unknown';
      let resolution = 'Unknown';
      if (heightNum >= 2160) { quality = '4K'; resolution = '4K'; }
      else if (heightNum >= 1440) { quality = '1440p'; resolution = '1440p'; }
      else if (heightNum >= 1080) { quality = '1080p'; resolution = '1080p'; }
      else if (heightNum >= 720) { quality = '720p'; resolution = '720p'; }
      else if (heightNum >= 480) { quality = '480p'; resolution = '480p'; }
      else if (heightNum >= 360) { quality = '360p'; resolution = '360p'; }
      else { quality = `${heightNum}p`; resolution = `${heightNum}p`; }

      // Audio stream
      const aStream = streams.find(s => s.codec_type === 'audio');
      const aCodec = aStream?.codec_name || null;
      const aChannels = aStream?.channels;
      const aSampleRate = aStream?.sample_rate ? parseInt(aStream.sample_rate) : null;
      const aLayout = aStream?.channel_layout || null;
      const aBitRate = aStream?.bit_rate ? parseInt(aStream.bit_rate) : null;

      resolve({
        width: widthNum,
        height: heightNum,
        duration,
        fps,
        codec: vStream.codec_name || null,
        bit_rate: vBitRate,
        quality,
        resolution,
        audio_codec: aCodec,
        audio_channels: Number.isFinite(parseInt(aChannels)) ? parseInt(aChannels) : null,
        audio_sample_rate: aSampleRate,
        audio_channel_layout: aLayout,
        audio_bit_rate: Number.isFinite(aBitRate) ? aBitRate : null
      });
    });

    setTimeout(() => {
      try { ff.kill(); } catch {}
      reject(new Error('ffprobe timeout'));
    }, 10000);
  });
}

module.exports = { getVideoDimensions };
