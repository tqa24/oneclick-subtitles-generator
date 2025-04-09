// This file is a bridge to load the actual Electron main process file
// It's needed because Electron looks for this file in the build directory

const path = require('path');
const { app } = require('electron');

// Get the paths to the main process files
const mainPath = path.join(app.getAppPath(), 'electron', 'main.js');
const simpleMainPath = path.join(app.getAppPath(), 'electron', 'main-simple.js');

// Try to load the main process file, fall back to simple version if it fails
try {
  console.log(`Attempting to load main process file from: ${mainPath}`);
  require(mainPath);
  console.log('Successfully loaded main.js');
} catch (error) {
  console.error(`Failed to load main.js: ${error.message}`);
  console.log(`Falling back to simple main process file: ${simpleMainPath}`);

  try {
    require(simpleMainPath);
    console.log('Successfully loaded main-simple.js');
  } catch (fallbackError) {
    console.error(`Failed to load main-simple.js: ${fallbackError.message}`);
    console.error('Both main process files failed to load. Application may not function correctly.');

    // Show error dialog
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Application Error',
      `Failed to initialize the application: ${error.message}\n\nFallback also failed: ${fallbackError.message}\n\nPlease reinstall the application.`
    );
  }
}
