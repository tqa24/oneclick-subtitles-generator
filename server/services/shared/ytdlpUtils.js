/**
 * Shared utilities for yt-dlp operations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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
  // Determine if we're running in packaged Electron mode
  const isPackaged = process.env.ELECTRON_RUN_AS_PACKAGED === '1' || process.execPath.includes('One-Click Subtitles Generator.exe');
  
  // Use ELECTRON_RESOURCES_PATH env var because process.resourcesPath is not available in child Node processes
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH || process.resourcesPath;
  
  let venvPath;
  if (isPackaged) {
    // In packaged mode, use the bundled Python venv
    venvPath = path.join(resourcesPath, 'python-venv', 'venv');
  } else {
    // In development, check both .venv and bin/python-wheelhouse/venv
    const devVenvPath = path.join(process.cwd(), '.venv');
    const wheelhouseVenvPath = path.join(process.cwd(), 'bin', 'python-wheelhouse', 'venv');
    
    // Prefer .venv if it exists, otherwise use wheelhouse
    venvPath = fs.existsSync(devVenvPath) ? devVenvPath : wheelhouseVenvPath;
  }
  
  const venvBinDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  const venvYtDlpPath = path.join(venvPath, venvBinDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

  if (fs.existsSync(venvYtDlpPath)) {
    console.log(`[getYtDlpPath] Found yt-dlp at: ${venvYtDlpPath}`);
    return venvYtDlpPath;
  }

  console.warn(`[getYtDlpPath] yt-dlp not found at ${venvYtDlpPath}, falling back to PATH`);
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

  // Determine if we're running in packaged Electron mode
  const isPackaged = process.env.ELECTRON_RUN_AS_PACKAGED === '1' || process.execPath.includes('One-Click Subtitles Generator.exe');
  
  // Use ELECTRON_RESOURCES_PATH env var because process.resourcesPath is not available in child Node processes
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH || process.resourcesPath;
  
  // Check venv-relative path first (this is where our setup installs it)
  let venvPluginsDir;
  if (isPackaged) {
    venvPluginsDir = path.join(resourcesPath, 'python-venv', 'venv', 'yt-dlp-plugins', 'ChromeCookieUnlock');
  } else {
    const devVenvPath = path.join(process.cwd(), '.venv');
    const wheelhouseVenvPath = path.join(process.cwd(), 'bin', 'python-wheelhouse', 'venv');
    const venvPath = fs.existsSync(devVenvPath) ? devVenvPath : wheelhouseVenvPath;
    venvPluginsDir = path.join(venvPath, 'yt-dlp-plugins', 'ChromeCookieUnlock');
  }
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

  // Determine if we're running in packaged Electron mode
  const isPackaged = process.env.ELECTRON_RUN_AS_PACKAGED === '1' || process.execPath.includes('One-Click Subtitles Generator.exe');
  
  // Use ELECTRON_RESOURCES_PATH env var because process.resourcesPath is not available in child Node processes
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH || process.resourcesPath;
  
  // Add plugin directory if it exists
  let pluginDir;
  if (isPackaged) {
    pluginDir = path.join(resourcesPath, 'python-venv', 'venv', 'yt-dlp-plugins');
  } else {
    const devVenvPath = path.join(process.cwd(), '.venv');
    const wheelhouseVenvPath = path.join(process.cwd(), 'bin', 'python-wheelhouse', 'venv');
    const venvPath = fs.existsSync(devVenvPath) ? devVenvPath : wheelhouseVenvPath;
    pluginDir = path.join(venvPath, 'yt-dlp-plugins');
  }
  
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
 * Extract cookies to a file for caching
 * @returns {Promise<string>} - Path to the cookie file
 */
