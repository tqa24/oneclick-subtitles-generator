/**
 * API routes for application updates
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

/**
 * POST /api/update - Update the application using git pull
 */
router.post('/update', (req, res) => {
  try {
    // Get the root directory of the application
    const rootDir = path.resolve(__dirname, '..', '..');
    
    // Execute git pull command
    exec('git pull', { cwd: rootDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing git pull: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: `Error executing git pull: ${error.message}`
        });
      }
      
      if (stderr && !stderr.includes('Already up to date')) {
        console.error(`Git pull stderr: ${stderr}`);
      }
      
      // Check if already up to date
      if (stdout.includes('Already up to date')) {
        return res.json({
          success: true,
          message: 'Application is already up to date',
          details: stdout
        });
      }
      
      // Return success response
      res.json({
        success: true,
        message: 'Application updated successfully',
        details: stdout
      });
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update application'
    });
  }
});

module.exports = router;
