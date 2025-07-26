/**
 * Shared utilities for yt-dlp operations
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

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
  getCommonYtDlpArgs
};
