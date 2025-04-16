/**
 * Setup script for F5-TTS integration
 * This script checks if uv is installed and helps with the installation process
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check if uv is installed
function checkUvInstalled() {
  try {
    execSync('uv --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if Python is installed
function checkPythonInstalled() {
  try {
    execSync('python --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Install F5-TTS and dependencies
function installF5TTS() {
  console.log('\n📦 Installing F5-TTS and dependencies...');

  try {
    // Create narration directories
    const narrationDir = path.join(__dirname, 'narration');
    const referenceDir = path.join(narrationDir, 'reference');
    const outputDir = path.join(narrationDir, 'output');

    if (!fs.existsSync(narrationDir)) {
      fs.mkdirSync(narrationDir, { recursive: true });
      console.log('✅ Created narration directory');
    }

    if (!fs.existsSync(referenceDir)) {
      fs.mkdirSync(referenceDir, { recursive: true });
      console.log('✅ Created reference audio directory');
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('✅ Created output audio directory');
    }

    // Create Python virtual environment
    console.log('\n🔧 Creating Python virtual environment...');
    const venvDir = path.join(__dirname, '.venv');
    execSync(`uv venv ${venvDir}`, { stdio: 'inherit' });
    console.log('✅ Created Python virtual environment at .venv');

    // Install F5-TTS
    console.log('\n🔧 Installing F5-TTS...');
    execSync(`uv pip install -e F5-TTS`, { stdio: 'inherit' });

    // Install dependencies
    console.log('\n🔧 Installing Python dependencies...');
    execSync('uv pip install flask flask-cors soundfile numpy torch torchaudio vocos', { stdio: 'inherit' });

    console.log('\n✅ F5-TTS installation complete!');
    console.log('\n📝 You can now run the application with:');
    console.log('   npm run dev');

  } catch (error) {
    console.error('\n❌ Error installing F5-TTS:', error.message);
    console.log('\n🔍 Please check the error message and try again.');
    console.log('   You can also try installing manually as described in F5-TTS-README.md');
  }

  rl.close();
}

// Main function
function main() {
  console.log('🎙️  F5-TTS Setup for Subtitles Generator');
  console.log('=======================================');

  // Check if uv is installed
  const uvInstalled = checkUvInstalled();
  if (!uvInstalled) {
    console.log('\n❌ uv is not installed. Please install uv first:');
    console.log('   https://github.com/astral-sh/uv');
    console.log('\n   You can install it with:');
    console.log('   curl -sSf https://astral.sh/uv/install.sh | bash');
    rl.close();
    return;
  }

  // Check if Python is installed
  const pythonInstalled = checkPythonInstalled();
  if (!pythonInstalled) {
    console.log('\n❌ Python is not installed. Please install Python 3.10 or higher.');
    rl.close();
    return;
  }

  console.log('\n✅ uv is installed');
  console.log('✅ Python is installed');

  // Ask user if they want to proceed with installation
  rl.question('\n🔍 Do you want to install F5-TTS and its dependencies? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      installF5TTS();
    } else {
      console.log('\n🛑 Installation cancelled.');
      console.log('   You can run the installation later with:');
      console.log('   npm run install:f5tts');
      console.log('   npm run install:deps');
      rl.close();
    }
  });
}

// Run the main function
main();
