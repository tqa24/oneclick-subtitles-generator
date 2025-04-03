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

// Ensure videos directory exists
const VIDEOS_DIR = path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  console.log(`Created videos directory at ${VIDEOS_DIR}`);
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

app.use(express.json({ limit: '50mb' })); // Increased limit for base64 encoded files

// New endpoint to clear cache
app.delete('/api/clear-cache', (req, res) => {
  try {
    // Clear subtitles directory
    const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
    subtitleFiles.forEach(file => {
      fs.unlinkSync(path.join(SUBTITLES_DIR, file));
    });

    // Clear videos directory
    const videoFiles = fs.readdirSync(VIDEOS_DIR);
    videoFiles.forEach(file => {
      fs.unlinkSync(path.join(VIDEOS_DIR, file));
    });

    res.json({ 
      success: true, 
      message: 'Cache cleared successfully' 
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

// Start the server
app.listen(PORT, () => {
  console.log(`YouTube download server running on port ${PORT}`);
  console.log(`Videos directory: ${VIDEOS_DIR}`);
  console.log(`Subtitles directory: ${SUBTITLES_DIR}`);
});