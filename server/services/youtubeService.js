/**
 * YouTube download functionality
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { VIDEOS_DIR } = require('../config');

/**
 * Download YouTube video using yt-dlp
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Result object with success status and path
 */
function downloadYouTubeVideo(videoId) {
  return new Promise((resolve, reject) => {
    const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

    console.log(`Downloading YouTube video: ${videoId} using yt-dlp`);

    // Ensure we're using the Python from our virtual environment
    const pythonPath = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');

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

module.exports = {
  downloadYouTubeVideo
};