async function extractCookiesToFile() {
  const availableBrowser = detectAvailableBrowser();
  if (!availableBrowser) {
    throw new Error('No browser available for cookie extraction');
  }

  const ytdlpPath = getYtDlpPath();
  
  // Determine if we're running in packaged Electron mode
  const isPackaged = process.env.ELECTRON_RUN_AS_PACKAGED === '1' || process.execPath.includes('One-Click Subtitles Generator.exe');
  
  // Use ELECTRON_RESOURCES_PATH env var because process.resourcesPath is not available in child Node processes
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH || process.resourcesPath;
  
  let pluginDir;
  if (isPackaged) {
    pluginDir = path.join(resourcesPath, 'python-venv', 'venv', 'yt-dlp-plugins');
  } else {
    const devVenvPath = path.join(process.cwd(), '.venv');
    const wheelhouseVenvPath = path.join(process.cwd(), 'bin', 'python-wheelhouse', 'venv');
    const venvPath = fs.existsSync(devVenvPath) ? devVenvPath : wheelhouseVenvPath;
    pluginDir = path.join(venvPath, 'yt-dlp-plugins');
  }

  const args = [];

  // Add plugin directory if it exists
  if (fs.existsSync(pluginDir)) {
    args.push('--plugin-dirs', pluginDir);
  }

  args.push(
    '--cookies-from-browser', availableBrowser,
    '--cookies', cookieCache.tempCookieFile,
    '--print', 'cookies_extracted',
    '--no-download',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // Dummy URL just to trigger cookie extraction
  );

  console.log(`[extractCookiesToFile] Extracting cookies to: ${cookieCache.tempCookieFile}`);

  return new Promise((resolve, reject) => {
    const process = spawn(ytdlpPath, args);

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
      if (errorOutput.includes('Attempting to unlock cookies')) {
        console.log('[extractCookiesToFile] Cookie extraction in progress...');
      }
    });

    process.on('close', (code) => {
      if (code === 0 && fs.existsSync(cookieCache.tempCookieFile)) {
        console.log('[extractCookiesToFile] Cookies extracted successfully');
        cookieCache.lastExtracted = Date.now();
        cookieCache.isValid = true;
        resolve(cookieCache.tempCookieFile);
      } else {
        console.error('[extractCookiesToFile] Cookie extraction failed:', errorOutput);
        reject(new Error('Cookie extraction failed'));
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      process.kill();
      reject(new Error('Cookie extraction timeout'));
    }, 300000);
  });
}

/**
 * Get yt-dlp arguments with conditional cookie support
 * @param {boolean} useCookies - Whether to use browser cookies
 * @param {boolean} forceRefresh - Force fresh cookie extraction
 * @returns {Array} - Array of common arguments
 */
