/**
 * Script to install yt-dlp in the virtual environment using uv
 * Enhanced with retry logic and better error handling
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Define the virtual environment directory
const VENV_DIR = '.venv';
const isWindows = os.platform() === 'win32';
const venvBinDir = isWindows ? 'Scripts' : 'bin';
const ytdlpPath = path.join(process.cwd(), VENV_DIR, venvBinDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp');

// Helper function to execute commands with retries
function executeWithRetry(command, options = {}, maxRetries = 3) {
  let retries = 0;
  let lastError = null;

  while (retries < maxRetries) {
    try {
      console.log(`Running command: ${command}`);
      const env = { ...process.env, UV_HTTP_TIMEOUT: '300', ...options.env }; // 5 minutes timeout
      execSync(command, { stdio: 'inherit', env, ...options });
      return true; // Success
    } catch (error) {
      lastError = error;
      retries++;
      console.error(`Attempt ${retries}/${maxRetries} failed: ${error.message}`);

      if (retries < maxRetries) {
        const waitTime = retries * 2000; // Exponential backoff: 2s, 4s, 6s...
        console.log(`Waiting ${waitTime/1000} seconds before retrying...`);
        try {
          execSync(`sleep ${waitTime/1000}`, { stdio: 'ignore' });
        } catch (e) {
          // On Windows, sleep is not available, use a timeout instead
          const startTime = Date.now();
          while (Date.now() - startTime < waitTime) {
            // Wait
          }
        }
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

// Create virtual environment if it doesn't exist
console.log('🔍 Checking for virtual environment...');
if (!fs.existsSync(VENV_DIR)) {
  console.log('⚠️ Virtual environment not found. Creating one...');
  try {
    executeWithRetry('uv venv');
    console.log('✅ Virtual environment created.');
  } catch (error) {
    console.error(`❌ Error creating virtual environment: ${error.message}`);
    console.log('   Trying alternative method...');

    try {
      // Try with python -m venv as fallback
      executeWithRetry('python -m venv .venv');
      console.log('✅ Virtual environment created using python -m venv.');
    } catch (fallbackError) {
      console.error(`❌ All attempts to create virtual environment failed.`);
      console.error(`   Last error: ${fallbackError.message}`);
      process.exit(1);
    }
  }
}

// Install or update yt-dlp
console.log('🔍 Checking if yt-dlp is already installed...');
if (fs.existsSync(ytdlpPath)) {
  console.log('✅ yt-dlp is already installed.');

  // Try to update it
  console.log('🔄 Updating yt-dlp to the latest version...');
  try {
    executeWithRetry('uv pip install --python .venv --upgrade yt-dlp');
    console.log('✅ yt-dlp updated successfully.');
  } catch (error) {
    console.error(`⚠️ Error updating yt-dlp: ${error.message}`);
    console.log('   Continuing with the existing version.');
  }
} else {
  console.log('🔧 Installing yt-dlp...');
  try {
    executeWithRetry('uv pip install --python .venv yt-dlp');
    console.log('✅ yt-dlp installed successfully.');
  } catch (error) {
    console.error(`❌ Error installing yt-dlp with uv: ${error.message}`);
    console.log('   Trying alternative installation method...');

    try {
      // Try with pip as fallback
      if (isWindows) {
        executeWithRetry(`${VENV_DIR}\\${venvBinDir}\\pip install yt-dlp`);
      } else {
        executeWithRetry(`./${VENV_DIR}/${venvBinDir}/pip install yt-dlp`);
      }
      console.log('✅ yt-dlp installed successfully using pip.');
    } catch (fallbackError) {
      console.error(`❌ All attempts to install yt-dlp failed.`);
      console.error(`   Last error: ${fallbackError.message}`);
      console.error(`   YouTube video downloads will not work without yt-dlp.`);
      process.exit(1);
    }
  }
}

// Verify the installation
console.log('🔍 Verifying yt-dlp installation...');
try {
  if (isWindows) {
    // On Windows, we need to use the full path to the executable
    const output = execSync(`"${ytdlpPath}" --version`).toString().trim();
    console.log(`✅ yt-dlp version ${output} is installed and working.`);
  } else {
    // On Unix-like systems, we can use the command directly if the venv is activated
    const output = execSync(`${ytdlpPath} --version`).toString().trim();
    console.log(`✅ yt-dlp version ${output} is installed and working.`);
  }
} catch (error) {
  console.error(`⚠️ Error verifying yt-dlp installation: ${error.message}`);
  console.log('   Attempting to fix the installation...');

  try {
    // Try reinstalling
    if (isWindows) {
      executeWithRetry(`${VENV_DIR}\\${venvBinDir}\\pip uninstall -y yt-dlp`);
      executeWithRetry(`${VENV_DIR}\\${venvBinDir}\\pip install yt-dlp`);
    } else {
      executeWithRetry(`./${VENV_DIR}/${venvBinDir}/pip uninstall -y yt-dlp`);
      executeWithRetry(`./${VENV_DIR}/${venvBinDir}/pip install yt-dlp`);
    }

    // Verify again
    const output = isWindows
      ? execSync(`"${ytdlpPath}" --version`).toString().trim()
      : execSync(`${ytdlpPath} --version`).toString().trim();
    console.log(`✅ yt-dlp version ${output} is now installed and working.`);
  } catch (reinstallError) {
    console.error(`❌ Failed to fix yt-dlp installation: ${reinstallError.message}`);
    console.error(`   YouTube video downloads may not work properly.`);
    // Continue execution but warn the user
  }
}

console.log('\n✅ yt-dlp setup completed!');
console.log('   You can now use yt-dlp for YouTube video downloads.');
console.log('   If you encounter any issues with video downloads, try running:');
console.log('   npm run install:yt-dlp');
