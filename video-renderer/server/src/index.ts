import express from 'express'; 
import cors from 'cors'; 
import multer from 'multer'; 
import fs from 'fs'; 
import path from 'path'; 
import { pathToFileURL } from 'url'; 
import os from 'os'; 
import { spawn, spawnSync } from 'child_process'; 
 
import { bundle } from '@remotion/bundler'; 
import { selectComposition, makeCancelSignal, renderMedia } from '@remotion/renderer'; 
 
// --- AGGRESSIVE GPU ACCELERATION CONFIGURATION --- 
process.env.REMOTION_CHROME_MODE = "chrome-for-testing"; 
process.env.REMOTION_GL = "angle"; 
process.env.REMOTION_TIMEOUT = "120000"; 
process.env.REMOTION_DELAY_RENDER_TIMEOUT = "30000"; 
process.env.CHROME_FLAGS = [ 
  '--ignore-gpu-blacklist', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', 
  '--enable-gpu', '--enable-gpu-rasterization', '--enable-accelerated-video-decode', 
  '--enable-accelerated-video-encode', '--enable-accelerated-2d-canvas', 
  '--enable-webgl', '--enable-webgl2', '--use-gl=angle', '--use-angle=vulkan', 
  '--disable-software-rasterizer', '--disable-dev-shm-usage', '--no-first-run', 
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-background-timer-throttling', 
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', 
  '--max_old_space_size=8192', '--enable-features=VaapiVideoDecoder,VaapiVideoEncoder', 
  '--disable-features=TranslateUI', '--disable-ipc-flooding-protection', 
  '--renderer-process-limit=100', '--max-gum-fps=60' 
].join(' '); 
 
console.log('🚀 GPU Acceleration Configuration Loaded'); 
 
const app = express(); 
const { PORTS } = require('../../../server/config'); 
const port = process.env.PORT || PORTS.VIDEO_RENDERER; 
 
const activeRenders = new Map<string, { 
  cancel: () => void; 
  response: express.Response; 
  status: 'preprocessing' | 'rendering' | 'completed' | 'failed' | 'cancelled'; 
  progress: number; 
  phase: string; 
  outputPath?: string; 
  error?: string; 
  startTime: number; 
}>(); 
 
let bundleCache: { 
  bundleResult: string; 
  timestamp: number; 
  entryPointPath: string; 
} | null = null; 
const BUNDLE_CACHE_TTL = 5 * 60 * 1000; 
 
// --- DIRECTORIES --- 
const uploadsDir = path.join(__dirname, '../uploads'); 
const outputDir = path.join(__dirname, '../output'); 
[uploadsDir, outputDir].forEach((dir) => { 
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); 
}); 
 
// --- HELPER FUNCTIONS --- 
 
const getOrCreateBundle = async (entryPoint: string): Promise<string> => { 
  const now = Date.now(); 
  if (bundleCache && bundleCache.entryPointPath === entryPoint && (now - bundleCache.timestamp) < BUNDLE_CACHE_TTL) { 
    console.log('Using cached bundle.'); 
    return bundleCache.bundleResult; 
  } 
  console.log('Creating new bundle...'); 
  const bundleResult = await bundle(entryPoint); 
  bundleCache = { bundleResult, timestamp: now, entryPointPath: entryPoint }; 
  console.log('Bundle created and cached.'); 
  return bundleResult; 
}; 
 
const probeVideoInfo = async (filePath: string): Promise<{ width: number; height: number; duration: number; fps: number; }> => { 
  return new Promise((resolve, reject) => { 
    const { getFfprobePath } = require('../../../server/services/shared/ffmpegUtils'); 
    const ffprobePath = getFfprobePath(); 
    const args = ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,duration', '-of', 'json', filePath]; 
    const proc = spawn(ffprobePath, args); 
    let stdout = ''; 
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); }); 
    proc.on('close', (code: number) => { 
      if (code !== 0) return reject(new Error(`ffprobe exited with code ${code}`)); 
      try { 
        const meta = JSON.parse(stdout).streams[0]; 
        const [num, den] = meta.r_frame_rate.split('/').map(Number); 
        resolve({ 
          width: meta.width, 
          height: meta.height, 
          duration: parseFloat(meta.duration), 
          fps: num / den 
        }); 
      } catch (e) { 
        reject(e); 
      } 
    }); 
  }); 
}; 
 
