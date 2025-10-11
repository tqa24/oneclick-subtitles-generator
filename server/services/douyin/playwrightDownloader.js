/**
 * Playwright-based Douyin downloader
 * Uses browser automation to extract video URLs and download videos
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { VIDEOS_DIR } = require('../../config');
const { setDownloadProgress } = require('../shared/progressTracker');
const { detectAvailableBrowser, isChromeCookieUnlockAvailable } = require('../shared/ytdlpUtils');

// Cache for browser instance to avoid repeated launches
let browserInstance = null;
let browserContext = null;
let browserInitPromise = null;  // Store initialization promise for concurrent requests

/**
 * Pre-warm the browser instance (call this on server startup)
 */
async function prewarmBrowser() {
  console.log('[PlaywrightDouyin] Pre-warming browser instance...');
  await getBrowserInstance();
  console.log('[PlaywrightDouyin] Browser instance ready');
}

/**
 * Get or create a browser instance
 */
async function getBrowserInstance() {
  // If already initializing, wait for that initialization
  if (browserInitPromise) {
    await browserInitPromise;
    if (browserInstance && browserInstance.isConnected()) {
      return { browser: browserInstance, context: browserContext };
    }
  }
  
  if (!browserInstance || !browserInstance.isConnected()) {
    // Create initialization promise to prevent concurrent launches
    browserInitPromise = (async () => {
    console.log('[PlaywrightDouyin] Launching browser...');
    browserInstance = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
        // Removed --disable-images as it might affect video loading
        // Removed security disabling flags for safety
      ]
    });

    // Create a new context with minimal settings to match Chrome DevTools
    browserContext = await browserInstance.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'zh-CN',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      // Add performance optimizations
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true
    });

    // Load cookies from Chrome for douyin.com
    try {
      const availableBrowser = detectAvailableBrowser();
      if (availableBrowser === 'chrome') {
        console.log('[PlaywrightDouyin] Loading cookies from Chrome for douyin.com...');
        // Extract cookies using yt-dlp
        const { spawn } = require('child_process');
        const ytdlpPath = path.join(process.cwd(), '.venv', 'Scripts', 'yt-dlp.exe');
        const pluginDir = path.join(process.cwd(), '.venv', 'yt-dlp-plugins');
        const tempCookieFile = path.join(require('os').tmpdir(), 'douyin_cookies.txt');

        const args = [];
        if (fs.existsSync(pluginDir)) {
          args.push('--plugin-dirs', pluginDir);
        }
        args.push('--cookies-from-browser', 'chrome', '--cookies', tempCookieFile, '--no-download', '--print', 'cookies_extracted', 'https://www.douyin.com/');

        await new Promise((resolve, reject) => {
          const process = spawn(ytdlpPath, args);
          process.on('close', (code) => {
            if (code === 0 && fs.existsSync(tempCookieFile)) {
              resolve();
            } else {
              reject(new Error('Cookie extraction failed'));
            }
          });
          process.on('error', reject);
        });

        // Load cookies into Playwright context
        if (fs.existsSync(tempCookieFile)) {
          const cookieData = fs.readFileSync(tempCookieFile, 'utf8');
          const lines = cookieData.split('\n').filter(line => line.trim() && !line.startsWith('#'));
          const cookies = lines.map(line => {
            const parts = line.split('\t');
            if (parts.length >= 7) {
              return {
                name: parts[5],
                value: parts[6],
                domain: parts[0],
                path: parts[2],
                httpOnly: parts[1].includes('HTTP'),
                secure: parts[1].includes('SSL')
              };
            }
          }).filter(Boolean);

          await browserContext.addCookies(cookies);
          console.log(`[PlaywrightDouyin] Loaded ${cookies.length} cookies for douyin.com`);
          fs.unlinkSync(tempCookieFile); // Clean up
        }
      }
    } catch (error) {
      console.log('[PlaywrightDouyin] Failed to load cookies:', error.message);
    }
    })();
    
    await browserInitPromise;
    browserInitPromise = null;  // Clear the promise after completion
  }
  
  return { browser: browserInstance, context: browserContext };
}

/**
 * Extract video information from Douyin URL
 * @param {string} douyinUrl - The Douyin video URL
 * @param {boolean} useCookies - Whether to use browser cookies (for future implementation)
 * @returns {Promise<Object>} - Video information including download URLs
 */
async function extractVideoInfo(douyinUrl, useCookies = false) {
  const { context } = await getBrowserInstance();
  const page = await context.newPage();
  
  try {
    console.log('[PlaywrightDouyin] Navigating to:', douyinUrl);

    // Navigate to the URL (matching Chrome DevTools method)
    await page.goto(douyinUrl, { waitUntil: 'load', timeout: 30000 });

    // Wait a bit for page to load
    await page.waitForTimeout(3000);

    // Extract video URL directly like in Chrome DevTools
    const videoInfo = await page.evaluate(() => {
      const videos = document.querySelectorAll('video');
      if (videos.length === 0) {
        throw new Error('No video elements found');
      }
      const video = videos[0];
      const currentSrc = video.currentSrc;
      if (!currentSrc) {
        throw new Error('No currentSrc found');
      }
      return {
        title: document.title || 'Douyin Video',
        videoId: window.location.pathname.split('/').pop() || 'unknown',
        currentSrc: currentSrc,
        sources: [{ src: currentSrc, type: 'video/mp4' }],
        duration: video.duration || 0,
        videoWidth: video.videoWidth || 720,
        videoHeight: video.videoHeight || 1280,
        sourcesCount: 1
      };
    });
    
    console.log('[PlaywrightDouyin] Extracted video info:', {
      title: videoInfo.title,
      videoId: videoInfo.videoId,
      sourcesCount: videoInfo.sources.length,
      duration: videoInfo.duration
    });
    
    return videoInfo;
    
  } catch (error) {
    console.error('[PlaywrightDouyin] Error extracting video info:', error);
    throw error;
  } finally {
    await page.close();
  }
}

