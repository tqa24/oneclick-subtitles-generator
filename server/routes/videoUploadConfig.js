/**
 * Multer upload configuration for media routes.
 */

const path = require('path');
const multer = require('multer');
const { VIDEOS_DIR } = require('../config');

// Configure multer for large file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname || 'uploaded-file';
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const filename = `large_upload_${timestamp}_${baseName}${extension}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  }
});

// Create a separate multer instance for streaming uploads (no file size limit for streaming)
const streamingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname || 'uploaded-file';
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const filename = `streaming_upload_${timestamp}_${baseName}${extension}`;
    cb(null, filename);
  }
});

const streamingUpload = multer({
  storage: streamingStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
  }
});

module.exports = { upload, streamingUpload };
