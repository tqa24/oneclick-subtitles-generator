const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  setDownloadProgress,
  updateProgressFromYtdlpOutput
} = require('./shared/progressTracker');

/**
 * Get the path to yt-dlp executable
 * First checks for yt-dlp in the virtual environment, then in PATH
 * @returns {string} - Path to yt-dlp executable
 */
function getYtDlpPath() {
  // Check for venv at root level
  const venvPath = path.join(process.cwd(), '.venv');
  const venvBinDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  const venvYtDlpPath = path.join(venvPath, venvBinDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

  if (fs.existsSync(venvYtDlpPath)) {
    return venvYtDlpPath;
  }

  // If not in venv, use the one in PATH
  return 'yt-dlp';
}

/**
 * Detect available browsers for cookie extraction
 * @returns {string|null} - Browser name that can be used with --cookies-from-browser
 */
function detectAvailableBrowser() {
  const platform = os.platform();
  const homeDir = os.homedir();

  // List of browsers to check in order of preference
  const browsers = [];

  if (platform === 'win32') {
    // Windows paths
    browsers.push(
      { name: 'chrome', path: path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data') },
      { name: 'edge', path: path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data') },
      { name: 'firefox', path: path.join(homeDir, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles') }
    );
  } else if (platform === 'darwin') {
    // macOS paths
    browsers.push(
      { name: 'chrome', path: path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome') },
      { name: 'safari', path: path.join(homeDir, 'Library', 'Safari') },
      { name: 'firefox', path: path.join(homeDir, 'Library', 'Application Support', 'Firefox', 'Profiles') },
      { name: 'edge', path: path.join(homeDir, 'Library', 'Application Support', 'Microsoft Edge') }
    );
  } else {
    // Linux paths
    browsers.push(
      { name: 'chrome', path: path.join(homeDir, '.config', 'google-chrome') },
      { name: 'firefox', path: path.join(homeDir, '.mozilla', 'firefox') },
      { name: 'chromium', path: path.join(homeDir, '.config', 'chromium') }
    );
  }

  // Check which browser is available
  for (const browser of browsers) {
    try {
      if (fs.existsSync(browser.path)) {
        console.log(`[detectAvailableBrowser] Found ${browser.name} at: ${browser.path}`);
        return browser.name;
      }
    } catch (error) {
      // Ignore errors and continue checking
      continue;
    }
  }

  console.log('[detectAvailableBrowser] No supported browser found for cookie extraction');
  return null;
}

/**
 * Get common yt-dlp arguments including cookie support
 * @returns {Array} - Array of common arguments
 */
function getCommonYtDlpArgs() {
  const args = [];

  // Try to add browser cookies for better authentication
  const availableBrowser = detectAvailableBrowser();
  if (availableBrowser) {
    args.push('--cookies-from-browser', availableBrowser);
    console.log(`[getCommonYtDlpArgs] Using cookies from browser: ${availableBrowser}`);
  }

  return args;
}

/**
 * Scan available video qualities for a given URL using yt-dlp
 * @param {string} videoURL - Video URL to scan
 * @returns {Promise<Array>} - Array of available quality options
 */
async function scanAvailableQualities(videoURL) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();

    // Build arguments with cookie support
    const args = [
      ...getCommonYtDlpArgs(),
      '--list-formats',
      '--no-warnings',
      '--no-playlist',
      videoURL
    ];

    console.log(`[scanAvailableQualities] Running yt-dlp with args:`, args);

    // Use yt-dlp to list available formats
    const ytdlpProcess = spawn(ytDlpPath, args);

    let stdout = '';
    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp format listing failed:', stderr);
        reject(new Error(`Failed to scan video qualities: ${stderr}`));
        return;
      }

      try {
        const qualities = parseYtDlpFormats(stdout);
        resolve(qualities);
      } catch (error) {
        console.error('Error parsing yt-dlp formats:', error);
        reject(error);
      }
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      ytdlpProcess.kill();
      reject(new Error('Quality scan timeout'));
    }, 30000); // 30 second timeout
  });
}

/**
 * Parse yt-dlp format output to extract quality information
 * @param {string} formatOutput - Raw output from yt-dlp --list-formats
 * @returns {Array} - Parsed quality options
 */
