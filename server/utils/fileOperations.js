/**
 * Safe file operations utilities
 * These utilities help avoid EPERM errors on Windows by using copy-then-delete instead of rename
 */

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

/**
 * Safely move a file by copying it and then deleting the original
 * This avoids EPERM errors on Windows that can occur with rename operations
 * 
 * @param {string} sourcePath - Path to the source file
 * @param {string} destPath - Path to the destination file
 * @returns {Promise<void>} - Promise that resolves when the operation is complete
 */
const safeMoveFile = async (sourcePath, destPath) => {
  try {
    // Make sure the destination directory exists
    const destDir = path.dirname(destPath);
    await fsPromises.mkdir(destDir, { recursive: true });
    
    // Copy the file
    await fsPromises.copyFile(sourcePath, destPath);
    
    // Delete the original file
    try {
      await fsPromises.unlink(sourcePath);
    } catch (deleteError) {
      console.warn(`Warning: Could not delete original file ${sourcePath} after copying: ${deleteError.message}`);
      // Continue anyway since the copy was successful
    }
    
    return destPath;
  } catch (error) {
    console.error(`Error in safeMoveFile from ${sourcePath} to ${destPath}:`, error);
    throw error;
  }
};

/**
 * Synchronous version of safeMoveFile
 * 
 * @param {string} sourcePath - Path to the source file
 * @param {string} destPath - Path to the destination file
 * @returns {string} - Path to the destination file
 */
const safeMoveFileSync = (sourcePath, destPath) => {
  try {
    // Make sure the destination directory exists
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Copy the file
    fs.copyFileSync(sourcePath, destPath);
    
    // Delete the original file
    try {
      fs.unlinkSync(sourcePath);
    } catch (deleteError) {
      console.warn(`Warning: Could not delete original file ${sourcePath} after copying: ${deleteError.message}`);
      // Continue anyway since the copy was successful
    }
    
    return destPath;
  } catch (error) {
    console.error(`Error in safeMoveFileSync from ${sourcePath} to ${destPath}:`, error);
    throw error;
  }
};

module.exports = {
  safeMoveFile,
  safeMoveFileSync
};
