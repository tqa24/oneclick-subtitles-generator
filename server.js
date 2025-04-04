/**
 * Local server for downloading YouTube videos
 * This server handles downloading YouTube videos to a local 'videos' directory
 * Now using yt-dlp (Python) for more reliable downloads
 * Also handles caching of subtitles to avoid repeated Gemini API calls
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const app = express();
const PORT = process.env.PORT || 3004;
const SERVER_URL = 'http://localhost:3004';

// Ensure videos directory exists
const VIDEOS_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  console.log(`Created videos directory at ${VIDEOS_DIR}`);
}

// Ensure segments directory exists
const SEGMENTS_DIR = path.join(__dirname, 'segments');
if (!fs.existsSync(SEGMENTS_DIR)) {
  fs.mkdirSync(SEGMENTS_DIR, { recursive: true });
  console.log(`Created segments directory at ${SEGMENTS_DIR}`);
}

// Ensure subtitles directory exists
const SUBTITLES_DIR = path.join(__dirname, 'subtitles');
if (!fs.existsSync(SUBTITLES_DIR)) {
  fs.mkdirSync(SUBTITLES_DIR, { recursive: true });
  console.log(`Created subtitles directory at ${SUBTITLES_DIR}`);
}

// Configure CORS with all needed methods
app.use(cors({
  origin: 'http://localhost:3005',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '500mb' })); // Increased limit for base64 encoded files

// Helper function to get file size in bytes
const getFileSize = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    return 0;
  }
};

// Helper function to format bytes to human-readable size
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// New endpoint to clear cache with detailed information
app.delete('/api/clear-cache', (req, res) => {
  try {
    const details = {
      subtitles: { count: 0, size: 0, files: [] },
      videos: { count: 0, size: 0, files: [] },
      segments: { count: 0, size: 0, files: [] },
      totalCount: 0,
      totalSize: 0
    };

    // Clear subtitles directory
    const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
    subtitleFiles.forEach(file => {
      const filePath = path.join(SUBTITLES_DIR, file);
      const fileSize = getFileSize(filePath);
      details.subtitles.count++;
      details.subtitles.size += fileSize;
      details.subtitles.files.push({ name: file, size: fileSize });
      fs.unlinkSync(filePath);
    });

    // Clear videos directory
    const videoFiles = fs.readdirSync(VIDEOS_DIR);
    videoFiles.forEach(file => {
      const filePath = path.join(VIDEOS_DIR, file);
      const fileSize = getFileSize(filePath);
      details.videos.count++;
      details.videos.size += fileSize;
      details.videos.files.push({ name: file, size: fileSize });
      fs.unlinkSync(filePath);
    });

    // Clear segments directory
    const segmentFiles = fs.readdirSync(SEGMENTS_DIR);
    segmentFiles.forEach(file => {
      const filePath = path.join(SEGMENTS_DIR, file);
      const fileSize = getFileSize(filePath);
      details.segments.count++;
      details.segments.size += fileSize;
      details.segments.files.push({ name: file, size: fileSize });
      fs.unlinkSync(filePath);
    });

    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count + details.segments.count;
    details.totalSize = details.subtitles.size + details.videos.size + details.segments.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.segments.formattedSize = formatBytes(details.segments.size);
    details.formattedTotalSize = formatBytes(details.totalSize);

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      details: details
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

// Serve the videos directory
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// Serve the segments directory
app.use('/segments', express.static(path.join(__dirname, 'segments')));

// Serve the subtitles directory (if needed)
app.use('/subtitles', express.static(path.join(__dirname, 'subtitles')));

// API endpoint to check if a video exists
app.get('/api/video-exists/:videoId', (req, res) => {
  const { videoId } = req.params;
  const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  if (fs.existsSync(videoPath)) {
    const stats = fs.statSync(videoPath);
    res.json({
      exists: true,
      url: `/videos/${videoId}.mp4`,
      size: stats.size,
      createdAt: stats.birthtime
    });
  } else {
    res.json({ exists: false });
  }
});

// API endpoint to check if subtitles exist
app.get('/api/subtitle-exists/:cacheId', (req, res) => {
  const { cacheId } = req.params;
  const subtitlePath = path.join(SUBTITLES_DIR, `${cacheId}.json`);

  if (fs.existsSync(subtitlePath)) {
    console.log(`Cached subtitles found for ${cacheId}`);
    try {
      const subtitlesData = JSON.parse(fs.readFileSync(subtitlePath, 'utf8'));
      res.json({
        exists: true,
        subtitles: subtitlesData
      });
    } catch (error) {
      console.error('Error reading cached subtitles:', error);
      res.json({ exists: false });
    }
  } else {
    console.log(`No cached subtitles found for ${cacheId}`);
    res.json({ exists: false });
  }
});

// API endpoint to save subtitles
app.post('/api/save-subtitles', (req, res) => {
  const { cacheId, subtitles } = req.body;

  if (!cacheId || !subtitles) {
    return res.status(400).json({
      success: false,
      error: 'Missing required data (cacheId or subtitles)'
    });
  }

  try {
    const subtitlePath = path.join(SUBTITLES_DIR, `${cacheId}.json`);
    fs.writeFileSync(subtitlePath, JSON.stringify(subtitles, null, 2));
    console.log(`Saved subtitles to cache: ${cacheId}`);

    res.json({
      success: true,
      message: 'Subtitles saved to cache successfully'
    });
  } catch (error) {
    console.error('Error saving subtitles to cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save subtitles to cache'
    });
  }
});

// Function to download YouTube video using yt-dlp
function downloadYouTubeVideo(videoId) {
  return new Promise((resolve, reject) => {
    const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

    console.log(`Downloading YouTube video: ${videoId} using yt-dlp`);

    // Ensure we're using the Python from our virtual environment
    const pythonPath = path.join(__dirname, '.venv', 'Scripts', 'python.exe');

    // Prepare yt-dlp command with arguments for format selection and output filename
    const ytDlpArgs = [
      '-m', 'yt_dlp',
      videoURL,
      '--format', 'best[height<=480][ext=mp4]/best[ext=mp4]/best', // Select best mp4 format <= 480p for reliability
      '--output', outputPath,
      '--no-playlist',
      '--no-warnings',
      '--quiet'
    ];

    console.log(`Running command: ${pythonPath} ${ytDlpArgs.join(' ')}`);

    // Spawn the yt-dlp process
    const ytDlp = spawn(pythonPath, ytDlpArgs);

    let stdoutData = '';
    let stderrData = '';

    ytDlp.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`yt-dlp stdout: ${data}`);
    });

    ytDlp.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.error(`yt-dlp stderr: ${data}`);
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        console.log(`yt-dlp download successful: ${outputPath}`);
        resolve({
          success: true,
          path: outputPath,
          message: 'Download completed successfully'
        });
      } else {
        console.error(`yt-dlp process exited with code ${code}`);
        reject(new Error(`yt-dlp failed with code ${code}: ${stderrData}`));
      }
    });

    ytDlp.on('error', (err) => {
      console.error('Failed to start yt-dlp process:', err);
      reject(err);
    });
  });
}

// API endpoint to download a YouTube video
app.post('/api/download-video', async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Check if video already exists
  if (fs.existsSync(videoPath)) {
    return res.json({
      success: true,
      message: 'Video already downloaded',
      url: `/videos/${videoId}.mp4`
    });
  }

  try {
    // Download the video using yt-dlp
    await downloadYouTubeVideo(videoId);

    // Check if the file was created successfully
    if (fs.existsSync(videoPath)) {
      console.log(`Video downloaded successfully: ${videoId}.mp4`);
      return res.json({
        success: true,
        message: 'Video downloaded successfully with yt-dlp',
        url: `/videos/${videoId}.mp4`
      });
    } else {
      throw new Error('Download completed but video file was not found');
    }
  } catch (error) {
    console.error('Error downloading video:', error);

    // Clean up any partial file
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    } catch (e) {
      console.error('Error cleaning up incomplete file:', e);
    }

    return res.status(500).json({
      error: 'Failed to download video',
      details: error.message
    });
  }
});

// Function to split a video into segments using ffmpeg
function splitVideoIntoSegments(videoPath, segmentDuration, outputDir, filePrefix) {
  return new Promise((resolve, reject) => {
    // Create a unique ID for this batch of segments
    const batchId = `${filePrefix}_${Date.now()}`;
    const outputPattern = path.join(outputDir, `${batchId}_%03d.mp4`);

    console.log(`Splitting video ${videoPath} into ${segmentDuration}-second segments`);

    // Use ffmpeg to split the video
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-c', 'copy',            // Copy codec (no re-encoding)
      '-map', '0',             // Map all streams
      '-segment_time', segmentDuration,  // Segment duration in seconds
      '-f', 'segment',         // Use segment format
      '-reset_timestamps', '1', // Reset timestamps for each segment
      '-max_muxing_queue_size', '9999', // Increase queue size for large files
      '-threads', '0',         // Use all available CPU cores
      outputPattern            // Output pattern
    ]);

    let stdoutData = '';
    let stderrData = '';

    ffmpeg.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.log(`ffmpeg stderr: ${data}`); // Use log instead of error for ffmpeg progress
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`ffmpeg split successful`);

        // Get the list of created segment files
        const segmentFiles = fs.readdirSync(outputDir)
          .filter(file => file.startsWith(batchId))
          .map(file => path.join(outputDir, file));

        resolve({
          success: true,
          batchId: batchId,
          segments: segmentFiles,
          message: 'Video split successfully'
        });
      } else {
        console.error(`ffmpeg process exited with code ${code}`);
        reject(new Error(`ffmpeg failed with code ${code}: ${stderrData}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('Failed to start ffmpeg process:', err);
      reject(err);
    });
  });
}

// Configure raw body parser for video uploads
app.use('/api/upload-and-split-video', express.raw({ limit: '2gb', type: 'video/*' }));

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API endpoint to upload and split a video
app.post('/api/upload-and-split-video', express.raw({ limit: '2gb', type: 'video/*' }), async (req, res) => {
  try {
    // Generate a unique filename
    const timestamp = Date.now();
    const fileExtension = req.headers['content-type'].split('/')[1] || 'mp4';
    const filename = `upload_${timestamp}.${fileExtension}`;
    const videoPath = path.join(VIDEOS_DIR, filename);

    // Save the uploaded video
    fs.writeFileSync(videoPath, req.body);
    console.log(`Video saved to ${videoPath}`);

    // Get segment duration from query params or use default (10 minutes)
    const segmentDuration = parseInt(req.query.segmentDuration || '600');

    // Split the video into segments
    const result = await splitVideoIntoSegments(
      videoPath,
      segmentDuration,
      SEGMENTS_DIR,
      `segment_${timestamp}`
    );

    // Return the list of segment files
    res.json({
      success: true,
      originalVideo: `/videos/${filename}`,
      batchId: result.batchId,
      segments: result.segments.map(segment => `/segments/${path.basename(segment)}`),
      message: 'Video uploaded and split successfully'
    });
  } catch (error) {
    console.error('Error processing video upload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process video'
    });
  }
});

// API endpoint to check if a segment exists
app.get('/api/segment-exists/:segmentId', (req, res) => {
  const { segmentId } = req.params;
  const segmentPath = path.join(SEGMENTS_DIR, `${segmentId}.mp4`);

  if (fs.existsSync(segmentPath)) {
    const stats = fs.statSync(segmentPath);
    res.json({
      exists: true,
      url: `/segments/${segmentId}.mp4`,
      size: stats.size,
      createdAt: stats.birthtime
    });
  } else {
    res.json({ exists: false });
  }
});

// API endpoint to split a video into segments
app.post('/api/split-video', express.raw({ limit: '2gb', type: 'video/*' }), async (req, res) => {
  try {
    // Generate a unique filename for the original video
    const videoId = req.query.videoId || `video_${Date.now()}`;
    const fileExtension = req.headers['content-type'].split('/')[1] || 'mp4';
    const filename = `${videoId}.${fileExtension}`;
    const videoPath = path.join(VIDEOS_DIR, filename);

    // Save the uploaded video
    fs.writeFileSync(videoPath, req.body);
    console.log(`Video saved to ${videoPath}`);

    // Get segment duration from query params or use default (10 minutes = 600 seconds)
    const segmentDuration = parseInt(req.query.segmentDuration || '600');

    // Split the video into segments
    const result = await splitVideoIntoSegments(
      videoPath,
      segmentDuration,
      VIDEOS_DIR, // Save segments in the videos directory
      `${videoId}_part`
    );

    // Return the list of segment files
    res.json({
      success: true,
      originalVideo: `/videos/${filename}`,
      videoId: videoId,
      segments: result.segments.map(segment => {
        const segmentName = path.basename(segment);
        return {
          path: `/videos/${segmentName}`,
          url: `${SERVER_URL}/videos/${segmentName}`,
          name: segmentName
        };
      }),
      message: 'Video split successfully'
    });
  } catch (error) {
    console.error('Error splitting video:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to split video'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`YouTube download server running on port ${PORT}`);
  console.log(`Videos directory: ${VIDEOS_DIR}`);
  console.log(`Segments directory: ${SEGMENTS_DIR}`);
  console.log(`Subtitles directory: ${SUBTITLES_DIR}`);
});