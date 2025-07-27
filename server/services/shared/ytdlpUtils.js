/**
 * Shared utilities for yt-dlp operations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Cookie cache to avoid re-extraction within the same session
let cookieCache = {
  lastExtracted: null,
  tempCookieFile: path.join(os.tmpdir(), 'ytdlp_cookies_cache.txt'),
  isValid: false,
  validityDuration: 10 * 60 * 1000 // 10 minutes
};

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
 * Check if ChromeCookieUnlock plugin is available
 * @returns {boolean} - True if plugin is available
 */
function isChromeCookieUnlockAvailable() {
  const platform = os.platform();
  const homeDir = os.homedir();

  // Check possible plugin locations
  const pluginPaths = [];

  // Check venv-relative path first (this is where our setup installs it)
  const venvPluginsDir = path.join(process.cwd(), '.venv', 'yt-dlp-plugins', 'ChromeCookieUnlock');
  pluginPaths.push(venvPluginsDir);

  // Check system-wide paths
  if (platform === 'win32') {
    pluginPaths.push(path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'yt-dlp', 'plugins', 'ChromeCookieUnlock'));
  } else {
    pluginPaths.push(path.join(homeDir, '.yt-dlp', 'plugins', 'ChromeCookieUnlock'));
  }

  // Check if any plugin path exists with the correct structure
  for (const pluginPath of pluginPaths) {
    if (fs.existsSync(pluginPath)) {
      // Check for the postprocessor plugin structure: ChromeCookieUnlock/yt_dlp_plugins/postprocessor/
      const namespacePath = path.join(pluginPath, 'yt_dlp_plugins');
      const namespaceInit = path.join(namespacePath, '__init__.py');
      const postprocessorDir = path.join(namespacePath, 'postprocessor');
      const postprocessorDirInit = path.join(postprocessorDir, '__init__.py');
      const postprocessorPlugin = path.join(postprocessorDir, 'chrome_cookie_unlock.py');

      if (fs.existsSync(namespacePath) && fs.existsSync(namespaceInit) && fs.existsSync(postprocessorDir) &&
          fs.existsSync(postprocessorDirInit) && fs.existsSync(postprocessorPlugin)) {
        console.log(`[isChromeCookieUnlockAvailable] Plugin found at: ${pluginPath}`);
        return true;
      }
    }
  }

  console.log(`[isChromeCookieUnlockAvailable] Plugin not found in any of these locations:`, pluginPaths);
  return false;
}

/**
 * Get common yt-dlp arguments including cookie support
 * @returns {Array} - Array of common arguments
 */
function getCommonYtDlpArgs() {
  const args = [];

  // Add plugin directory if it exists
  const pluginDir = path.join(process.cwd(), '.venv', 'yt-dlp-plugins');
  if (fs.existsSync(pluginDir)) {
    args.push('--plugin-dirs', pluginDir);
    console.log(`[getCommonYtDlpArgs] Using plugin directory: ${pluginDir}`);
  }

  // Try to add browser cookies for better authentication
  const availableBrowser = detectAvailableBrowser();
  if (availableBrowser) {
    const hasPlugin = isChromeCookieUnlockAvailable();

    if (availableBrowser === 'chrome' && os.platform() === 'win32' && !hasPlugin) {
      // On Windows with Chrome, warn about potential cookie locking issues
      console.log(`[getCommonYtDlpArgs] Chrome detected on Windows without ChromeCookieUnlock plugin`);
      console.log(`[getCommonYtDlpArgs] Cookie extraction may fail if Chrome is running`);
      console.log(`[getCommonYtDlpArgs] Consider closing Chrome or installing ChromeCookieUnlock plugin`);
    }

    args.push('--cookies-from-browser', availableBrowser);
    console.log(`[getCommonYtDlpArgs] Using cookies from browser: ${availableBrowser}${hasPlugin ? ' (with ChromeCookieUnlock plugin)' : ''}`);
  }

  return args;
}

/**
 * Get optimized yt-dlp arguments with cookie caching for subsequent calls
 * @param {boolean} forceRefresh - Force fresh cookie extraction
 * @returns {Array} - Array of common arguments
 */
function getOptimizedYtDlpArgs(forceRefresh = false) {
  const args = [];

  // Add plugin directory if it exists
  const pluginDir = path.join(process.cwd(), '.venv', 'yt-dlp-plugins');
  if (fs.existsSync(pluginDir)) {
    args.push('--plugin-dirs', pluginDir);
    console.log(`[getOptimizedYtDlpArgs] Using plugin directory: ${pluginDir}`);
  }

  // Check if we should use cached cookies
  const now = Date.now();
  const cacheValid = cookieCache.isValid &&
                    cookieCache.lastExtracted &&
                    (now - cookieCache.lastExtracted) < cookieCache.validityDuration;

  if (!forceRefresh && cacheValid && cookieCache.tempCookieFile && fs.existsSync(cookieCache.tempCookieFile)) {
    // Use cached cookies
    console.log(`[getOptimizedYtDlpArgs] Using cached cookies (${Math.round((now - cookieCache.lastExtracted) / 1000)}s old)`);
    args.push('--cookies', cookieCache.tempCookieFile);
  } else {
    // Use browser cookies (will trigger extraction)
    const availableBrowser = detectAvailableBrowser();
    if (availableBrowser) {
      const hasPlugin = isChromeCookieUnlockAvailable();

      console.log(`[getOptimizedYtDlpArgs] Using browser cookies: ${availableBrowser}${hasPlugin ? ' (with ChromeCookieUnlock plugin)' : ''}`);
      args.push('--cookies-from-browser', availableBrowser);

      // Mark that we're doing fresh extraction
      cookieCache.lastExtracted = now;
      cookieCache.isValid = true;
    }
  }

  return args;
}

/**
 * Check if yt-dlp is installed and get its version
 * @returns {Promise<string>} - yt-dlp version
 */
async function checkYtDlpVersion() {
  const ytDlpPath = getYtDlpPath();

  try {
    const { stdout } = await require('util').promisify(require('child_process').exec)(`"${ytDlpPath}" --version`);
    return stdout.trim();
  } catch (error) {
    console.error('Error checking yt-dlp version:', error.message);
    console.warn('yt-dlp is not installed or not in PATH. Will attempt to use alternative methods.');
    return 'not-installed';
  }
}

module.exports = {
  getYtDlpPath,
  checkYtDlpVersion,
  detectAvailableBrowser,
  getCommonYtDlpArgs,
  getOptimizedYtDlpArgs,
  isChromeCookieUnlockAvailable
};
