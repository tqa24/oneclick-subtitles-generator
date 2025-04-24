/**
 * Script to install yt-dlp in the virtual environment using uv
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

console.log('🔍 Checking for virtual environment...');
if (!fs.existsSync(VENV_DIR)) {
  console.log('⚠️ Virtual environment not found. Creating one...');
  try {
    execSync('uv venv', { stdio: 'inherit' });
    console.log('✅ Virtual environment created.');
  } catch (error) {
    console.error(`❌ Error creating virtual environment: ${error.message}`);
    process.exit(1);
  }
}

console.log('🔍 Checking if yt-dlp is already installed...');
if (fs.existsSync(ytdlpPath)) {
  console.log('✅ yt-dlp is already installed.');
  
  // Try to update it
  console.log('🔄 Updating yt-dlp to the latest version...');
  try {
    execSync('uv pip install --upgrade yt-dlp', { stdio: 'inherit' });
    console.log('✅ yt-dlp updated successfully.');
  } catch (error) {
    console.error(`⚠️ Error updating yt-dlp: ${error.message}`);
    console.log('   Continuing with the existing version.');
  }
} else {
  console.log('🔧 Installing yt-dlp...');
  try {
    execSync('uv pip install yt-dlp', { stdio: 'inherit' });
    console.log('✅ yt-dlp installed successfully.');
  } catch (error) {
    console.error(`❌ Error installing yt-dlp: ${error.message}`);
    process.exit(1);
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
  console.log('   yt-dlp might not be properly installed or accessible.');
}

console.log('\n✅ yt-dlp setup completed!');
console.log('   You can now use yt-dlp as a fallback for YouTube video downloads.');
