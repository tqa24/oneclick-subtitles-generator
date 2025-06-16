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
const port = process.env.PORT || 3010;

// Store active render processes for cancellation
const activeRenders = new Map<string, { cancel: () => void; response: express.Response }>();

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
  activeRenders.set(renderId, { cancel, response: res });

  // Ensure Remotion temp directories exist before rendering
  ensureRemotionTempDirs();

  try {
    const {
      compositionId = 'subtitled-video', // Get compositionId from request, fallback to default
      audioFile,
      lyrics,
      metadata = {
        videoType: 'Subtitled Video',
        resolution: '2K',
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

    // Calculate duration from the last subtitle end time + buffer
    const durationInSeconds = lyrics.length > 0 ? Math.max(...lyrics.map((l: any) => l.end)) + 2 : 8;

    // Use the frame rate from metadata or default to 60
    const fps = metadata.frameRate || 60;
    // Add a 2-second buffer to ensure audio doesn't get cut off at the end
    const audioDurationWithBuffer = durationInSeconds + 2;
    const durationInFrames = Math.max(60, Math.ceil(audioDurationWithBuffer * fps));

    // Determine resolution dimensions based on metadata
    const resolution = metadata.resolution || '1080p';
    let width: number, height: number;

    switch (resolution) {
      case '480p':
        width = 854;
        height = 480;
        break;
      case '720p':
        width = 1280;
        height = 720;
        break;
      case '2K':
        width = 2560;
        height = 1440;
        break;
      case '1080p':
      default:
        width = 1920;
        height = 1080;
        break;
    }

    const outputFile = `subtitle-video-${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, outputFile);

    // Create URLs that can be accessed via HTTP instead of file:// protocol
    const audioUrl = `http://localhost:${port}/uploads/${audioFile}`;

    // Perform server-side verification before rendering
    verifyServerAssets(metadata.videoType, audioUrl, narrationUrl);

    // Add a small delay after verification to ensure resources are ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Use index.ts as the entry point which contains registerRoot()
    const entryPoint = path.join(__dirname, '../../src/remotion/index.ts');

    // Bundle the remotion project
    console.log('Bundling Remotion project...');
    res.write(`data: ${JSON.stringify({ bundling: true })}\n\n`);
    const bundleResult = await bundle(entryPoint);

    console.log('Bundle completed');
    console.log('Using composition ID:', compositionId);

    if (!bundleResult) {
      throw new Error('Bundling failed: No result returned from bundler');
    }

    // Select the composition
    console.log('Selecting composition...');
    res.write(`data: ${JSON.stringify({ composition: true })}\n\n`);
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
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ chromeDownload: { downloaded, total } })}\n\n`);
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
        cancelSignal,
        onProgress: ({ renderedFrames, encodedFrames }) => {
          console.log(`Progress: ${renderedFrames}/${durationInFrames} frames`);
          const progress = renderedFrames / durationInFrames;
          if (res.writableEnded) return;
          res.write(`data: ${JSON.stringify({ progress, renderedFrames, durationInFrames })}\n\n`);
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
              cancelSignal,
              onProgress: ({ renderedFrames }) => {
                console.log(`Retry Progress: ${renderedFrames}/${durationInFrames} frames`);
                const progress = renderedFrames / durationInFrames;
                if (res.writableEnded) return;
                res.write(`data: ${JSON.stringify({ progress, renderedFrames, durationInFrames })}\n\n`);
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
    res.write(`data: ${JSON.stringify({ status: 'complete', videoUrl })}\n\n`);
    res.end();

    // Clean up active render
    activeRenders.delete(renderId);
  } catch (error) {
    console.error('Rendering error:', error);

    // Check if this was a cancellation
    if (error instanceof Error && error.message.includes('cancelled')) {
      res.write(`data: ${JSON.stringify({ status: 'cancelled' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      })}\n\n`);
    }
    res.end();

    // Clean up active render
    activeRenders.delete(renderId);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('GPU settings:');
  console.log('REMOTION_CHROME_MODE:', process.env.REMOTION_CHROME_MODE);
  console.log('REMOTION_GL:', process.env.REMOTION_GL);
});
