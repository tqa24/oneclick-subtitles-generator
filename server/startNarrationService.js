/**
 * Script to start the F5-TTS narration service and Chatterbox API service
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const NARRATION_PORT = process.env.NARRATION_PORT || 3006;
const ALTERNATIVE_NARRATION_PORT = parseInt(NARRATION_PORT) + 1;
const CHATTERBOX_PORT = process.env.CHATTERBOX_PORT || 3011;
const UV_EXECUTABLE = process.env.UV_EXECUTABLE || 'uv';

// Start the Chatterbox API service
function startChatterboxService() {
  try {
    console.log(`🔧 Starting Chatterbox API service on port ${CHATTERBOX_PORT}...`);

    // Check if Chatterbox directory exists
    const chatterboxDir = path.join(path.dirname(__dirname), 'chatterbox');
    const chatterboxApiPath = path.join(chatterboxDir, 'start_api.py');

    if (!fs.existsSync(chatterboxDir)) {
      console.warn('⚠️  Chatterbox directory not found. Chatterbox service will not be available.');
      console.warn('   Run the setup script to install Chatterbox: npm run setup:narration');
      return null;
    }

    if (!fs.existsSync(chatterboxApiPath)) {
      console.warn('⚠️  Chatterbox start_api.py not found. Chatterbox service will not be available.');
      return null;
    }

    // Set environment variables for Chatterbox
    const env = {
      ...process.env,
      CHATTERBOX_PORT: CHATTERBOX_PORT,
      CUDA_VISIBLE_DEVICES: '0', // Use same CUDA device as F5-TTS
      PYTORCH_CUDA_ALLOC_CONF: 'max_split_size_mb:512'
    };

    // Change to chatterbox directory and start the service
    const chatterboxProcess = spawn(UV_EXECUTABLE, [
      'run',
      '--python',
      '.venv',
      '--',
      'python',
      chatterboxApiPath,
      '--host', '0.0.0.0',
      '--port', CHATTERBOX_PORT.toString(),
      '--reload'
    ], {
      env,
      stdio: 'inherit',
      cwd: path.dirname(__dirname) // Run from project root to access .venv
    });

    // Handle process events
    chatterboxProcess.on('error', (error) => {
      console.error('❌ Failed to start Chatterbox service:', error);
    });

    chatterboxProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Chatterbox service exited with code ${code}`);
      } else {
        console.log('✅ Chatterbox service stopped gracefully');
      }
    });

    console.log(`✅ Chatterbox API service started on http://localhost:${CHATTERBOX_PORT}`);
    console.log(`📖 API documentation: http://localhost:${CHATTERBOX_PORT}/docs`);

    return chatterboxProcess;
  } catch (error) {
    console.error(`❌ Error starting Chatterbox service: ${error.message}`);
    return null;
  }
}

// Start the F5-TTS narration service
function startNarrationService() {


  try {
    // Check if uv is installed
    try {
      const uvVersionOutput = require('child_process').execSync(`${UV_EXECUTABLE} --version`, { encoding: 'utf8' });

    } catch (error) {
      console.error(`Error checking uv version: ${error.message}`);

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

    }

    if (!fs.existsSync(referenceDir)) {
      fs.mkdirSync(referenceDir, { recursive: true });

    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });

    }

    // Check for CUDA support
    try {

      // Create a temporary Python script to check CUDA
      const fs = require('fs');
      const os = require('os');
      const tempFile = path.join(os.tmpdir(), 'check_cuda.py');

      const pythonCode = `
import torch
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'CUDA device count: {torch.cuda.device_count() if torch.cuda.is_available() else 0}')
print(f'CUDA device name: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A"}')
`;

      fs.writeFileSync(tempFile, pythonCode);

      const checkCudaCmd = `${UV_EXECUTABLE} run ${tempFile}`;
      const cudaCheck = require('child_process').execSync(checkCudaCmd, { encoding: 'utf8' });


      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.warn(`Warning: Unable to delete temporary file: ${cleanupError.message}`);
      }

      // If CUDA is not available, print a warning
      if (!cudaCheck.includes('CUDA available: True')) {
        console.warn('WARNING: CUDA is not available. The narration service will run on CPU, which is much slower.');
        console.warn('Make sure your NVIDIA drivers and CUDA toolkit are properly installed.');
      } else {

      }
    } catch (error) {
      console.warn(`Warning: Unable to check CUDA availability: ${error.message}`);
    }

    // Spawn the Python process using uv
    const narrationAppPath = path.join(__dirname, 'narrationApp.py');


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

    console.log(`✅ F5-TTS narration service started on port ${NARRATION_PORT}`);

    // Start Chatterbox service
    const chatterboxProcess = startChatterboxService();

    // Return both processes for cleanup
    return {
      narrationProcess,
      chatterboxProcess
    };
  } catch (error) {
    console.error(`❌ Error starting F5-TTS narration service: ${error.message}`);
    return null;
  }
}

module.exports = {
  startNarrationService,
  startChatterboxService,
  NARRATION_PORT,
  CHATTERBOX_PORT
};
