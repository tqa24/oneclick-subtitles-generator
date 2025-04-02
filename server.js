/**
 * Local server for downloading YouTube videos
 * This server handles downloading YouTube videos to a local 'videos' directory
 * Now using yt-dlp (Python) for more reliable downloads
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

// Enable CORS for the frontend application
app.use(cors({
  origin: 'http://localhost:3005', // Your React app's address
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve the videos directory
app.use('/videos', express.static(path.join(__dirname, 'videos')));

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
});