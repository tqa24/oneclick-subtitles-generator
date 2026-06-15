// High-DPI canvas + multi-resolution waveform utilities (pure, no component deps)

// High-DPI canvas utilities for crisp rendering at any zoom level
export const getDevicePixelRatio = () => window.devicePixelRatio || 1;

export const setupHighDPICanvas = (canvas, width, height) => {
  const dpr = getDevicePixelRatio();
  // Set actual canvas size in memory (scaled up for high-DPI)
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  // Scale the canvas back down using CSS
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale the drawing context so everything draws at the correct size
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  return ctx;
};

// Efficient waveform data structure for multi-resolution rendering
export class WaveformLOD {
  constructor(audioData, maxLevels = 8) {
    this.levels = [];
    this.maxLevels = maxLevels;
    this.buildLODLevels(audioData);
  }

  buildLODLevels(audioData) {
    // Level 0: Original data
    this.levels[0] = audioData;

    // Build progressively lower resolution levels
    for (let level = 1; level < this.maxLevels; level++) {
      const prevLevel = this.levels[level - 1];
      const newLength = Math.max(Math.floor(prevLevel.length / 2), 1);
      const newLevel = new Float32Array(newLength);

      for (let i = 0; i < newLength; i++) {
        const start = i * 2;
        const end = Math.min(start + 2, prevLevel.length);

        // Use RMS for downsampling to preserve peaks
        let sum = 0;
        for (let j = start; j < end; j++) {
          sum += prevLevel[j] * prevLevel[j];
        }
        newLevel[i] = Math.sqrt(sum / (end - start));
      }

      this.levels[level] = newLevel;
    }
  }

  // Get the appropriate LOD level based on zoom and available pixels
  getLODLevel(samplesPerPixel) {
    // Choose LOD level based on how many samples we're trying to fit per pixel
    let level = 0;
    while (level < this.maxLevels - 1 && samplesPerPixel > Math.pow(2, level + 1)) {
      level++;
    }
    return this.levels[level];
  }
}

// Decode with timeout to avoid hanging on problematic sources
export function decodeWithTimeout(audioContext, arrayBuffer, timeoutMs = 30000) {
  return Promise.race([
    audioContext.decodeAudioData(arrayBuffer),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Audio decode timed out')), timeoutMs))
  ]);
}
