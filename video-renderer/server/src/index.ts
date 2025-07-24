import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition, getCompositions, makeCancelSignal } from '@remotion/renderer';

// Set Remotion environment variables for GPU acceleration
process.env.REMOTION_CHROME_MODE = "chrome-for-testing";
process.env.REMOTION_GL = "vulkan";

const app = express();
// Unified port configuration - matches main server/config.js
const port = process.env.PORT || 3033;

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

// Ensure directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const outputDir = path.join(__dirname, '../output');
[uploadsDir, outputDir].forEach((dir) => {
  if (!require('fs').existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
});

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

const upload = multer({ storage });

// Middleware
app.use(cors({
  exposedHeaders: ['X-Render-ID']
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

    // If we have a video file, get its actual dimensions to preserve aspect ratio
    if (isVideoFile && audioFile) {
      try {
        // Import the video utilities
        const { getVideoDimensions, ensureVideoCompatibility } = require('../../../server/services/videoProcessing/durationUtils');

        // First, ensure video compatibility (convert HEVC to H.264 if needed)
        // Check if the video file exists in the video-renderer server's uploads directory
        const localVideoPath = path.join(__dirname, '../uploads', audioFile);

        console.log(`[RENDER] Looking for video file at: ${localVideoPath}`);

        // Check if the file exists
        const fs = require('fs');
        if (!fs.existsSync(localVideoPath)) {
          throw new Error(`Video file not found: ${localVideoPath}`);
        }

        console.log(`[RENDER] Found video file: ${localVideoPath}`);
        console.log(`[RENDER] Checking compatibility for: ${localVideoPath}`);
        const compatibleVideoPath = await ensureVideoCompatibility(localVideoPath);

        // Update the final audio file to use the compatible version
        finalAudioFile = path.basename(compatibleVideoPath);
        console.log(`[RENDER] Video compatibility ensured, using file: ${finalAudioFile}`);

        // Get actual video dimensions and duration from the compatible video
        const { getMediaDuration } = require('../../../server/services/videoProcessing/durationUtils');
        const videoDimensions = await getVideoDimensions(compatibleVideoPath);
        const actualVideoDuration = await getMediaDuration(compatibleVideoPath);

        const videoWidth = videoDimensions.width;
        const videoHeight = videoDimensions.height;
        const aspectRatio = videoWidth / videoHeight;

        // Update duration to match the actual video duration
        durationInSeconds = actualVideoDuration;

        // Recalculate frames with the actual video duration
        const finalDuration = durationInSeconds; // No buffer for video files
        durationInFrames = Math.max(60, Math.ceil(finalDuration * fps));

        console.log(`[RENDER] Actual video duration: ${actualVideoDuration} seconds`);
        console.log(`[RENDER] Recalculated frames: ${durationInFrames} at ${fps}fps`);
        console.log(`[RENDER] Using video file: ${compatibleVideoPath}`);

        console.log(`[RENDER] Original video dimensions: ${videoWidth}x${videoHeight} (aspect ratio: ${aspectRatio.toFixed(2)})`);

        // Calculate target dimensions based on resolution while preserving aspect ratio
        let targetHeight: number;
        switch (resolution) {
          case '360p':
            targetHeight = 360;
            break;
          case '480p':
            targetHeight = 480;
            break;
          case '720p':
            targetHeight = 720;
            break;
          case '1440p':
            targetHeight = 1440;
            break;
          case '4K':
            targetHeight = 2160;
            break;
          case '8K':
            targetHeight = 4320;
            break;
          case '1080p':
          default:
            targetHeight = 1080;
            break;
        }

        // Calculate width based on aspect ratio
        width = Math.round(targetHeight * aspectRatio);
        height = targetHeight;

        // Ensure dimensions are even numbers (required for video encoding)
        width = width % 2 === 0 ? width : width + 1;
        height = height % 2 === 0 ? height : height + 1;

        console.log(`[RENDER] Calculated composition dimensions: ${width}x${height} (preserving aspect ratio)`);

      } catch (error) {
        console.warn(`[RENDER] Could not get video dimensions, falling back to default 16:9: ${error instanceof Error ? error.message : String(error)}`);
        // Fall back to default 16:9 dimensions
        switch (resolution) {
          case '360p':
            width = 640;
            height = 360;
            break;
          case '480p':
            width = 854;
            height = 480;
            break;
          case '720p':
            width = 1280;
            height = 720;
            break;
          case '1440p':
            width = 2560;
            height = 1440;
            break;
          case '4K':
            width = 3840;
            height = 2160;
            break;
          case '8K':
            width = 7680;
            height = 4320;
            break;
          case '1080p':
          default:
            width = 1920;
            height = 1080;
            break;
        }
      }
    } else {
      // For audio files, use default 16:9 dimensions
      switch (resolution) {
        case '360p':
          width = 640;
          height = 360;
          break;
        case '480p':
          width = 854;
          height = 480;
          break;
        case '720p':
          width = 1280;
          height = 720;
          break;
        case '1440p':
          width = 2560;
          height = 1440;
          break;
        case '4K':
          width = 3840;
          height = 2160;
          break;
        case '8K':
          width = 7680;
          height = 4320;
          break;
        case '1080p':
        default:
          width = 1920;
          height = 1080;
          break;
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

    // Bundle the remotion project
    console.log('Bundling Remotion project...');

    // Use the current response object (which may have been updated on reconnection)
    const activeRenderForBundling = activeRenders.get(renderId);
    if (activeRenderForBundling && !activeRenderForBundling.response.writableEnded) {
      activeRenderForBundling.response.write(`data: ${JSON.stringify({ bundling: true })}\n\n`);
    }

    const bundleResult = await bundle(entryPoint);

    console.log('Bundle completed');
    console.log('Using composition ID:', compositionId);

    if (!bundleResult) {
      throw new Error('Bundling failed: No result returned from bundler');
    }

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


    // Get available compositions (for debugging)
    const compositions = await getCompositions(bundleResult, {
      inputProps: {
        audioUrl: audioUrl,
        lyrics,
        metadata,
        narrationUrl,
        isVideoFile
      }
    });
    console.log('Available compositions:', compositions.map(c => c.id));

    const composition = await selectComposition({
      serveUrl: bundleResult,
      id: compositionId,
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

    // Store original console.log for restoration
    const originalConsoleLog = console.log;

    try {
      // Double-check that temp directories exist right before rendering
      ensureRemotionTempDirs();

      // Intercept console.log to catch Chrome download progress
      console.log = (...args: any[]) => {
        const message = args.join(' ');

        // Check for Chrome download progress
        const chromeDownloadMatch = message.match(/Downloading Chrome Headless Shell - ([\d.]+) Mb\/([\d.]+) Mb/);
        if (chromeDownloadMatch) {
          const downloaded = parseFloat(chromeDownloadMatch[1]);
          const total = parseFloat(chromeDownloadMatch[2]);

          // Use the current response object (which may have been updated on reconnection)
          const activeRenderForChrome = activeRenders.get(renderId);
          if (activeRenderForChrome && !activeRenderForChrome.response.writableEnded) {
            activeRenderForChrome.response.write(`data: ${JSON.stringify({ chromeDownload: { downloaded, total } })}\n\n`);
          }
        }

        // Call original console.log
        originalConsoleLog(...args);
      };

      await renderMedia({
        composition,
        serveUrl: bundleResult,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps: {
          audioUrl: audioUrl,
          lyrics,
          metadata,
          narrationUrl,
          isVideoFile
        },
        chromiumOptions: {
          disableWebSecurity: true,
          ignoreCertificateErrors: true,
          gl: "vulkan"
        },
        logLevel: 'verbose',
        timeoutInMilliseconds: 120000, // Increase timeout to 2 minutes
        cancelSignal,
        onProgress: ({ renderedFrames, encodedFrames }) => {
          console.log(`Progress: ${renderedFrames}/${durationInFrames} frames`);
          const progress = renderedFrames / durationInFrames;

          // Update progress in activeRenders
          const activeRender = activeRenders.get(renderId);
          if (activeRender) {
            activeRender.progress = progress;

            // Determine the current phase based on progress
            let phase = 'rendering';
            let phaseDescription = 'Rendering video frames';

            if (encodedFrames !== undefined && renderedFrames > 0) {
              const encodingRatio = encodedFrames / renderedFrames;
              if (encodingRatio < 0.8 && progress > 0.8) {
                phase = 'encoding';
                phaseDescription = 'Encoding and stitching frames';
              }
            }

            // Use the current response object (which may have been updated on reconnection)
            if (!activeRender.response.writableEnded) {
              activeRender.response.write(`data: ${JSON.stringify({
                progress,
                renderedFrames,
                encodedFrames,
                durationInFrames,
                phase,
                phaseDescription
              })}\n\n`);
            }
          }
        }
      });

      // Restore original console.log
      console.log = originalConsoleLog;
    } catch (error) {
      // Restore original console.log in case of error
      console.log = originalConsoleLog;
      const renderError = error as Error;
      console.error('Error during renderMedia:', renderError);

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
            await renderMedia({
              composition,
              serveUrl: bundleResult,
              codec: 'h264',
              outputLocation: outputPath,
              inputProps: {
                audioUrl: audioUrl,
                lyrics,
                metadata,
                narrationUrl,
                isVideoFile
              },
              chromiumOptions: {
                disableWebSecurity: true,
                ignoreCertificateErrors: true,
                gl: "vulkan"
              },
              logLevel: 'verbose',
              timeoutInMilliseconds: 120000, // Increase timeout to 2 minutes
              cancelSignal,
              onProgress: ({ renderedFrames, encodedFrames }) => {
                console.log(`Retry Progress: ${renderedFrames}/${durationInFrames} frames`);
                const progress = renderedFrames / durationInFrames;

                // Update progress in activeRenders
                const activeRender = activeRenders.get(renderId);
                if (activeRender) {
                  activeRender.progress = progress;

                  // Determine the current phase based on progress
                  let phase = 'rendering';
                  let phaseDescription = 'Rendering video frames';

                  if (encodedFrames !== undefined && renderedFrames > 0) {
                    const encodingRatio = encodedFrames / renderedFrames;
                    if (encodingRatio < 0.8 && progress > 0.8) {
                      phase = 'encoding';
                      phaseDescription = 'Encoding and stitching frames';
                    }
                  }

                  // Use the current response object (which may have been updated on reconnection)
                  if (!activeRender.response.writableEnded) {
                    activeRender.response.write(`data: ${JSON.stringify({
                      progress,
                      renderedFrames,
                      encodedFrames,
                      durationInFrames,
                      phase,
                      phaseDescription
                    })}\n\n`);
                  }
                }
              }
            });
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
  }
});

app.listen(port, () => {
  console.log(`🎬 Video Renderer Server running at http://localhost:${port}`);
  console.log('GPU settings:');
  console.log('REMOTION_CHROME_MODE:', process.env.REMOTION_CHROME_MODE);
  console.log('REMOTION_GL:', process.env.REMOTION_GL);

  // Track this process (if port manager is available)
  try {
    const { trackProcess } = require('../../server/utils/portManager');
    trackProcess(port, process.pid, 'Video Renderer Server');
  } catch (error) {
    // Port manager not available, continue without tracking
    console.log('Note: Process tracking not available for video renderer');
  }
});
