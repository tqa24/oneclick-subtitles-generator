/**
 * Shared utilities for yt-dlp operations
 */

const fs = require('fs');
const path = require('path');

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
  checkYtDlpVersion
};