/**
 * Download video from extracted URL
 * @param {string} videoUrl - Direct video URL
 * @param {string} outputPath - Output file path
 * @param {string} videoId - Video ID for progress tracking
 * @returns {Promise<string>} - Path to downloaded file
 */
async function downloadVideoFromUrl(videoUrl, outputPath, videoId) {
  return new Promise((resolve, reject) => {
    console.log('[PlaywrightDouyin] Starting download from:', videoUrl);
    
    const protocol = videoUrl.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(outputPath);
    
    const request = protocol.get(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5'
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);
        
        if (totalSize > 0) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          setDownloadProgress(videoId, progress);
        }
      });
      
      response.on('end', () => {
        file.end();
        setDownloadProgress(videoId, 100);
        console.log('[PlaywrightDouyin] Download completed:', outputPath);
        resolve(outputPath);
      });
      
      response.on('error', (error) => {
        file.destroy();
        fs.unlink(outputPath, () => {}); // Clean up partial file
        reject(error);
      });
    });
    
    request.on('error', (error) => {
      file.destroy();
      fs.unlink(outputPath, () => {}); // Clean up partial file
      reject(error);
    });
    
    request.setTimeout(60000, () => {
      request.destroy();
      file.destroy();
      fs.unlink(outputPath, () => {}); // Clean up partial file
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Main download function
 * @param {string} douyinUrl - Douyin video URL
 * @param {string} videoId - Video ID for tracking
 * @param {string} quality - Quality setting (for future use)
 * @param {boolean} useCookies - Whether to use browser cookies
 * @returns {Promise<string>} - Path to downloaded video
 */
async function downloadDouyinVideo(douyinUrl, videoId, quality = '720p', useCookies = false) {
  try {
    console.log('[PlaywrightDouyin] Starting download process for:', douyinUrl);
    
    // Ensure videos directory exists
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }
    
    setDownloadProgress(videoId, 10);

    // Extract video information
    const videoInfo = await extractVideoInfo(douyinUrl, useCookies);
    setDownloadProgress(videoId, 30);
    
    // Choose the best available video URL
    let videoUrl = videoInfo.currentSrc;
    if (videoInfo.sources.length > 0) {
      // Prefer the first source URL as it's usually the highest quality
      videoUrl = videoInfo.sources[0].src;
    }
    
    if (!videoUrl) {
      throw new Error('No video URL found');
    }
    
    setDownloadProgress(videoId, 40);
    
    // Generate output filename
    const sanitizedTitle = videoInfo.title.replace(/[^\w\s-]/g, '').substring(0, 50);
    const filename = `${videoId}_${sanitizedTitle || 'douyin_video'}.mp4`;
    const outputPath = path.join(VIDEOS_DIR, filename);
    
    // Download the video
    await downloadVideoFromUrl(videoUrl, outputPath, videoId);
    
    console.log('[PlaywrightDouyin] Download completed successfully:', filename);
    setDownloadProgress(videoId, 100);
    return outputPath;
    
  } catch (error) {
    console.error('[PlaywrightDouyin] Download failed:', error);
    throw error;
  }
}

/**
 * Get available video qualities (for compatibility with quality scanner)
 * @param {string} douyinUrl - Douyin video URL
 * @param {boolean} useCookies - Whether to use browser cookies
 * @returns {Promise<Array>} - Array of available qualities
 */
async function getAvailableQualities(douyinUrl, useCookies = false) {
  try {
    const videoInfo = await extractVideoInfo(douyinUrl, useCookies);



    const qualities = [];

    // Determine quality based on video dimensions
    const height = videoInfo.videoHeight || 720;
    const width = videoInfo.videoWidth || 1280;

    // Add quality options based on actual video dimensions
    if (height >= 1080) {
      qualities.push({
        quality: '1080p',
        height: 1080,
        width: Math.round(width * (1080 / height)),
        format: 'mp4',
        label: '1080p HD'
      });
    }

    if (height >= 720) {
      qualities.push({
        quality: '720p',
        height: 720,
        width: Math.round(width * (720 / height)),
        format: 'mp4',
        label: '720p HD'
      });
    }

    if (height >= 480) {
      qualities.push({
        quality: '480p',
        height: 480,
        width: Math.round(width * (480 / height)),
        format: 'mp4',
        label: '480p'
      });
    }

    // Always include the original quality
    qualities.push({
      quality: 'original',
      height: height,
      width: width,
      format: 'mp4',
      label: `${height}p Original`
    });

    // If no standard qualities were added, add a default
    if (qualities.length === 1) {
      qualities.unshift({
        quality: 'default',
        height: height,
        width: width,
        format: 'mp4',
        label: `${height}p`
      });
    }


    return qualities;

  } catch (error) {
    console.error('[PlaywrightDouyin] Error getting qualities:', error);
    // Return a default quality if extraction fails
    return [{
      quality: 'default',
      height: 720,
      width: 1280,
      format: 'mp4',
      label: '720p Default'
    }];
  }
}

/**
 * Cleanup browser resources
 */
async function cleanup() {
  if (browserContext) {
    await browserContext.close();
    browserContext = null;
  }
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Cleanup on process exit
process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = {
  downloadDouyinVideo,
  extractVideoInfo,
  getAvailableQualities,
  cleanup,
  prewarmBrowser  // Export prewarm function
};
