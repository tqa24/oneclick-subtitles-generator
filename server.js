/**
 * Local server for downloading YouTube videos
 * This server handles downloading YouTube videos to a local 'videos' directory
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
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

// API endpoint to download a YouTube video
app.post('/api/download-video', async (req, res) => {
  const { videoId, quality = '18' } = req.body; // 18 = 360p, 22 = 720p, 137 = 1080p (video only)
  
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
    const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Check if video exists and is downloadable
    const info = await ytdl.getInfo(videoURL);
    if (!info) {
      return res.status(404).json({ error: 'Video not found or not available' });
    }
    
    console.log(`Downloading video: ${info.videoDetails.title} (${videoId})`);
    
    // Downloading with a specific quality, or fallback to highest quality with audio
    const stream = ytdl(videoURL, {
      quality: quality,
      filter: 'audioandvideo'
    });
    
    // Create a write stream for the downloaded video
    const writer = fs.createWriteStream(videoPath);
    
    // Handle download events
    let downloadedBytes = 0;
    const totalBytes = parseInt(info.formats.find(format => format.itag === parseInt(quality))?.contentLength) || 0;
    
    stream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const progress = (downloadedBytes / totalBytes) * 100;
        // Just log for now, we could implement WebSockets for real-time progress updates
        console.log(`Download progress: ${Math.round(progress)}%`);
      }
    });
    
    stream.pipe(writer);
    
    // Send success response when download is complete
    writer.on('finish', () => {
      console.log(`Download complete: ${videoId}.mp4`);
      res.json({
        success: true,
        message: 'Video downloaded successfully',
        url: `/videos/${videoId}.mp4`,
        title: info.videoDetails.title
      });
    });
    
    // Handle errors during download
    writer.on('error', (err) => {
      console.error('Error writing file:', err);
      res.status(500).json({ error: 'Failed to download video' });
    });
    
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: error.message || 'Failed to download video' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`YouTube download server running on port ${PORT}`);
  console.log(`Videos directory: ${VIDEOS_DIR}`);
});