const runFfmpeg = ( 
  args: string[], 
  renderId: string, 
  phase: string, 
  totalFrames: number, 
  onProgress: (progress: number) => void 
): Promise<void> => { 
  return new Promise((resolve, reject) => { 
    const { getFfmpegPath } = require('../../../server/services/shared/ffmpegUtils'); 
    const ffmpegPath = getFfmpegPath(); 
    console.log(`[${renderId}] Running FFmpeg for ${phase}: ${ffmpegPath} ${args.join(' ')}`); 
    const proc = spawn(ffmpegPath, args); 
    let lastLoggedPercent = -1; 
 
    proc.stderr.on('data', (chunk) => { 
      const line = chunk.toString(); 
      const frameMatch = line.match(/frame=\s*(\d+)/); 
      if (frameMatch) { 
        const currentFrame = parseInt(frameMatch[1], 10); 
        const progress = Math.min(1, currentFrame / totalFrames); 
        const percent = Math.floor(progress * 100); 
        if (percent > lastLoggedPercent) { 
          onProgress(progress); 
          lastLoggedPercent = percent; 
        } 
      } 
    }); 
 
    proc.on('close', (code) => { 
      if (code === 0) { 
        console.log(`[${renderId}] FFmpeg ${phase} completed successfully.`); 
        resolve(); 
      } else { 
        console.error(`[${renderId}] FFmpeg ${phase} failed with code ${code}.`); 
        reject(new Error(`FFmpeg exited with code ${code}`)); 
      } 
    }); 
 
    proc.on('error', (err) => { 
      console.error(`[${renderId}] Failed to start FFmpeg for ${phase}.`, err); 
      reject(err); 
    }); 
  }); 
}; 
 
// --- MIDDLEWARE --- 
const { EXPRESS_CORS_CONFIG } = require('../../../server/config/corsConfig'); 
app.use(cors({ ...EXPRESS_CORS_CONFIG, exposedHeaders: ['X-Render-ID'] })); 
app.use(express.json({ limit: '50mb' })); 
app.use('/uploads', express.static(uploadsDir)); 
app.use('/output', express.static(outputDir)); 
 
// --- API ENDPOINTS --- 
 
