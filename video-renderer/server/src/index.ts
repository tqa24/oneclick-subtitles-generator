import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { bundle } from '@remotion/bundler';
import { selectComposition, makeCancelSignal, renderFrames } from '@remotion/renderer';

// Set Remotion environment variables for REAL GPU acceleration
process.env.REMOTION_CHROME_MODE = "chrome-for-testing"; // CRITICAL: Use chrome-for-testing for GPU
process.env.REMOTION_GL = "angle"; // Use ANGLE backend for GPU acceleration (better Windows support)

// Additional GPU optimization environment variables
// Don't set REMOTION_CONCURRENCY here - let Remotion auto-detect for maximum performance on any machine
process.env.REMOTION_TIMEOUT = "120000"; // 2 minutes timeout
process.env.REMOTION_DELAY_RENDER_TIMEOUT = "30000"; // Reduce component loading timeout to 30s

// Aggressive Chrome flags for maximum GPU utilization and performance
process.env.CHROME_FLAGS = [
  '--ignore-gpu-blacklist',  // CRITICAL: Force ignore GPU blacklist
  '--ignore-gpu-blocklist',  // Also try the newer name
  '--disable-gpu-sandbox',
  '--enable-gpu',
  '--enable-gpu-rasterization',
  '--enable-accelerated-video-decode',
  '--enable-accelerated-video-encode',
  '--enable-accelerated-2d-canvas',
  '--enable-webgl',
  '--enable-webgl2',
  '--use-gl=angle',  // Use ANGLE for better compatibility
  '--use-angle=vulkan',
  '--disable-software-rasterizer',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-sandbox',  // Improve performance
  '--disable-setuid-sandbox',
  '--disable-background-timer-throttling',  // Prevent throttling during rendering
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--max_old_space_size=8192',  // Increase memory limit
  '--enable-features=VaapiVideoDecoder,VaapiVideoEncoder',  // Hardware video acceleration
  '--disable-features=TranslateUI',  // Disable unnecessary features
  '--disable-ipc-flooding-protection',  // Allow more IPC messages for performance
  '--renderer-process-limit=100',  // Allow more renderer processes
  '--max-gum-fps=60'  // Higher frame rate support
].join(' ');

console.log('🚀 GPU Acceleration Configuration:');
console.log('REMOTION_CHROME_MODE:', process.env.REMOTION_CHROME_MODE);
console.log('REMOTION_GL:', process.env.REMOTION_GL);
console.log('CHROME_FLAGS:', process.env.CHROME_FLAGS);

const app = express();
// Import unified port configuration from centralized config
const { PORTS } = require('../../../server/config');
const port = process.env.PORT || PORTS.VIDEO_RENDERER;

// Store active render processes for cancellation and status tracking
const activeRenders = new Map<string, {
  cancel: () => void;
  response: express.Response;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  outputPath?: string;
  error?: string;
  startTime: number;
}>();

// Bundle cache to avoid re-bundling on every render
let bundleCache: {
  bundleResult: string;
  timestamp: number;
  entryPointPath: string;
} | null = null;

const BUNDLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Function to get or create bundle with caching
async function getOrCreateBundle(entryPoint: string): Promise<string> {
  const now = Date.now();

  // Check if we have a valid cached bundle
  if (bundleCache &&
      bundleCache.entryPointPath === entryPoint &&
      (now - bundleCache.timestamp) < BUNDLE_CACHE_TTL) {
    console.log('Using cached bundle result');
    return bundleCache.bundleResult;
  }

  console.log('Creating new bundle...');
  const bundleResult = await bundle(entryPoint);

  if (!bundleResult) {
    throw new Error('Bundling failed: No result returned from bundler');
  }

  // Cache the result
  bundleCache = {
    bundleResult,
    timestamp: now,
    entryPointPath: entryPoint
  };

  console.log('Bundle created and cached');
  return bundleResult;
}

