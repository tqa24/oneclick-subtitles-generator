/**
 * Windows-safe file operations to handle EBUSY and file locking issues
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Safely delete a file with retry logic and Windows-specific handling
 * @param {string} filePath - Path to the file to delete
 * @param {Object} options - Options for deletion
 * @returns {Promise<boolean>} - True if deleted successfully, false otherwise
 */
async function safeDeleteFile(filePath, options = {}) {
  const {
    maxRetries = 5,
    retryDelay = 1000,
    useWindowsCmd = process.platform === 'win32',
    forceDelete = true
  } = options;

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return true; // Already deleted
  }

  // Try standard deletion first
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try to close any potential file handles by garbage collecting
      if (global.gc) {
        global.gc();
      }

      // Try standard fs.unlinkSync
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted file: ${filePath}`);
      return true;
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOENT') {
        console.log(`Attempt ${attempt}/${maxRetries} failed for ${filePath}: ${error.code}`);
        
        if (attempt === maxRetries) {
          // Last attempt - try Windows-specific methods
          if (useWindowsCmd && forceDelete) {
            console.log(`Trying Windows force delete for: ${filePath}`);
            const success = await forceDeleteWindows(filePath);
            if (success) {
              return true;
            }
          }
          
          console.error(`Failed to delete file after ${maxRetries} attempts: ${filePath}`);
          return false;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      } else {
        console.error(`Unexpected error deleting file ${filePath}:`, error);
        return false;
      }
    }
  }
  
  return false;
}

/**
 * Force delete using Windows command line tools
 * @param {string} filePath - Path to the file to delete
 * @returns {Promise<boolean>} - True if successful
 */
function forceDeleteWindows(filePath) {
  return new Promise((resolve) => {
    // Try using Windows 'del' command with force flags
    const cmd = spawn('cmd', ['/c', 'del', '/f', '/q', `"${filePath}"`], {
      stdio: 'pipe',
      windowsHide: true
    });

    let success = false;

    cmd.on('close', (code) => {
      if (code === 0) {
        success = true;
        console.log(`Windows force delete successful: ${filePath}`);
      } else {
        console.log(`Windows force delete failed with code ${code}: ${filePath}`);
      }
      resolve(success);
    });

    cmd.on('error', (error) => {
      console.error(`Windows force delete error: ${error.message}`);
      resolve(false);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!success) {
        cmd.kill();
        console.log(`Windows force delete timeout: ${filePath}`);
        resolve(false);
      }
    }, 10000);
  });
}

/**
 * Safely delete multiple files with progress reporting
 * @param {string[]} filePaths - Array of file paths to delete
 * @param {Function} onProgress - Progress callback (deletedCount, totalCount, currentFile)
 * @returns {Promise<Object>} - Results object with success/failure counts
 */
async function safeDeleteMultipleFiles(filePaths, onProgress = () => {}) {
  const results = {
    total: filePaths.length,
    deleted: 0,
    failed: 0,
    failedFiles: []
  };

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    onProgress(i, filePaths.length, filePath);

    const success = await safeDeleteFile(filePath);
    if (success) {
      results.deleted++;
    } else {
      results.failed++;
      results.failedFiles.push(filePath);
    }
  }

  onProgress(filePaths.length, filePaths.length, null);
  return results;
}

/**
 * Safely delete a directory and all its contents
 * @param {string} dirPath - Path to the directory to delete
 * @param {Object} options - Options for deletion
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function safeDeleteDirectory(dirPath, options = {}) {
  const { recursive = true } = options;

  if (!fs.existsSync(dirPath)) {
    return true; // Already deleted
  }

  try {
    if (recursive) {
      // Get all files in directory
      const items = fs.readdirSync(dirPath);
      const filePaths = [];

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // Recursively delete subdirectory
          await safeDeleteDirectory(itemPath, options);
        } else {
          filePaths.push(itemPath);
        }
      }

      // Delete all files
      if (filePaths.length > 0) {
        await safeDeleteMultipleFiles(filePaths);
      }
    }

    // Remove the directory itself
    fs.rmdirSync(dirPath);
    console.log(`Successfully deleted directory: ${dirPath}`);
    return true;
  } catch (error) {
    console.error(`Error deleting directory ${dirPath}:`, error);
    return false;
  }
}

module.exports = {
  safeDeleteFile,
  safeDeleteMultipleFiles,
  safeDeleteDirectory,
  forceDeleteWindows
};