function parseYtDlpFormats(formatOutput) {
  const lines = formatOutput.split('\n');
  const qualities = [];
  const seenResolutions = new Set();

  // Look for format lines (they typically start with format ID)
  for (const line of lines) {
    // Skip header lines and empty lines
    if (!line.trim() || line.includes('format code') || line.includes('extension') || line.includes('---')) {
      continue;
    }

    // Parse format line - typical format:
    // format_id  extension  resolution  note
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    const formatId = parts[0];
    const extension = parts[1];
    const resolution = parts[2];

    // Skip audio-only formats
    if (resolution === 'audio' || extension === 'm4a' || extension === 'webm' && resolution.includes('audio')) {
      continue;
    }

    // Extract height from resolution (e.g., "1920x1080" -> 1080, "720p" -> 720)
    let height = null;
    if (resolution.includes('x')) {
      const match = resolution.match(/(\d+)x(\d+)/);
      if (match) {
        height = parseInt(match[2]);
      }
    } else if (resolution.includes('p')) {
      const match = resolution.match(/(\d+)p/);
      if (match) {
        height = parseInt(match[1]);
      }
    }

    if (height && height >= 144 && !seenResolutions.has(height)) {
      seenResolutions.add(height);
      
      // Determine quality label
      let qualityLabel = `${height}p`;
      let qualityDescription = `${height}p`;
      
      if (height >= 2160) {
        qualityDescription = `${height}p (4K)`;
      } else if (height >= 1440) {
        qualityDescription = `${height}p (1440p)`;
      } else if (height >= 1080) {
        qualityDescription = `${height}p (Full HD)`;
      } else if (height >= 720) {
        qualityDescription = `${height}p (HD)`;
      }

      // Only include resolution if it looks like actual video dimensions (contains 'x' and reasonable numbers)
      const includeResolution = resolution && resolution.includes('x') &&
        resolution.match(/^\d{2,4}x\d{2,4}$/) &&
        !resolution.includes('audio') &&
        !resolution.includes('only');

      const qualityData = {
        height,
        quality: qualityLabel,
        description: qualityDescription,
        formatId,
        extension
      };

      // Only add resolution if it's valid
      if (includeResolution) {
        qualityData.resolution = resolution;
      }

      qualities.push(qualityData);
    }
  }

  // Sort by height descending (highest quality first)
  qualities.sort((a, b) => b.height - a.height);

  // If no qualities found, provide common fallback options without fake dimensions
  if (qualities.length === 0) {
    return [
      { height: 1080, quality: '1080p', description: '1080p (Full HD)', formatId: 'best', extension: 'mp4' },
      { height: 720, quality: '720p', description: '720p (HD)', formatId: 'best[height<=720]', extension: 'mp4' },
      { height: 480, quality: '480p', description: '480p', formatId: 'best[height<=480]', extension: 'mp4' },
      { height: 360, quality: '360p', description: '360p', formatId: 'best[height<=360]', extension: 'mp4' }
    ];
  }

  return qualities;
}

/**
 * Get video information including title and duration
 * @param {string} videoURL - Video URL to get info for
 * @returns {Promise<Object>} - Video information
 */
async function getVideoInfo(videoURL) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();

    // Build arguments with cookie support
    const args = [
      ...getCommonYtDlpArgs(),
      '--dump-json',
      '--no-warnings',
      '--no-playlist',
      videoURL
    ];

    console.log(`[getVideoInfo] Running yt-dlp with args:`, args);

    // Use yt-dlp to get video information
    const ytdlpProcess = spawn(ytDlpPath, args);

    let stdout = '';
    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp info extraction failed:', stderr);
        reject(new Error(`Failed to get video info: ${stderr}`));
        return;
      }

      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title || 'Unknown Title',
          duration: info.duration || 0,
          uploader: info.uploader || 'Unknown',
          uploadDate: info.upload_date || null,
          viewCount: info.view_count || 0,
          description: info.description || ''
        });
      } catch (error) {
        console.error('Error parsing video info:', error);
        reject(error);
      }
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      ytdlpProcess.kill();
      reject(new Error('Video info scan timeout'));
    }, 15000); // 15 second timeout
  });
}

/**
 * Download video with specific quality
 * @param {string} videoURL - Video URL
 * @param {string} outputPath - Output file path
 * @param {string} quality - Quality (e.g., '720p', '1080p')
 * @param {string} videoId - Video ID for progress tracking
 * @param {Function} progressCallback - Progress callback function
 * @returns {Promise<boolean>} - Success status
 */
async function downloadWithQuality(videoURL, outputPath, quality, videoId = null, progressCallback = null) {
  // Try with primary format first, then fallback if needed
  try {
    await downloadWithQualityAttempt(videoURL, outputPath, quality, videoId, progressCallback, false);
    return true;
  } catch (error) {
    console.warn(`[downloadWithQuality] Primary attempt failed: ${error.message}`);
    console.log(`[downloadWithQuality] Trying fallback format...`);

    try {
      await downloadWithQualityAttempt(videoURL, outputPath, quality, videoId, progressCallback, true);
      return true;
    } catch (fallbackError) {
      console.error(`[downloadWithQuality] Fallback attempt also failed: ${fallbackError.message}`);
      throw fallbackError;
    }
  }
}

/**
 * Single download attempt with specific format strategy
 */