const upload = multer({ storage: multer.diskStorage({ 
  destination: (req, file, cb) => cb(null, uploadsDir), 
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`), 
}), limits: { fileSize: 5 * 1024 * 1024 * 1024 }}); 
 
app.post('/upload/:type', upload.single('file'), (req, res) => { 
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' }); 
  res.json({ url: `http://localhost:${port}/uploads/${req.file.filename}`, filename: req.file.filename }); 
}); 
 
app.get('/render-status/:renderId', (req, res) => { 
  const render = activeRenders.get(req.params.renderId); 
  if (!render) return res.status(404).json({ error: 'Render not found' }); 
  res.json({ status: render.status, progress: render.progress, phase: render.phase, outputPath: render.outputPath, error: render.error }); 
}); 
 
app.post('/cancel-render/:renderId', (req, res) => {
  const render = activeRenders.get(req.params.renderId);
  if (!render) return res.status(404).json({ error: 'Render not found' });
  render.cancel();
  res.json({ success: true, message: 'Render cancellation initiated.' });
});

// --- THE NEW HIGH-PERFORMANCE RENDER ENDPOINT ---
app.post('/render', async (req, res) => {
  const renderId = `render_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${renderId}] === NEW RENDER STARTED ===`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Render-ID', renderId);
  res.flushHeaders();

  const { cancel, cancelSignal } = makeCancelSignal();
  const updateStatus = (statusUpdate: Partial<typeof activeRenders extends Map<string, infer V> ? V : never>) => {
      const current = activeRenders.get(renderId);
      if (current) {
          activeRenders.set(renderId, { ...current, ...statusUpdate });
          if (!current.response.writableEnded) {
              current.response.write(`data: ${JSON.stringify({
                  status: statusUpdate.status || current.status,
                  phase: statusUpdate.phase || current.phase,
                  progress: statusUpdate.progress ?? current.progress,
              })}\n\n`);
          }
      }
  };

  activeRenders.set(renderId, { cancel, response: res, status: 'preprocessing', progress: 0, phase: 'Initializing', startTime: Date.now() });

  let tempDir: string | null = null;

  try {
    const {
      compositionId = 'subtitled-video',
      audioFile,
      lyrics,
      metadata = {},
      narrationUrl,
      isVideoFile = false
    } = req.body;

    if (!audioFile || !lyrics) throw new Error('Missing required parameters: audioFile, lyrics');

    const entryPoint = path.join(__dirname, '../../src/remotion/index.ts');
    updateStatus({ phase: 'Bundling Remotion app' });
    const bundleResult = await getOrCreateBundle(entryPoint);

    let compositionProps: any = { lyrics, metadata, narrationUrl, isVideoFile, audioUrl: `http://localhost:${port}/uploads/${audioFile}` };
    let finalAudioPath: string | undefined = path.join(uploadsDir, audioFile);
    let width: number, height: number, fps: number, durationInFrames: number;

    if (isVideoFile) {
      // --- HIGH-PERFORMANCE VIDEO PIPELINE ---
      const sourceVideoPath = path.join(uploadsDir, audioFile);
      if (!fs.existsSync(sourceVideoPath)) throw new Error(`Source video not found: ${audioFile}`);

      updateStatus({ phase: 'Probing video info' });
      const info = await probeVideoInfo(sourceVideoPath);
      width = info.width;
      height = info.height;
      fps = metadata.frameRate || info.fps; // Allow override, but default to source FPS
      durationInFrames = Math.ceil(info.duration * fps);
      console.log(`[${renderId}] Video Info: ${width}x${height} @ ${fps.toFixed(2)}fps, ${durationInFrames} frames`);

      // Create a dedicated temporary directory for this render
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `remotion-render-${renderId}-`));
      const framesDir = path.join(tempDir, 'frames');
      const extractedAudioFile = path.join(tempDir, 'audio.aac');
      fs.mkdirSync(framesDir);

      // 1. Extract Frames
      updateStatus({ phase: 'Extracting video frames', progress: 0 });
      const frameExtractionArgs = ['-i', sourceVideoPath, '-vf', `fps=${fps}`, path.join(framesDir, '%06d.jpg')];
      await runFfmpeg(frameExtractionArgs, renderId, 'Frame Extraction', durationInFrames, (p) => {
        updateStatus({ progress: p * 0.4 }); // Extraction is ~40% of the work
      });

      // 2. Extract Audio
      updateStatus({ phase: 'Extracting audio track', progress: 0.4 });
      const audioExtractionArgs = ['-i', sourceVideoPath, '-vn', '-c:a', 'aac', '-b:a', '256k', extractedAudioFile];
      await runFfmpeg(audioExtractionArgs, renderId, 'Audio Extraction', durationInFrames, () => {}); // No frame progress for audio
      finalAudioPath = extractedAudioFile;

      // Update props for Remotion to use the extracted frames
      compositionProps.framesPathUrl = `http://localhost:${port}/temp/${path.basename(tempDir)}/frames`;
      app.use(`/temp/${path.basename(tempDir)}`, express.static(tempDir)); // Serve the temp dir
      updateStatus({ progress: 0.5, status: 'rendering', phase: 'Preparing Remotion render' });

    } else {
      // --- STANDARD AUDIO-ONLY PIPELINE ---
      const durationInSeconds = lyrics.length > 0 ? Math.max(...lyrics.map((l: any) => l.end)) + 2 : 8;
      fps = metadata.frameRate || 60;
      durationInFrames = Math.ceil(durationInSeconds * fps);
      width = 1920;
      height = 1080;
    }

    const outputFile = `video-${renderId}.mp4`;
    const outputPath = path.join(outputDir, outputFile);

    const composition = await selectComposition({ serveUrl: bundleResult, id: compositionId, inputProps: compositionProps });

    console.log(`[${renderId}] Starting Remotion render...`);
    await renderMedia({
      composition: { ...composition, width, height, fps, durationInFrames },
      serveUrl: bundleResult,
      outputLocation: outputPath,
      inputProps: compositionProps,
      audioFilePath: finalAudioPath,
      ...(narrationUrl && { secondAudioFilePath: path.join(uploadsDir, path.basename(narrationUrl)) }),
      codec: 'h264',
      onProgress: ({ progress }) => {
        // This progress is for the Remotion part, which is the latter 50% of the total job
        updateStatus({ progress: 0.5 + progress * 0.5 });
      },
      cancelSignal,
    });

    const videoUrl = `http://localhost:${port}/output/${outputFile}`;
    console.log(`[${renderId}] Render completed: ${videoUrl}`);

    const finalRenderState = activeRenders.get(renderId);
    if(finalRenderState) {
        finalRenderState.status = 'completed';
        finalRenderState.progress = 1.0;
        finalRenderState.outputPath = videoUrl;
        finalRenderState.phase = 'Done';
        if (!finalRenderState.response.writableEnded) {
            finalRenderState.response.write(`data: ${JSON.stringify({ status: 'complete', videoUrl, progress: 1.0 })}\n\n`);
            finalRenderState.response.end();
        }
    }

    setTimeout(() => activeRenders.delete(renderId), 300000); // Keep for 5 mins for status checks

  } catch (err) {
    const error = err as Error;
    console.error(`[${renderId}] Rendering failed:`, error.stack);
    const render = activeRenders.get(renderId);
    if (render) {
        const isCancelled = error.message.includes('Render was cancelled');
        render.status = isCancelled ? 'cancelled' : 'failed';
        render.error = error.message;
        render.phase = isCancelled ? 'Cancelled' : 'Error';
        if (!render.response.writableEnded) {
            render.response.write(`data: ${JSON.stringify({ status: render.status, error: render.error })}\n\n`);
            render.response.end();
        }
        setTimeout(() => activeRenders.delete(renderId), 300000);
    }
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      console.log(`[${renderId}] Cleaning up temporary directory: ${tempDir}`);
      fs.rm(tempDir, { recursive: true, force: true }, () => {});
    }
  }
});

app.listen(port, () => {
  console.log(`🎬 Video Renderer Server running at http://localhost:${port}`);
  console.log('✅ High-performance pipeline is ACTIVE.');
  console.log('💡 For video renders, source video will be pre-processed into frames for maximum GPU utilization.');
});