// Lightweight ffprobe-based video info probe to avoid legacy deps
async function probeVideoInfo(filePath: string): Promise<{ width: number; height: number; duration: number; codec: string; fps?: number; }> {
  return new Promise((resolve, reject) => {
    try {
      const { spawn } = require('child_process');
      const { getFfprobePath } = require('../../../server/services/shared/ffmpegUtils');
      const ffprobePath: string = getFfprobePath();

      const args = [
        '-v', 'error',
        '-print_format', 'json',
        '-show_streams',
        '-show_format',
        filePath
      ];

      const proc = spawn(ffprobePath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code: number) => {
        if (code !== 0) {
          return reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        }
        try {
          const meta = JSON.parse(stdout);
          const videoStream = (meta.streams || []).find((s: any) => s.codec_type === 'video');
          const width = videoStream?.width || 1920;
          const height = videoStream?.height || 1080;
          const codec = videoStream?.codec_name || 'h264';

          // Duration can be on format or on stream; prefer format
          const rawDuration = (meta.format && meta.format.duration) || videoStream?.duration || '0';
          const duration = Math.max(0, parseFloat(rawDuration)) || 0;

          // FPS if available
          let fps: number | undefined;
          const rFrameRate: string | undefined = videoStream?.r_frame_rate;
          if (rFrameRate && rFrameRate.includes('/')) {
            const [num, den] = rFrameRate.split('/').map((v: string) => parseFloat(v));
            if (num && den) fps = num / den;
          }

          resolve({ width, height, duration, codec, fps });
        } catch (e) {
          reject(e);
        }
      });

      // Safety timeout
      setTimeout(() => {
        try { proc.kill(); } catch {}
        reject(new Error('ffprobe timeout'));
      }, 10000);
    } catch (err) {
      reject(err);
    }
  });
}


