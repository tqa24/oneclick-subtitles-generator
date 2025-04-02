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
    console.log(`Downloading video: ${videoId}`);
    const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Get video info
    const info = await ytdl.getInfo(videoURL);
    if (!info) {
      return res.status(404).json({ error: 'Video not found or not available' });
    }
    
    console.log(`Found video: ${info.videoDetails.title}`);
    
    // Find the best mp4 format with both audio and video
    // We're prioritizing mp4 with audio+video for maximum compatibility
    const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
    const mp4Formats = formats.filter(format => format.container === 'mp4');
    
    // Sort by quality (height) in descending order
    mp4Formats.sort((a, b) => {
      const qualityA = a.height || 0;
      const qualityB = b.height || 0;
      return qualityB - qualityA;
    });
    
    // Choose a medium quality for faster download and better compatibility
    // (not too high res to avoid timeouts, not too low res to maintain decent quality)
    let selectedFormat;
    
    // Try to find a medium quality format first (360p or 480p)
    const mediumFormats = mp4Formats.filter(format => 
      format.height >= 360 && format.height <= 480);
    
    if (mediumFormats.length > 0) {
      selectedFormat = mediumFormats[0];
    } else if (mp4Formats.length > 0) {
      // If no medium quality, take the lowest available quality
      mp4Formats.sort((a, b) => (a.height || 0) - (b.height || 0));
      selectedFormat = mp4Formats[0];
    } else if (formats.length > 0) {
      // If no mp4 format available, take any format with both audio and video
      selectedFormat = formats[0];
    } else {
      return res.status(400).json({ error: 'No suitable video format found' });
    }
    
    console.log(`Selected format: ${selectedFormat.qualityLabel || selectedFormat.quality}, container: ${selectedFormat.container}`);
    
    // Download the video
    const stream = ytdl.downloadFromInfo(info, { format: selectedFormat });
    const writer = fs.createWriteStream(videoPath);
    
    // Handle download events
    let downloadedBytes = 0;
    let totalBytes = parseInt(selectedFormat.contentLength) || 0;
    
    stream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const progress = (downloadedBytes / totalBytes) * 100;
        // Log progress every 1MB
        if (downloadedBytes % (1024 * 1024) < chunk.length) {
          console.log(`Download progress: ${Math.round(progress)}%, ${(downloadedBytes/(1024*1024)).toFixed(2)}MB`);
        }
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
      
      // Clean up incomplete file
      try {
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      } catch (e) {
        console.error('Error cleaning up incomplete file:', e);
      }
      
      res.status(500).json({ error: 'Failed to download video' });
    });
    
    // Handle errors in ytdl stream
    stream.on('error', (err) => {
      console.error('Error in download stream:', err);
      
      // Clean up incomplete file
      try {
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      } catch (e) {
        console.error('Error cleaning up incomplete file:', e);
      }
      
      res.status(500).json({ error: 'Failed to download video stream' });
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