async function downloadWithQualityAttempt(videoURL, outputPath, quality, videoId = null, progressCallback = null, useFallback = false) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();

    // Convert quality to height
    const height = quality.replace('p', '');

    console.log(`[downloadWithQuality] Starting download:`, {
      url: videoURL,
      outputPath,
      quality,
      height,
      ytDlpPath,
      videoId
    });

    // Initialize progress tracking if videoId is provided
    if (videoId) {
      setDownloadProgress(videoId, 0, 'downloading');
    }

    // Choose format strategy based on attempt type and site
    let formatString;
    if (useFallback) {
      // Fallback: use simple format for all sites
      formatString = `best[height<=${height}]`;
      console.log(`[downloadWithQualityAttempt] Using fallback format: ${formatString}`);
    } else if (videoURL.includes('tiktok.com') || videoURL.includes('douyin.com')) {
      // For TikTok/Douyin, use simple format to avoid compatibility issues
      formatString = `best[height<=${height}]`;
      console.log(`[downloadWithQualityAttempt] Using TikTok/Douyin format: ${formatString}`);
    } else {
      // For other sites (YouTube, etc.), use complex format for better quality
      formatString = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
      console.log(`[downloadWithQualityAttempt] Using complex format: ${formatString}`);
    }

    // Build arguments with cookie support
    const args = [
      ...getCommonYtDlpArgs(),
      '--format', formatString,
      '--merge-output-format', 'mp4',
      '--output', outputPath,
      '--no-playlist',
      '--progress',
      '--newline',
      '--force-overwrites',
      '--verbose',
      videoURL
    ];

    console.log(`[downloadWithQualityAttempt] Running yt-dlp with args:`, args);

    const ytdlpProcess = spawn(ytDlpPath, args);

    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const output = data.toString();

      // Update progress tracking system if videoId is provided
      if (videoId) {
        // Only log progress lines, not all output
        if (output.includes('%') || output.includes('download')) {
          console.log(`[downloadWithQuality] yt-dlp progress for ${videoId}:`, output.trim());
        }

        // Try both the existing progress parser and a simple one
        updateProgressFromYtdlpOutput(videoId, output);

        // Also try manual parsing as backup (only for actual download progress lines)
        if (output.includes('[download]') && output.includes('%')) {
          const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            // Only accept reasonable progress values (0-100%)
            if (progress >= 0 && progress <= 100) {
              console.log(`[downloadWithQuality] Manual progress parsing: ${progress}%`);

              // Directly set progress and broadcast
              setDownloadProgress(videoId, progress, 'downloading');

              // Try to broadcast manually
              try {
                const { broadcastProgress } = require('./shared/progressWebSocket');
                broadcastProgress(videoId, progress, 'downloading', 'download');
                console.log(`[downloadWithQuality] Broadcasted progress: ${progress}%`);
              } catch (error) {
                console.warn(`[downloadWithQuality] Failed to broadcast progress:`, error.message);
              }
            }
          }
        }
      }

      // Parse progress if callback provided (legacy support)
      if (progressCallback) {
        const progressMatch = output.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          progressCallback(progress);
        }
      }
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      stderr += errorOutput;

      // yt-dlp sometimes outputs progress to stderr, but ignore debug URLs with timestamps
      if (videoId && errorOutput.includes('[download]') && errorOutput.includes('%')) {
        console.log(`[downloadWithQuality] yt-dlp stderr progress for ${videoId}:`, errorOutput.trim());

        const progressMatch = errorOutput.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          // Only accept reasonable progress values (0-100%)
          if (progress >= 0 && progress <= 100) {
            console.log(`[downloadWithQuality] Manual stderr progress parsing: ${progress}%`);

            // Directly set progress and broadcast
            setDownloadProgress(videoId, progress, 'downloading');

            try {
              const { broadcastProgress } = require('./shared/progressWebSocket');
              broadcastProgress(videoId, progress, 'downloading', 'download');
              console.log(`[downloadWithQuality] Broadcasted stderr progress: ${progress}%`);
            } catch (error) {
              console.warn(`[downloadWithQuality] Failed to broadcast stderr progress:`, error.message);
            }
          }
        }
      }
    });

    ytdlpProcess.on('close', (code) => {
      console.log(`[downloadWithQualityAttempt] Process finished with code: ${code}`);
      if (code === 0) {
        console.log(`[downloadWithQualityAttempt] Download successful for: ${outputPath}`);

        // Update progress tracking to completed
        if (videoId && !useFallback) {
          setDownloadProgress(videoId, 100, 'completed');
        }

        resolve(true);
      } else {
        console.error(`[downloadWithQualityAttempt] yt-dlp download failed:`, stderr);

        // Only update progress tracking to error if this is the final attempt
        if (videoId && useFallback) {
          setDownloadProgress(videoId, 0, 'error', `Download failed: ${stderr}`);
        }

        reject(new Error(`Download failed with code ${code}: ${stderr}`));
      }
    });
  });
}

module.exports = {
  scanAvailableQualities,
  getVideoInfo,
  downloadWithQuality
};