function getYtDlpArgs(useCookies = false, forceRefresh = false) {
  const args = [];

  console.log(`[getYtDlpArgs] Called with useCookies:`, useCookies, typeof useCookies);

  // Determine if we're running in packaged Electron mode
  const isPackaged = process.env.ELECTRON_RUN_AS_PACKAGED === '1' || process.execPath.includes('One-Click Subtitles Generator.exe');
  
  // Use ELECTRON_RESOURCES_PATH env var because process.resourcesPath is not available in child Node processes
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH || process.resourcesPath;
  
  // Add plugin directory if it exists
  let pluginDir;
  if (isPackaged) {
    pluginDir = path.join(resourcesPath, 'python-venv', 'venv', 'yt-dlp-plugins');
  } else {
    const devVenvPath = path.join(process.cwd(), '.venv');
    const wheelhouseVenvPath = path.join(process.cwd(), 'bin', 'python-wheelhouse', 'venv');
    const venvPath = fs.existsSync(devVenvPath) ? devVenvPath : wheelhouseVenvPath;
    pluginDir = path.join(venvPath, 'yt-dlp-plugins');
  }
  
  if (fs.existsSync(pluginDir)) {
    args.push('--plugin-dirs', pluginDir);
    console.log(`[getYtDlpArgs] Using plugin directory: ${pluginDir}`);
  }

  // Only add cookie arguments if useCookies is true
  if (useCookies) {
    // Check if we should use cached cookies
    const now = Date.now();
    const cacheValid = cookieCache.isValid &&
                      cookieCache.lastExtracted &&
                      (now - cookieCache.lastExtracted) < cookieCache.validityDuration;

    if (!forceRefresh && cacheValid && fs.existsSync(cookieCache.tempCookieFile)) {
      // Use cached cookies
      const ageSeconds = Math.round((now - cookieCache.lastExtracted) / 1000);
      console.log(`[getYtDlpArgs] Using cached cookies (${ageSeconds}s old)`);
      args.push('--cookies', cookieCache.tempCookieFile);
    } else {
      // Use browser cookies (will trigger extraction)
      const availableBrowser = detectAvailableBrowser();
      if (availableBrowser) {
        const hasPlugin = isChromeCookieUnlockAvailable();

        console.log(`[getYtDlpArgs] Using browser cookies: ${availableBrowser}${hasPlugin ? ' (with ChromeCookieUnlock plugin)' : ''} - will extract fresh cookies`);
        args.push('--cookies-from-browser', availableBrowser);

        // DON'T mark as extracted yet - wait for actual extraction to complete
        // cookieCache.lastExtracted = now;
        // cookieCache.isValid = true;
      }
    }
  } else {
    console.log(`[getYtDlpArgs] Cookie usage disabled - downloading without authentication`);
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

  // Determine if we're running in packaged Electron mode
  const isPackaged = process.env.ELECTRON_RUN_AS_PACKAGED === '1' || process.execPath.includes('One-Click Subtitles Generator.exe');
  
  // Use ELECTRON_RESOURCES_PATH env var because process.resourcesPath is not available in child Node processes
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH || process.resourcesPath;
  
  // Add plugin directory if it exists
  let pluginDir;
  if (isPackaged) {
    pluginDir = path.join(resourcesPath, 'python-venv', 'venv', 'yt-dlp-plugins');
  } else {
    const devVenvPath = path.join(process.cwd(), '.venv');
    const wheelhouseVenvPath = path.join(process.cwd(), 'bin', 'python-wheelhouse', 'venv');
    const venvPath = fs.existsSync(devVenvPath) ? devVenvPath : wheelhouseVenvPath;
    pluginDir = path.join(venvPath, 'yt-dlp-plugins');
  }
  
  if (fs.existsSync(pluginDir)) {
    args.push('--plugin-dirs', pluginDir);
    console.log(`[getOptimizedYtDlpArgs] Using plugin directory: ${pluginDir}`);
  }

  // Check if we should use cached cookies
  const now = Date.now();
  const cacheValid = cookieCache.isValid &&
                    cookieCache.lastExtracted &&
                    (now - cookieCache.lastExtracted) < cookieCache.validityDuration;

  if (!forceRefresh && cacheValid && fs.existsSync(cookieCache.tempCookieFile)) {
    // Use cached cookies
    const ageSeconds = Math.round((now - cookieCache.lastExtracted) / 1000);
    console.log(`[getOptimizedYtDlpArgs] Using cached cookies (${ageSeconds}s old)`);
    args.push('--cookies', cookieCache.tempCookieFile);
  } else {
    // Use browser cookies (will trigger extraction)
    const availableBrowser = detectAvailableBrowser();
    if (availableBrowser) {
      const hasPlugin = isChromeCookieUnlockAvailable();

      console.log(`[getOptimizedYtDlpArgs] Using browser cookies: ${availableBrowser}${hasPlugin ? ' (with ChromeCookieUnlock plugin)' : ''} - will extract fresh cookies`);
      args.push('--cookies-from-browser', availableBrowser);

      // DON'T mark as extracted yet - wait for actual extraction to complete
      // cookieCache.lastExtracted = now;
      // cookieCache.isValid = true;
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
  getYtDlpArgs,
  getOptimizedYtDlpArgs,
  extractCookiesToFile,
  isChromeCookieUnlockAvailable
};