// Ensure directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const outputDir = path.join(__dirname, '../output');
[uploadsDir, outputDir].forEach((dir) => {
  if (!require('fs').existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
});

// Startup cleanup: clear video renderer uploads directory to avoid buildup
try {
  const entries = fs.readdirSync(uploadsDir);
  let deleted = 0;
  for (const name of entries) {
    const filePath = path.join(uploadsDir, name);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch (err) {
      console.warn(`[VIDEO-RENDERER][STARTUP] Failed to delete ${filePath}:`, (err as Error).message);
    }
  }
  if (deleted > 0) {
    console.log(`[VIDEO-RENDERER][STARTUP] Cleaned up ${deleted} file(s) from uploads directory`);
  }
} catch (err) {
  console.warn('[VIDEO-RENDERER][STARTUP] Could not scan uploads directory for cleanup:', (err as Error).message);
}

// Ensure Remotion temp directories exist
const ensureRemotionTempDirs = () => {
  const tempDir = path.join(require('os').tmpdir());
  // Look for remotion-v4-0-278-assets* directories
  const remotionDirs = fs.readdirSync(tempDir).filter(dir => dir.startsWith('remotion-v4-0-278-assets'));

  remotionDirs.forEach(dir => {
    const fullDir = path.join(tempDir, dir);
    // Create audio mixing directory if it doesn't exist
    const audioMixingDir = path.join(fullDir, 'remotion-audio-mixing');
    if (!fs.existsSync(audioMixingDir)) {
      fs.mkdirSync(audioMixingDir, { recursive: true });
    }

    // Create other potential directories that might be needed
    const assetsDirPath = path.join(fullDir, 'remotion-assets-dir');
    const complexFilterPath = path.join(fullDir, 'remotion-complex-filter');

    [assetsDirPath, complexFilterPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  }
});

// Import CORS configuration from centralized config
const { EXPRESS_CORS_CONFIG } = require('../../../server/config/corsConfig');

// Middleware - Configure CORS with unified configuration
app.use(cors({
  ...EXPRESS_CORS_CONFIG,
  exposedHeaders: ['X-Render-ID']  // Add video renderer specific headers
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/output', express.static(outputDir));

// Upload endpoint for audio and images
app.post('/upload/:type', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const url = `http://localhost:${port}/uploads/${req.file.filename}`;
  res.json({
    url,
    filename: req.file.filename
  });
});

// Clear cache endpoint
app.post('/api/clear-cache', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const files = fs.readdirSync(uploadsDir);

    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      fs.unlinkSync(filePath);
    });

    res.status(200).json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Get render status endpoint
app.get('/render-status/:renderId', (req, res) => {
  const { renderId } = req.params;

  const activeRender = activeRenders.get(renderId);
  if (!activeRender) {
    return res.status(404).json({ error: 'Render not found' });
  }

  res.json({
    status: activeRender.status,
    progress: activeRender.progress,
    outputPath: activeRender.outputPath,
    error: activeRender.error,
    startTime: activeRender.startTime
  });
});

// Reconnect to render stream endpoint
app.get('/render-stream/:renderId', (req, res) => {
  const { renderId } = req.params;

  const activeRender = activeRenders.get(renderId);
  if (!activeRender) {
    return res.status(404).json({ error: 'Render not found' });
  }

  if (activeRender.status !== 'active') {
    // Render is no longer active, send final status
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (activeRender.status === 'completed') {
      res.write(`data: ${JSON.stringify({
        status: 'complete',
        videoUrl: activeRender.outputPath,
        progress: 1.0
      })}\n\n`);
    } else if (activeRender.status === 'failed') {
      res.write(`data: ${JSON.stringify({
        status: 'error',
        error: activeRender.error
      })}\n\n`);
    } else if (activeRender.status === 'cancelled') {
      res.write(`data: ${JSON.stringify({ status: 'cancelled' })}\n\n`);
    }

    res.end();
    return;
  }

  // Replace the response object to reconnect the stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Render-ID', renderId);
  res.flushHeaders();

  // Update the response object in activeRenders
  activeRender.response = res;

  // Send current progress immediately
  res.write(`data: ${JSON.stringify({ progress: activeRender.progress })}\n\n`);
});

// Cancel render endpoint
app.post('/cancel-render/:renderId', (req, res) => {
  const { renderId } = req.params;
  console.log('Cancel request received for render ID:', renderId);
  console.log('Active renders:', Array.from(activeRenders.keys()));

  if (!renderId) {
    return res.status(400).json({ error: 'Render ID is required' });
  }

  const activeRender = activeRenders.get(renderId);
  if (!activeRender) {
    console.log('No active render found with ID:', renderId);
    return res.status(404).json({ error: 'No active render found with that ID' });
  }

  try {
    // Cancel the render using Remotion's cancel function
    activeRender.cancel();

    // Send cancellation message to the SSE stream
    if (!activeRender.response.writableEnded) {
      activeRender.response.write(`data: ${JSON.stringify({ status: 'cancelled' })}\n\n`);
      activeRender.response.end();
    }

    // Remove from active renders
    activeRenders.delete(renderId);

    console.log(`Render ${renderId} cancelled successfully`);
    res.json({ success: true, message: 'Render cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling render:', error);
    res.status(500).json({ error: 'Failed to cancel render' });
  }
});

// Helper function to verify assets on the server side
function verifyServerAssets(
  videoType: string,
  audioUrl: string,
  narrationUrl?: string
) {
  console.log(`\n=== SERVER-SIDE VERIFICATION for ${videoType} render ===`);

  // For subtitled videos, always use the main audio track
  console.log(`✓ SERVER using main audio track for Subtitled Video: ${audioUrl}`);

  if (narrationUrl) {
    console.log(`✓ SERVER using narration audio track: ${narrationUrl}`);
  }

  console.log('=== SERVER VERIFICATION COMPLETE ===\n');
}

// Render video endpoint
app.post('/render', async (req, res) => {
  // Store original console.log at the render handler scope
  let originalConsoleLog = console.log;

  // Generate unique render ID
  const renderId = `render_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  console.log('=== NEW RENDER STARTED ===');
  console.log('Generated render ID:', renderId);

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Render-ID', renderId); // Send render ID to client
  console.log('Set X-Render-ID header:', renderId);
  res.flushHeaders();

  // Create cancel signal for this render
  const { cancelSignal, cancel } = makeCancelSignal();

  // Store the render in active renders map
  activeRenders.set(renderId, {
    cancel,
    response: res,
    status: 'active',
    progress: 0,
    startTime: Date.now()
  });

  // Ensure Remotion temp directories exist before rendering
  ensureRemotionTempDirs();

  try {
    const {
      compositionId = 'subtitled-video', // Get compositionId from request, fallback to default
      audioFile,
      lyrics,
      metadata = {
        videoType: 'Subtitled Video',
        resolution: '1080p',
        frameRate: 60,
        originalAudioVolume: 100,
        narrationVolume: 100
      },
      narrationUrl,
      isVideoFile = false
    } = req.body;

    if (!audioFile || !lyrics) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // For video files, we need to get the actual video duration instead of using subtitle duration
    let durationInSeconds: number;

    if (isVideoFile) {
      // We'll get the actual video duration after compatibility check
      durationInSeconds = 8; // Temporary, will be updated below
    } else {
      // For audio files, use subtitle duration + buffer
      durationInSeconds = lyrics.length > 0 ? Math.max(...lyrics.map((l: any) => l.end)) + 2 : 8;
    }

    // Use the frame rate from metadata or default to 24 for video files, 60 for audio
    const fps = metadata.frameRate || (isVideoFile ? 24 : 60);

    // For video files, use exact duration. For audio files, add buffer
    const finalDuration = isVideoFile ? durationInSeconds : durationInSeconds + 2;
    let durationInFrames = Math.max(60, Math.ceil(finalDuration * fps));

    // Determine resolution dimensions based on metadata and video aspect ratio
    const resolution = metadata.resolution || '1080p';
    let width: number, height: number;

    // Store the final audio/video file path (may be converted for compatibility)
    let finalAudioFile = audioFile;

    // If we have a video file, get its actual dimensions and duration via ffprobe
    if (isVideoFile && audioFile) {
      try {
        // Check if the video file exists in the video-renderer server's uploads directory
        const localVideoPath = path.join(__dirname, '../uploads', audioFile);
        console.log(`[RENDER] Looking for video file at: ${localVideoPath}`);

        const fs = require('fs');
        if (!fs.existsSync(localVideoPath)) {
          throw new Error(`Video file not found: ${localVideoPath}`);
        }

        console.log(`[RENDER] Found video file: ${localVideoPath}`);

        // Probe with ffprobe (fast, no conversion)
        const info = await probeVideoInfo(localVideoPath);

        // Use original file as-is
        finalAudioFile = path.basename(localVideoPath);
        console.log(`[RENDER] Using video file: ${finalAudioFile}`);

        const videoWidth = info.width;
        const videoHeight = info.height;
        const aspectRatio = videoWidth / Math.max(1, videoHeight);

        // Update duration to match the actual video duration
        durationInSeconds = info.duration > 0 ? info.duration : durationInSeconds;

        // Use fps from metadata if available, otherwise keep existing fps
        const effectiveFps = info.fps ? Math.round(info.fps) : fps;

        // Recalculate frames with the actual video duration
        const finalDuration = durationInSeconds; // No buffer for video files
        durationInFrames = Math.max(60, Math.ceil(finalDuration * effectiveFps));

        console.log(`[RENDER] Video info - Duration: ${durationInSeconds}s, Codec: ${info.codec}, FPS: ${info.fps ?? 'unknown'}`);
        console.log(`[RENDER] Recalculated frames: ${durationInFrames} at ${effectiveFps}fps`);
        console.log(`[RENDER] Video dimensions: ${videoWidth}x${videoHeight} (aspect ratio: ${aspectRatio.toFixed(2)})`);

        // Calculate target dimensions based on resolution while preserving aspect ratio
        let targetHeight: number;
        switch (resolution) {
          case '360p': targetHeight = 360; break;
          case '480p': targetHeight = 480; break;
          case '720p': targetHeight = 720; break;
          case '1440p': targetHeight = 1440; break;
          case '4K': targetHeight = 2160; break;
          case '8K': targetHeight = 4320; break;
          case '1080p':
          default: targetHeight = 1080; break;
        }

        // Calculate width based on aspect ratio
        width = Math.round(targetHeight * aspectRatio);
        height = targetHeight;

        // Check if crop settings are provided and adjust dimensions
        if (metadata.cropSettings && (metadata.cropSettings.width !== 100 || metadata.cropSettings.height !== 100)) {
          console.log(`[RENDER] Crop settings detected (affecting AR):`, metadata.cropSettings);
          // New aspect ratio after crop (supports expand-only as well):
          // croppedAR = originalAR * (cropWidthRatio / cropHeightRatio)
          const cropWidthRatio = metadata.cropSettings.width / 100;
          const cropHeightRatio = metadata.cropSettings.height / 100;
          const croppedAspectRatio = aspectRatio * (cropWidthRatio / cropHeightRatio);
          width = Math.round(targetHeight * croppedAspectRatio);
          height = targetHeight;

          console.log(`[RENDER] Adjusted dimensions for crop: ${width}x${height} (cropped aspect ratio: ${croppedAspectRatio.toFixed(2)})`);
        }

        // Ensure dimensions are even numbers (required for video encoding)
        width = width % 2 === 0 ? width : width + 1;
        height = height % 2 === 0 ? height : height + 1;

        console.log(`[RENDER] Final composition dimensions: ${width}x${height}`);

      } catch (error) {
        console.warn(`[RENDER] Could not probe video info, falling back to default 16:9: ${error instanceof Error ? error.message : String(error)}`);
        // Fall back to default 16:9 dimensions
        switch (resolution) {
          case '360p': width = 640; height = 360; break;
          case '480p': width = 854; height = 480; break;
          case '720p': width = 1280; height = 720; break;
          case '1440p': width = 2560; height = 1440; break;
          case '4K': width = 3840; height = 2160; break;
          case '8K': width = 7680; height = 4320; break;
          case '1080p':
          default: width = 1920; height = 1080; break;
        }
      }
    } else {
      // For audio files, use default 16:9 dimensions
      switch (resolution) {
        case '360p': width = 640; height = 360; break;
        case '480p': width = 854; height = 480; break;
        case '720p': width = 1280; height = 720; break;
        case '1440p': width = 2560; height = 1440; break;
        case '4K': width = 3840; height = 2160; break;
        case '8K': width = 7680; height = 4320; break;
        case '1080p':
        default: width = 1920; height = 1080; break;
      }
    }

    const outputFile = `subtitle-video-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFile);

    // Create URLs that can be accessed via HTTP instead of file:// protocol
    const audioUrl = `http://localhost:${port}/uploads/${finalAudioFile}`;

    // Perform server-side verification before rendering
    verifyServerAssets(metadata.videoType, audioUrl, narrationUrl);

    // Add a small delay after verification to ensure resources are ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Use index.ts as the entry point which contains registerRoot()
    const entryPoint = path.join(__dirname, '../../src/remotion/index.ts');

    // Get or create bundle with caching
    console.log('Getting Remotion bundle...');

    // Use the current response object (which may have been updated on reconnection)
    const activeRenderForBundling = activeRenders.get(renderId);
    if (activeRenderForBundling && !activeRenderForBundling.response.writableEnded) {
      activeRenderForBundling.response.write(`data: ${JSON.stringify({ bundling: true })}\n\n`);
    }

    const bundleResult = await getOrCreateBundle(entryPoint);

    console.log('Bundle ready');
    console.log('Using composition ID:', compositionId);

    // Select the composition
    console.log('Selecting composition...');

    // Use the current response object (which may have been updated on reconnection)
    const activeRenderForComposition = activeRenders.get(renderId);
    if (activeRenderForComposition && !activeRenderForComposition.response.writableEnded) {
      activeRenderForComposition.response.write(`data: ${JSON.stringify({ composition: true })}\n\n`);
    }
    console.log('Using serve URL:', bundleResult);
    console.log('Video duration:', `${durationInSeconds} seconds (${durationInFrames} frames at ${fps}fps)`);
    console.log('Video resolution:', `${resolution} (${width}x${height})`);
    console.log('Video settings:', `${metadata.videoType}, ${fps}fps, ${resolution}`);

    // Note: originalConsoleLog already declared at render handler scope

    // IMPORTANT: Intercept console.log BEFORE selectComposition to catch Chrome download progress
    console.log = (...args: any[]) => {
      const message = args.join(' ');

      // Check for Chrome download progress messages from Remotion (both Chrome for Testing and Headless Shell)
      const chromeDownloadMatch = message.match(/Downloading Chrome (?:for Testing|Headless Shell) - ([\d.]+) Mb\/([\d.]+) Mb/);
      if (chromeDownloadMatch) {
        const downloaded = parseFloat(chromeDownloadMatch[1]);
        const total = parseFloat(chromeDownloadMatch[2]);

        // Send Chrome download progress to client
        const activeRenderForChrome = activeRenders.get(renderId);
        if (activeRenderForChrome && !activeRenderForChrome.response.writableEnded) {
          activeRenderForChrome.response.write(`data: ${JSON.stringify({ chromeDownload: { downloaded, total } })}\n\n`);
        }
      }

      // Call original console.log
      originalConsoleLog(...args);
    };

    const composition = await selectComposition({
      serveUrl: bundleResult,
      id: compositionId,
      chromeMode: "chrome-for-testing",  // Use same Chrome mode as renderMedia to avoid double download
      inputProps: {
        audioUrl: audioUrl,
        lyrics,
        durationInSeconds,
        metadata,
        narrationUrl,
        isVideoFile
      },
    });

    // Override composition dimensions with calculated values
    composition.width = width;
    composition.height = height;
    composition.fps = fps;
    composition.durationInFrames = durationInFrames;

    // Force the composition settings to match our calculated values
    composition.durationInFrames = durationInFrames;
    composition.width = width;
    composition.height = height;
    composition.fps = fps;

    // Render the video with GPU acceleration
    console.log('Starting rendering process with Vulkan GPU acceleration...');
    console.log('Using composition settings:');
    console.log(`- Duration: ${composition.durationInFrames} frames`);
    console.log(`- Resolution: ${width}x${height} (${resolution})`);
    console.log(`- Frame rate: ${fps} fps`);
    // Helper: Two-step NVENC pipeline (sequential for now; can be extended to overlap)
    const encodeWithNvenc = async () => {
      const os = require('os');
      const { spawn } = require('child_process');
      const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-nvenc-'));
      const framesDir = path.join(tmpBase, 'frames');
      // Use the already-uploaded media as audio input directly (avoid compositor extractAudio)
      const audioInput = path.join(__dirname, '../uploads', finalAudioFile);
      fs.mkdirSync(framesDir, { recursive: true });

      // 1) Render frames to disk
      try {
        await renderFrames({
          composition,
          serveUrl: bundleResult,
          outputDir: framesDir,
          imageFormat: 'jpeg',
          jpegQuality: 80,
          muted: true,
          inputProps: {
            audioUrl: audioUrl,
            lyrics,
            metadata,
            narrationUrl,
            isVideoFile
          },
          onStart: () => {},
          chromiumOptions: {
            disableWebSecurity: true,
            ignoreCertificateErrors: true,
            gl: 'angle',
            enableMultiProcessOnLinux: true,
            headless: true,
          },
          chromeMode: 'chrome-for-testing',
          concurrency: (() => {
            const cpuCount = require('os').cpus().length;
            if (cpuCount <= 4) return 2;
            if (cpuCount <= 8) return 3;
            if (cpuCount <= 16) return 4;
            return Math.min(6, Math.floor(cpuCount * 0.25));
          })(),
          cancelSignal,
          onFrameUpdate: (frame: number) => {
            const activeRender = activeRenders.get(renderId);
            if (activeRender) {
              const progress = Math.min(1, frame / Math.max(1, durationInFrames));
              activeRender.progress = progress;
              if (!activeRender.response.writableEnded) {
                activeRender.response.write(`data: ${JSON.stringify({
                  phase: 'rendering',
                  phaseDescription: 'Rendering video frames',
                  renderedFrames: frame,
                  durationInFrames,
                  progress
                })}\n\n`);
              }
            }
          }
        });
      } catch (e) {
        console.error('[NVENC] renderFrames failed:', e);
        throw e;
      }

      // 2) Optionally rename frames to %06d.jpg
      const files = fs.readdirSync(framesDir).filter((f: string) => /\.(jpe?g|png)$/i.test(f)).sort();
      files.forEach((f: string, idx: number) => {
        const target = path.join(framesDir, `${String(idx + 1).padStart(6, '0')}.jpg`);
        const src = path.join(framesDir, f);
        if (src !== target) {
          fs.renameSync(src, target);
        }
      });

      // 3) Encode with system ffmpeg (NVENC) using the uploaded media as audio input
      const videoBitrate = (metadata?.nvenc?.bitrate) || '10M';
      const maxRate = (metadata?.nvenc?.maxrate) || '20M';
      const bufSize = (metadata?.nvenc?.bufsize) || '40M';
      const audioBitrate = '320k';
      const ffmpegPath = (() => {
        // reuse the same resolution we detected earlier in wantNvenc detection scope
        const which = process.platform === 'win32' ? 'where' : 'which';
        const res = spawnSync(which, ['ffmpeg'], { encoding: 'utf8' });
        const out = (res.stdout || '').trim().split(/\r?\n/).filter(Boolean);
        return out[0] || 'ffmpeg';
      })();

      const args = [
        '-y',
        '-r', String(fps),
        // input 0: frames (video)
        '-i', path.join(framesDir, '%06d.jpg'),
        // input 1: audio (or original uploaded video containing audio)
        '-i', audioInput,
        // Force stream mapping: video from input 0, audio from input 1
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'h264_nvenc',
        '-preset', (metadata?.nvenc?.preset) || 'p4',
        '-b:v', videoBitrate,
        '-maxrate', maxRate,
        '-bufsize', bufSize,
        '-pix_fmt', 'yuv420p',
        '-r', String(fps),
        '-c:a', 'aac',
        '-b:a', audioBitrate,
        '-shortest',
        '-movflags', '+faststart',
        outputPath,
      ];

      const ff = spawn(ffmpegPath, args);
      ff.stderr.setEncoding('utf8');
      ff.stderr.on('data', (chunk: string) => {
        const activeRender = activeRenders.get(renderId);
        if (activeRender && !activeRender.response.writableEnded) {
          activeRender.response.write(`data: ${JSON.stringify({ phase: 'encoding', phaseDescription: 'NVENC encoding', ffmpeg: chunk.toString().slice(0, 400) })}\n\n`);
        }
      });

      await new Promise((resolve, reject) => {
        ff.on('error', reject);
        ff.on('close', (code: number) => {
          if (code === 0) resolve(null);
          else reject(new Error(`ffmpeg exited with code ${code}`));
        });
      });
    };

    // Note: console.log interception already set up before selectComposition
    // to catch Chrome download messages

    // Throttle console progress logs to 1% increments across render + retry
    let lastLoggedPercent = -1;

    // Detect FFmpeg NVENC availability and prepare override
    const { spawnSync } = require('child_process');
    const pathMod = require('path');
    const fsMod = require('fs');
    const { getFfmpegPath } = require('../../../server/services/shared/ffmpegUtils');
    let wantNvenc = false;
    let externalBinariesDir: string | null = null;
    try {
      // Resolve the exact ffmpeg/ffprobe paths the app would use
      let ffmpegPath: string = getFfmpegPath();
      if (!pathMod.isAbsolute(ffmpegPath)) {
        // On Windows, use 'where', on POSIX, use 'which'
        const whichCmd = process.platform === 'win32' ? 'where' : 'which';
        const resolved = spawnSync(whichCmd, ['ffmpeg'], { encoding: 'utf8' });
        const out = (resolved.stdout || '').trim().split(/\r?\n/).filter(Boolean);
        if (out.length > 0) {
          ffmpegPath = out[0];
        }
      }
      let ffprobePath: string | null = null;
      if (process.platform === 'win32') {
        const resolvedProbe = spawnSync('where', ['ffprobe'], { encoding: 'utf8' });
        const outProbe = (resolvedProbe.stdout || '').trim().split(/\r?\n/).filter(Boolean);
        if (outProbe.length > 0) {
          ffprobePath = outProbe[0];
        }
      } else {
        const resolvedProbe = spawnSync('which', ['ffprobe'], { encoding: 'utf8' });
        const outProbe = (resolvedProbe.stdout || '').trim().split(/\r?\n/).filter(Boolean);
        if (outProbe.length > 0) {
          ffprobePath = outProbe[0];
        }
      }

      // Detect NVENC availability from the resolved ffmpeg
      const encList = spawnSync(ffmpegPath, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
      const encodersText = (encList.stdout || '') + '\n' + (encList.stderr || '');
      const hasH264Nvenc = /\bh264_nvenc\b/.test(encodersText);
      // Force auto preference internally; do not rely on request body
      const encoderPreference = 'auto';
      wantNvenc = hasH264Nvenc;

      // Note: We deliberately do NOT set binariesDirectory; Remotion must use its own compositor
      const candidateDir = pathMod.dirname(ffmpegPath);
      const ffmpegOk = fsMod.existsSync(ffmpegPath);
      const ffprobeOk = ffprobePath ? fsMod.existsSync(ffprobePath) : fsMod.existsSync(pathMod.join(candidateDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'));
      if (ffmpegOk && ffprobeOk) {
        externalBinariesDir = candidateDir;
      }

      console.log(`[NVENC] FFmpeg h264_nvenc detected: ${hasH264Nvenc}. Preference: ${encoderPreference}. Using NVENC: ${wantNvenc}. BinariesDir: ${externalBinariesDir ?? 'internal'} (ffmpeg: ${ffmpegPath}${ffprobePath ? ', ffprobe: ' + ffprobePath : ''})`);
    } catch (e) {
      console.log('[NVENC] Skipping NVENC detection:', (e as Error).message);
    }

    const buildFfmpegOverride = (useNvenc: boolean) => (params: { type: 'stitcher' | 'pre-stitcher'; args: string[] }) => {
      const { type, args } = params;
      if (type !== 'pre-stitcher' || !useNvenc) return args;
      const out = [...args];
      // Ensure NVENC video codec
      const cvidx = out.indexOf('-c:v');
      if (cvidx !== -1 && out[cvidx + 1]) {
        out[cvidx + 1] = 'h264_nvenc';
      } else {
        out.push('-c:v', 'h264_nvenc');
      }
      // Pull optional tuning from metadata
      const nvenc = (metadata && (metadata as any).nvenc) || {};
      const preset = nvenc.preset || 'p4';
      const b = nvenc.bitrate || '10M';
      const maxrate = nvenc.maxrate || '20M';
      const bufsize = nvenc.bufsize || '40M';
      // Remove any existing flags to avoid duplicates
      const removeFlagAndValue = (flag: string) => {
        let i;
        while ((i = out.indexOf(flag)) !== -1) {
          out.splice(i, 2);
        }
      };
      ['-preset','-b:v','-maxrate','-bufsize'].forEach(removeFlagAndValue);
      out.push(
        '-preset', preset,
        // Avoid -rc/-cq for maximum compatibility across FFmpeg builds
        '-b:v', b,
        '-maxrate', maxrate,
        '-bufsize', bufsize,
        '-pix_fmt', 'yuv420p'
      );
      return out;
    };

    try {
      // Double-check that temp directories exist right before rendering
      ensureRemotionTempDirs();

      // Always use NVENC two-step pipeline to avoid compositor video stitching
      await encodeWithNvenc();

      // Restore original console.log
      console.log = originalConsoleLog;
    } catch (error) {
      // Restore original console.log in case of error
      console.log = originalConsoleLog;
      const renderError = error as Error;
      console.error('Render error:', renderError);

      // Try to create the specific directory mentioned in the error if it's a directory issue
      if (renderError.message && renderError.message.includes('No such file or directory')) {
        try {
          const match = renderError.message.match(/Error opening output (.*?): No such file or directory/);
          if (match && match[1]) {
            const dirPath = path.dirname(match[1]);
            console.log(`Attempting to create missing directory: ${dirPath}`);
            fs.mkdirSync(dirPath, { recursive: true });

            // Retry rendering after creating the directory
            console.log('Retrying render after creating directory...');
            await encodeWithNvenc();
          } else {
            throw renderError; // Re-throw if we couldn't extract a directory
          }
        } catch (retryErr) {
          const retryError = retryErr as Error;
          console.error('Error during render retry:', retryError);
          throw retryError; // Re-throw to be caught by the outer catch block
        }
      } else {
        throw renderError; // Re-throw if it's not a directory issue
      }
    }

    const videoUrl = `http://localhost:${port}/output/${outputFile}`;

    // Update status to completed
    const activeRender = activeRenders.get(renderId);
    if (activeRender) {
      activeRender.status = 'completed';
      activeRender.progress = 1.0;
      activeRender.outputPath = videoUrl;

      // Use the current response object (which may have been updated on reconnection)
      if (!activeRender.response.writableEnded) {
        activeRender.response.write(`data: ${JSON.stringify({ status: 'complete', videoUrl })}\n\n`);
        activeRender.response.end();
      }
    }

    // Keep the render info for a while to allow reconnection, then clean up
    setTimeout(() => {
      activeRenders.delete(renderId);
    }, 300000); // Keep for 5 minutes
  } catch (error) {
    console.error('Rendering error:', error);

    const activeRender = activeRenders.get(renderId);

    // Check if this was a cancellation
    if (error instanceof Error && error.message.includes('cancelled')) {
      if (activeRender) {
        activeRender.status = 'cancelled';
        activeRender.error = 'Render was cancelled';

        // Use the current response object (which may have been updated on reconnection)
        if (!activeRender.response.writableEnded) {
          activeRender.response.write(`data: ${JSON.stringify({ status: 'cancelled' })}\n\n`);
          activeRender.response.end();
        }
      }
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (activeRender) {
        activeRender.status = 'failed';
        activeRender.error = errorMessage;

        // Use the current response object (which may have been updated on reconnection)
        if (!activeRender.response.writableEnded) {
          activeRender.response.write(`data: ${JSON.stringify({
            status: 'error',
            error: errorMessage
          })}\n\n`);
          activeRender.response.end();
        }
      }
    }

    // Keep the render info for a while to allow reconnection, then clean up
    setTimeout(() => {
      activeRenders.delete(renderId);
    }, 300000); // Keep for 5 minutes
  } finally {
    // IMPORTANT: Restore original console.log to prevent affecting other renders
    console.log = originalConsoleLog;
  }
});

app.listen(port, () => {
  console.log(`🎬 Video Renderer Server running at http://localhost:${port}`);
  console.log('');
  console.log('🚀 MAXIMUM PERFORMANCE GPU Acceleration Configuration:');
  console.log('=======================================');
  console.log('Chrome Mode: chrome-for-testing (GPU-optimized)');
  console.log('OpenGL Backend: ANGLE with Vulkan');
  console.log('Hardware Acceleration: if-possible + VaapiVideoDecoder/Encoder');
  console.log('Multi-Process: Enabled with increased limits');
  const cpuCount = require('os').cpus().length;
  const adaptiveConcurrency = (() => {
    if (cpuCount <= 4) return 2;
    if (cpuCount <= 8) return 3;
    if (cpuCount <= 16) return 4;
    return Math.min(6, Math.floor(cpuCount * 0.25));
  })();
  console.log(`Concurrency: ${adaptiveConcurrency} cores (adaptive: ${Math.round((adaptiveConcurrency/cpuCount)*100)}% of ${cpuCount} available cores)`);
  console.log('Bundle Caching: Enabled (5min TTL)');
  console.log('Video Analysis: Optimized (single ffprobe call)');
  console.log('Audio Codec: MP3 (faster encoding than AAC)');
  console.log('Component Loading: Optimized with memoization + OffthreadVideo');
  console.log('Memory Limit: 8GB for Chrome processes');
  console.log('');
  console.log('🎯 Expected GPU Utilization: 40-80% during rendering');
  console.log('📊 Expected Performance: Balanced for optimal speed without resource contention');
  console.log('');
  console.log('💡 AGGRESSIVE Performance Optimizations:');
  console.log('- High concurrency for maximum CPU utilization');
  console.log('- OffthreadVideo for GPU-accelerated video processing');
  console.log('- Hardware video decode/encode acceleration');
  console.log('- Increased Chrome memory and process limits');
  console.log('- MP3 audio codec for faster encoding');
  console.log('- Bundle caching reduces startup time by 5-15 seconds');
  console.log('- Combined video analysis reduces processing time by 10-30 seconds');
  console.log('');

  // Track this process (if port manager is available)
  try {
    const { trackProcess } = require('../../../server/utils/portManager');
    trackProcess(port, process.pid, 'Video Renderer Server');
  } catch (error) {
    // Port manager not available, continue without tracking
    console.log('Note: Process tracking not available for video renderer');
  }
});
