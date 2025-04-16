/**
 * Script to start the F5-TTS narration service
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const NARRATION_PORT = process.env.NARRATION_PORT || 3006;
const ALTERNATIVE_NARRATION_PORT = parseInt(NARRATION_PORT) + 1;
const UV_EXECUTABLE = process.env.UV_EXECUTABLE || 'uv';

// Start the narration service
function startNarrationService() {
  console.log('Starting F5-TTS narration service...');

  try {
    // Check if uv is installed
    try {
      const uvVersionOutput = require('child_process').execSync(`${UV_EXECUTABLE} --version`, { encoding: 'utf8' });
      console.log(`uv version: ${uvVersionOutput.trim()}`);
    } catch (error) {
      console.error(`Error checking uv version: ${error.message}`);
      console.log('Make sure uv is installed and in your PATH');
      return null;
    }

    // Set environment variables - force CUDA usage
    const env = {
      ...process.env,
      NARRATION_PORT: NARRATION_PORT,
      CUDA_VISIBLE_DEVICES: '0', // Force use of first CUDA device
      PYTORCH_CUDA_ALLOC_CONF: 'max_split_size_mb:512' // Avoid memory fragmentation issues
    };

    // Create narration directories if they don't exist
    const narrationDir = path.join(path.dirname(__dirname), 'narration');
    const referenceDir = path.join(narrationDir, 'reference');
    const outputDir = path.join(narrationDir, 'output');

    if (!fs.existsSync(narrationDir)) {
      fs.mkdirSync(narrationDir, { recursive: true });
      console.log(`Created narration directory at ${narrationDir}`);
    }

    if (!fs.existsSync(referenceDir)) {
      fs.mkdirSync(referenceDir, { recursive: true });
      console.log(`Created reference audio directory at ${referenceDir}`);
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output audio directory at ${outputDir}`);
    }

    // Check for CUDA support 
    try {
      console.log('Checking for CUDA support...');
      const checkCudaCmd = `${UV_EXECUTABLE} run -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA device count: {torch.cuda.device_count() if torch.cuda.is_available() else 0}'); print(f'CUDA device name: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"`;
      const cudaCheck = require('child_process').execSync(checkCudaCmd, { encoding: 'utf8' });
      console.log(`CUDA check results: ${cudaCheck.trim()}`);
      
      // If CUDA is not available, print a warning
      if (!cudaCheck.includes('CUDA available: True')) {
        console.warn('WARNING: CUDA is not available. The narration service will run on CPU, which is much slower.');
        console.warn('Make sure your NVIDIA drivers and CUDA toolkit are properly installed.');
      } else {
        console.log('CUDA is available and will be used for the narration service.');
      }
    } catch (error) {
      console.warn(`Warning: Unable to check CUDA availability: ${error.message}`);
    }

    // Spawn the Python process using uv
    const narrationAppPath = path.join(__dirname, 'narrationApp.py');
    console.log(`Starting narration service with: ${UV_EXECUTABLE} run ${narrationAppPath}`);

    const narrationProcess = spawn(UV_EXECUTABLE, ['run', narrationAppPath], {
      env,
      stdio: 'inherit'
    });

    // Handle process events
    narrationProcess.on('error', (error) => {
      console.error('Failed to start narration service:', error);
    });

    narrationProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Narration service exited with code ${code}`);
      }
    });

    // Return the process for cleanup
    return narrationProcess;
  } catch (error) {
    console.error(`Error starting narration service: ${error.message}`);
    return null;
  }
}

module.exports = {
  startNarrationService,
  NARRATION_PORT
};
