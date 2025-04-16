/**
 * Script to check if uv is installed and working correctly
 * and if Python 3.11 is available for PyTorch with CUDA
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 Checking uv installation...');

let uvInstalled = false;

try {
  // Check if uv is installed
  const uvVersion = execSync('uv --version', { encoding: 'utf8' }).trim();
  console.log(`✅ uv is installed (version: ${uvVersion})`);
  uvInstalled = true;

  // Check available commands
  console.log('\n🔍 Checking uv commands...');
  const uvHelp = execSync('uv --help', { encoding: 'utf8' });
  console.log(uvHelp);

  // Check run command
  console.log('\n🔍 Checking uv run command...');
  const uvRunHelp = execSync('uv run --help', { encoding: 'utf8' });
  console.log(uvRunHelp);

  console.log('\n✅ uv checks completed successfully');
} catch (error) {
  console.error(`❌ Error checking uv: ${error.message}`);
  console.log('\n🔧 Please make sure uv is installed correctly.');
  console.log('   You can install it with:');
  console.log('   curl -sSf https://astral.sh/uv/install.sh | bash');
}

// Check for Python 3.11
console.log('\n🔍 Checking for Python 3.11...');

try {
  // Try to run python --version
  let pythonVersion;
  let pythonCommand;

  try {
    pythonVersion = execSync('python --version', { encoding: 'utf8' }).trim();
    pythonCommand = 'python';
  } catch (error) {
    try {
      pythonVersion = execSync('python3 --version', { encoding: 'utf8' }).trim();
      pythonCommand = 'python3';
    } catch (error2) {
      throw new Error('Python not found');
    }
  }

  console.log(`Python version: ${pythonVersion}`);

  // Check if it's Python 3.11
  if (!pythonVersion.includes('3.11')) {
    console.log('\n⚠️ Python 3.11 is required for PyTorch with CUDA support.');
    console.log('   Please install Python 3.11 from https://www.python.org/downloads/release/python-3116/');

    // Create a virtual environment with Python 3.11 if available
    if (uvInstalled) {
      console.log('\n🔍 Checking for Python 3.11 in the system...');

      try {
        // Check if py launcher is available (Windows)
        if (process.platform === 'win32') {
          try {
            const pyVersions = execSync('py -0', { encoding: 'utf8' }).trim();
            console.log('Available Python versions:');
            console.log(pyVersions);

            if (pyVersions.includes('3.11')) {
              console.log('\n✅ Python 3.11 found! Creating virtual environment...');

              // Create a virtual environment with Python 3.11
              execSync('uv venv --python 3.11 .venv-py311', { stdio: 'inherit' });
              console.log('\n✅ Virtual environment created at .venv-py311');

              // Create activation scripts
              const activateScript = `@echo off\necho Activating Python 3.11 virtual environment...\n.venv-py311\\Scripts\\activate\n`;
              fs.writeFileSync('activate-py311.bat', activateScript);
              console.log('\n✅ Created activation script: activate-py311.bat');

              console.log('\n🔧 To use this environment:');
              console.log('   1. Run activate-py311.bat');
              console.log('   2. Then run your commands');
              return;
            }
          } catch (error) {
            console.log('py launcher not available');
          }
        }
      } catch (error) {
        console.error(`Error checking for Python 3.11: ${error.message}`);
      }
    }

    console.log('\n❌ Could not find or create a Python 3.11 environment');
    console.log('   Please install Python 3.11 manually from https://www.python.org/downloads/release/python-3116/');
  } else {
    console.log('\n✅ Python 3.11 is available');
  }
} catch (error) {
  console.error(`\n❌ Python check failed: ${error.message}`);
  console.log('   Please install Python 3.11 from https://www.python.org/downloads/release/python-3116/');
}
