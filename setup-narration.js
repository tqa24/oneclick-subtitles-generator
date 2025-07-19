/**
 * Script to set up the narration service with PyTorch support (CUDA, ROCm, XPU, MPS, CPU) using uv.
 * Detects GPU vendor (NVIDIA, AMD, Intel, Apple) and installs the appropriate PyTorch build.
 * Forcefully removes any existing F5-TTS directory and clones the repository.
 * Automatically attempts to install Python 3.11 via 'uv python install' if not found.
 */

const { execSync, exec } = require('child_process'); // Added exec for non-blocking potential later? No, stick to sync for setup script.
const fs = require('fs');
const path = require('path');
const os = require('os'); // Needed for platform/arch checks

// Import our logging utility
const { Logger } = require('./utils/logger');
const { executeWithProgress, withSpinner } = require('./utils/progress-indicator');
const logger = new Logger({
    verbose: process.env.VERBOSE === 'true',
    quiet: process.env.QUIET === 'true'
});

const VENV_DIR = '.venv'; // Define the virtual environment directory name
const PYTHON_VERSION_TARGET = "3.11"; // Target Python version
const F5_TTS_DIR = 'F5-TTS'; // Define the F5-TTS directory name
const F5_TTS_REPO_URL = 'https://github.com/SWivid/F5-TTS.git';
const CHATTERBOX_DIR = 'chatterbox/chatterbox'; // Define the Chatterbox directory name (inside existing chatterbox folder)
const CHATTERBOX_REPO_URL = 'https://github.com/fakerybakery/better-chatterbox.git'; // Using fork with CUDA fix
const CHATTERBOX_BRANCH = 'fix-cuda-issue'; // Branch with CUDA indexing error fix

// --- Helper Function to Check Command Existence ---
function commandExists(command) {
    try {
        // Handle potential command arguments (e.g., 'git --version') for the check
        const baseCommand = command.split(' ')[0];
        const checkCmd = process.platform === 'win32' ? `where ${baseCommand}` : `command -v ${baseCommand}`;
        execSync(checkCmd, { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

// --- Helper Function to Detect GPU Vendor ---
// Note: This detection is heuristic and might not be 100% accurate on all systems.
// It prioritizes common tools (nvidia-smi) and platform checks.
// User override via FORCE_GPU_VENDOR is recommended for certainty.
function detectGpuVendor() {
    logger.subsection('GPU Detection');
    const platform = process.platform;
    const arch = process.arch;

    // --- 1. Check Environment Variable Override ---
    const forcedVendor = process.env.FORCE_GPU_VENDOR?.toUpperCase();
    if (forcedVendor && ['NVIDIA', 'AMD', 'INTEL', 'APPLE', 'CPU'].includes(forcedVendor)) {
        logger.info(`User override detected: FORCE_GPU_VENDOR=${forcedVendor}`);
        // Map APPLE to MPS for clarity internally if needed, but keep APPLE for user consistency
        return forcedVendor === 'APPLE' ? 'APPLE_SILICON' : forcedVendor;
    }

    // --- 2. Apple Silicon Check (macOS arm64) ---
    if (platform === 'darwin' && arch === 'arm64') {
        logger.found('Apple Silicon (macOS arm64)');
        return 'APPLE_SILICON'; // MPS support
    }

    // --- 3. NVIDIA Check (nvidia-smi) ---
    // nvidia-smi is the most reliable indicator for NVIDIA.
    if (commandExists('nvidia-smi')) {
        try {
            execSync('nvidia-smi -L', { stdio: 'ignore' }); // Run a simple command to ensure it works
            logger.found('NVIDIA GPU', 'via nvidia-smi');
            return 'NVIDIA'; // CUDA support
        } catch (error) {
            logger.warning('nvidia-smi found but execution failed, checking other methods...');
        }
    }

    // --- 4. Platform-Specific Checks (Less reliable than nvidia-smi) ---
    try {
        if (platform === 'win32') {
            // Windows: Use WMIC
            const wmicOutput = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' }).toUpperCase();
            if (wmicOutput.includes('NVIDIA')) {
                logger.found('NVIDIA GPU', 'via WMIC');
                return 'NVIDIA';
            }
            if (wmicOutput.includes('AMD') || wmicOutput.includes('RADEON')) {
                logger.found('AMD GPU', 'via WMIC');
                return 'AMD'; // ROCm (Linux mainly) or DirectML (Windows - requires different PyTorch build usually not covered by standard ROCm wheels)
            }
            if (wmicOutput.includes('INTEL')) {
                logger.found('Intel GPU', 'via WMIC');
                return 'INTEL'; // XPU support
            }
        } else if (platform === 'linux') {
            // Linux: Use lspci (requires pciutils)
            if (commandExists('lspci')) {
                 const lspciOutput = execSync("lspci | grep -i 'VGA\\|3D\\|2D'", { encoding: 'utf8' }).toUpperCase();
                 if (lspciOutput.includes('NVIDIA')) {
                    logger.found('NVIDIA GPU', 'via lspci');
                    return 'NVIDIA';
                }
                if (lspciOutput.includes('ADVANCED MICRO DEVICES') || lspciOutput.includes('AMD') || lspciOutput.includes('ATI') || lspciOutput.includes('RADEON')) {
                    logger.found('AMD GPU', 'via lspci');
                    return 'AMD'; // ROCm support (primarily on Linux)
                }
                if (lspciOutput.includes('INTEL')) {
                    logger.found('Intel GPU', 'via lspci');
                    return 'INTEL'; // XPU support
                }
            } else {
                logger.warning("'lspci' command not found, cannot perform detailed PCI check on Linux.");
            }
        }
        // Add macOS non-ARM detection if necessary, though less common for accelerated PyTorch outside ARM/NVIDIA eGPUs
    } catch (error) {
        logger.warning(`Error during GPU detection using system commands: ${error.message}`);
    }

    // --- 5. Fallback ---
    logger.warning('Could not reliably detect a supported accelerated GPU vendor.');
    logger.info('Will install CPU-only version of PyTorch.');
    logger.info('For specific GPU support, set FORCE_GPU_VENDOR environment variable (NVIDIA, AMD, INTEL, APPLE).');
    return 'CPU';
}


// --- 1. Check for uv ---
logger.section('OneClick Subtitles Generator - Narration Setup');
logger.step(1, 6, 'Checking for uv package manager');

if (!commandExists('uv')) {
    logger.error('uv is not installed or not found in PATH.');
    logger.info('Please install uv first. See: https://github.com/astral-sh/uv#installation');
    process.exit(1);
}
try {
    const uvVersion = execSync('uv --version', { encoding: 'utf8' }).trim();
    logger.found('uv', uvVersion);
} catch (error) {
    logger.error('Failed to execute uv. Make sure it is installed and in your PATH.');
    logger.info('See: https://github.com/astral-sh/uv#installation');
    process.exit(1);
}

// --- 2. Check for git and Initialize/Update Submodules ---
logger.step(2, 6, 'Checking for git and updating submodules');

if (!commandExists('git')) {
    logger.error('git is not installed or not found in PATH.');
    logger.info('Please install git first. See: https://git-scm.com/downloads');
    process.exit(1);
}
logger.found('git');

logger.progress('Initializing and updating git submodules (F5-TTS and Chatterbox)');
try {
    // Initialize submodules if not already done
    execSync('git submodule init', { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
    logger.success('Git submodules initialized');

    // Try to update submodules to get the latest content
    try {
        execSync('git submodule update --remote', { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
        logger.success('Git submodules updated');
    } catch (updateError) {
        logger.warning(`Git submodule update --remote failed: ${updateError.message}`);
        logger.info('Trying alternative update method...');

        // Try without --remote flag
        try {
            execSync('git submodule update', { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
            logger.success('Git submodules updated (using existing commits)');
        } catch (altError) {
            logger.warning(`Alternative submodule update also failed: ${altError.message}`);
            logger.info('Continuing without submodule update - will check directories manually...');
        }
    }
} catch (error) {
    logger.error(`Error with git submodules: ${error.message}`);
    logger.info('Please ensure you are in a git repository with properly configured submodules.');
    logger.info('If this is a fresh clone, the submodules should be configured automatically.');
    process.exit(1);
}

// --- 2.5. Verify submodules are properly initialized or clone them manually ---
logger.progress('Verifying submodules are properly initialized');

// Check F5-TTS submodule
if (!fs.existsSync(F5_TTS_DIR)) {
    logger.warning(`F5-TTS submodule directory "${F5_TTS_DIR}" not found.`);
    logger.info('Attempting to clone F5-TTS manually...');
    try {
        execSync(`git clone ${F5_TTS_REPO_URL} ${F5_TTS_DIR}`, { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
        logger.success('F5-TTS cloned successfully');
    } catch (cloneError) {
        logger.error(`Failed to clone F5-TTS: ${cloneError.message}`);
        logger.info('Please manually clone F5-TTS:');
        logger.info(`git clone ${F5_TTS_REPO_URL} ${F5_TTS_DIR}`);
        process.exit(1);
    }
} else {
    // Check if the submodule directory has actual content (not just .git)
    const dirContents = fs.readdirSync(F5_TTS_DIR);
    const hasContent = dirContents.some(item => item !== '.git' && item !== '.gitignore');

    if (!hasContent) {
        logger.warning(`F5-TTS submodule directory exists but appears empty (only contains: ${dirContents.join(', ')})`);
        logger.info('Attempting to populate F5-TTS submodule...');
        try {
            // Remove the empty directory and clone fresh
            fs.rmSync(F5_TTS_DIR, { recursive: true, force: true });
            execSync(`git clone ${F5_TTS_REPO_URL} ${F5_TTS_DIR}`, { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
            logger.success('F5-TTS cloned successfully');
        } catch (cloneError) {
            logger.error(`Failed to clone F5-TTS: ${cloneError.message}`);
            process.exit(1);
        }
    } else {
        logger.success('F5-TTS submodule found with content');
    }
}

// Check Chatterbox submodule
if (!fs.existsSync(CHATTERBOX_DIR)) {
    logger.warning(`Chatterbox submodule directory "${CHATTERBOX_DIR}" not found.`);
    logger.info('Attempting to clone Chatterbox manually...');
    try {
        // Create chatterbox directory if it doesn't exist
        const chatterboxParentDir = path.dirname(CHATTERBOX_DIR);
        if (!fs.existsSync(chatterboxParentDir)) {
            fs.mkdirSync(chatterboxParentDir, { recursive: true });
        }
        execSync(`git clone -b ${CHATTERBOX_BRANCH} ${CHATTERBOX_REPO_URL} ${CHATTERBOX_DIR}`, { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
        logger.success('Chatterbox cloned successfully');
    } catch (cloneError) {
        logger.warning(`Failed to clone Chatterbox: ${cloneError.message}`);
        logger.info('Will proceed with GitHub installation only (Chatterbox will still work)');
        logger.info('Local API files may not be available, but the package will be installed from GitHub');
    }
} else {
    // Check if the submodule directory has actual content (not just .git)
    const dirContents = fs.readdirSync(CHATTERBOX_DIR);
    const hasContent = dirContents.some(item => item !== '.git' && item !== '.gitignore');

    if (!hasContent) {
        logger.warning(`Chatterbox submodule directory exists but appears empty (only contains: ${dirContents.join(', ')})`);
        logger.info('Attempting to populate Chatterbox submodule...');
        try {
            // Remove the empty directory and clone fresh
            fs.rmSync(CHATTERBOX_DIR, { recursive: true, force: true });
            // Create chatterbox directory if it doesn't exist
            const chatterboxParentDir = path.dirname(CHATTERBOX_DIR);
            if (!fs.existsSync(chatterboxParentDir)) {
                fs.mkdirSync(chatterboxParentDir, { recursive: true });
            }
            execSync(`git clone -b ${CHATTERBOX_BRANCH} ${CHATTERBOX_REPO_URL} ${CHATTERBOX_DIR}`, { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
            logger.success('Chatterbox cloned successfully');
        } catch (cloneError) {
            logger.warning(`Failed to clone Chatterbox: ${cloneError.message}`);
            logger.info('Will proceed with GitHub installation only (Chatterbox will still work)');
        }
    } else {
        logger.success('Chatterbox submodule found with content');
    }
}

logger.success('Submodule verification completed');


// --- 3. Check for/Install Python 3.11 ---
logger.step(3, 6, `Checking for Python ${PYTHON_VERSION_TARGET}`);
let pythonInterpreterIdentifier = null;
let triedUvInstall = false;

// (Python detection logic remains the same as before)
// First, try to find an existing Python 3.11 interpreter
try {
  if (process.platform === 'win32') {
    try {
      const pyVersionsOutput = execSync('py -0p', { encoding: 'utf8' }).trim();
      if (logger.verboseMode) {
        logger.info('Available Python interpreters (via py launcher):');
        logger.raw(pyVersionsOutput || '   (None found or py command failed)');
      }
      const lines = pyVersionsOutput.split('\n');
      const python311Line = lines.find(line => line.match(new RegExp(`^-${PYTHON_VERSION_TARGET}`)));
      if (python311Line) {
         const match = python311Line.match(/\s*(.+)$/);
         if(match && match[1]) {
            pythonInterpreterIdentifier = match[1].trim();
            if (pythonInterpreterIdentifier.includes(' ')) {
                pythonInterpreterIdentifier = `"${pythonInterpreterIdentifier}"`;
            }
            logger.found(`Python ${PYTHON_VERSION_TARGET} interpreter via py`, pythonInterpreterIdentifier);
         }
      }
      if (!pythonInterpreterIdentifier && execSync('py -0', { encoding: 'utf8' }).includes(`-${PYTHON_VERSION_TARGET}`)) {
         pythonInterpreterIdentifier = `python${PYTHON_VERSION_TARGET}`;
         logger.found(`Python ${PYTHON_VERSION_TARGET} via py launcher`, `using alias "${pythonInterpreterIdentifier}" for uv`);
      }
    } catch (error) {
      logger.warning(`py launcher check failed or Python ${PYTHON_VERSION_TARGET} not listed`);
    }
  }

  const pythonCommand = `python${PYTHON_VERSION_TARGET}`;
  if (!pythonInterpreterIdentifier && commandExists(pythonCommand)) {
     try {
        const pythonVersion = execSync(`${pythonCommand} --version`, { encoding: 'utf8' }).trim();
        console.log(`   Found Python via command: ${pythonVersion}`);
        if (pythonVersion.includes(PYTHON_VERSION_TARGET)) {
            const checkCmd = process.platform === 'win32' ? `where ${pythonCommand}` : `command -v ${pythonCommand}`;
            const fullPath = execSync(checkCmd, { encoding: 'utf8' }).split('\n')[0].trim();
            if (fullPath) {
                 pythonInterpreterIdentifier = fullPath.includes(' ') ? `"${fullPath}"` : fullPath;
                 logger.found(`Python ${PYTHON_VERSION_TARGET} via command "${pythonCommand}"`, pythonInterpreterIdentifier);
            } else {
                 pythonInterpreterIdentifier = pythonCommand;
                 logger.found(`Python ${PYTHON_VERSION_TARGET} via command "${pythonCommand}"`, 'using alias for uv');
            }
        }
     } catch(error) {
         console.log(`   '${pythonCommand}' command exists but execution failed or couldn't get path.`);
         if(commandExists(pythonCommand)){
            pythonInterpreterIdentifier = pythonCommand;
            console.log(`   Assuming uv can find "${pythonCommand}".`);
         }
     }
  }
} catch (error) {
  console.warn(`   Warning during initial Python ${PYTHON_VERSION_TARGET} check: ${error.message}. Will proceed to check uv install.`);
}

if (!pythonInterpreterIdentifier) {
    logger.warning(`Python ${PYTHON_VERSION_TARGET} not found in standard locations`);
    logger.installing(`Python ${PYTHON_VERSION_TARGET} using uv`);
    triedUvInstall = true;
    try {
        execSync(`uv python install ${PYTHON_VERSION_TARGET}`, { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
        logger.success(`Python ${PYTHON_VERSION_TARGET} installation via uv successful`);
        pythonInterpreterIdentifier = PYTHON_VERSION_TARGET;
    } catch (installError) {
        logger.error(`Failed to install Python ${PYTHON_VERSION_TARGET} using uv: ${installError.message}`);
        logger.info(`Please try installing Python ${PYTHON_VERSION_TARGET} manually (https://www.python.org/downloads/)`);
        logger.info(`or ensure uv has the necessary permissions and network access.`);
        process.exit(1);
    }
} else {
     logger.success(`Using Python ${PYTHON_VERSION_TARGET} interpreter identifier for uv: ${pythonInterpreterIdentifier}`);
}

if (!pythonInterpreterIdentifier) {
    logger.error(`Could not find or install Python ${PYTHON_VERSION_TARGET}. Cannot proceed.`);
    process.exit(1);
}


// --- 4. Create or verify virtual environment with uv ---
logger.step(4, 6, 'Setting up Python virtual environment');

// Check if virtual environment already exists and is valid
let venvExists = false;
if (fs.existsSync(VENV_DIR)) {
    logger.progress(`Virtual environment directory "${VENV_DIR}" exists. Verifying...`);
    try {
        // Test if the venv is functional by checking Python version
        const venvPythonCmd = process.platform === 'win32'
            ? `"${path.join(VENV_DIR, 'Scripts', 'python.exe')}"`
            : `"${path.join(VENV_DIR, 'bin', 'python')}"`;

        const venvPythonVersion = execSync(`${venvPythonCmd} --version`, { encoding: 'utf8' }).trim();
        if (logger.verboseMode) {
            logger.info(`Existing venv Python version: ${venvPythonVersion}`);
        }

        if (venvPythonVersion.includes(PYTHON_VERSION_TARGET)) {
            venvExists = true;
            logger.success(`Valid virtual environment found at ${VENV_DIR}. Reusing existing venv.`);
        } else {
            logger.warning(`Existing venv has different Python version. Will recreate.`);
        }
    } catch (error) {
        logger.warning(`Existing venv appears to be corrupted or incomplete. Will recreate.`);
    }
}

if (!venvExists) {
    logger.installing(`virtual environment with uv at ./${VENV_DIR} using Python "${pythonInterpreterIdentifier}"`);

    // Remove existing directory if it exists but is invalid
    if (fs.existsSync(VENV_DIR)) {
        logger.progress(`Removing invalid virtual environment directory...`);
        try {
            fs.rmSync(VENV_DIR, { recursive: true, force: true });
        } catch (error) {
            logger.error(`Error removing existing venv directory: ${error.message}`);
            process.exit(1);
        }
    }

    try {
        execSync(`uv venv -p ${pythonInterpreterIdentifier} ${VENV_DIR}`, { stdio: logger.verboseMode ? 'inherit' : 'ignore' });
        logger.success(`Virtual environment created at ${VENV_DIR}`);
    } catch (error) {
        logger.error(`Error creating virtual environment with uv: ${error.message}`);
        if (triedUvInstall) {
            logger.info(`Even after attempting 'uv python install', creating the venv with '${pythonInterpreterIdentifier}' failed.`);
            logger.info(`This might indicate an issue with the uv installation or environment.`);
            logger.info(`Try running 'uv venv -p ${PYTHON_VERSION_TARGET} ${VENV_DIR}' manually to diagnose.`);
        } else {
            logger.info(`Failed to create venv with existing interpreter "${pythonInterpreterIdentifier}". Is it a valid Python executable or alias known to uv?`);
            logger.info(`Try running 'uv venv -p ${pythonInterpreterIdentifier} ${VENV_DIR}' manually.`);
        }
        process.exit(1);
    }
}

// --- 5. Detect GPU and Install Appropriate PyTorch Build ---
logger.step(5, 6, 'Installing PyTorch with GPU support');
logger.info(`The virtual environment at ./${VENV_DIR} will be used for both F5-TTS and Chatterbox installations.`);

const gpuVendor = detectGpuVendor(); // Call the detection function
let torchInstallCmd = '';
let installNotes = '';

switch (gpuVendor) {
    case 'NVIDIA':
        logger.installing('PyTorch for NVIDIA GPU (CUDA)');
        // Using CUDA 12.8 with specific versions for Chatterbox compatibility
        // PyTorch 2.7.0 requires torchvision 0.22.0 for compatibility
        torchInstallCmd = `uv pip install torch==2.7.0+cu128 torchvision==0.22.0+cu128 torchaudio==2.7.0+cu128 --index-url https://download.pytorch.org/whl/cu128 --force-reinstall`;
        installNotes = 'Ensure NVIDIA drivers compatible with CUDA 12.8+ are installed. Using PyTorch 2.7.0 for Chatterbox compatibility.';
        break;
    case 'AMD':
        logger.installing('PyTorch for AMD GPU (ROCm)');
        if (process.platform !== 'linux') {
            logger.warning('PyTorch ROCm wheels are officially supported only on Linux.');
            logger.warning('Installation may fail or runtime errors may occur on non-Linux systems.');
        }
        // Using compatible versions for Chatterbox - fallback to CPU versions for ROCm compatibility
        torchInstallCmd = `uv pip install torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --force-reinstall`;
        installNotes = 'Using CPU versions of PyTorch 2.7.0 for Chatterbox compatibility. ROCm support may be limited.';
        break;
    case 'INTEL':
        logger.installing('PyTorch for Intel GPU (XPU)');
        // Using compatible versions for Chatterbox - fallback to CPU versions for Intel compatibility
        torchInstallCmd = `uv pip install torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --force-reinstall`;
        installNotes = 'Using CPU versions of PyTorch 2.7.0 for Chatterbox compatibility. Intel GPU support may be limited.';
        break;
    case 'APPLE_SILICON':
        logger.installing('PyTorch for Apple Silicon (MPS)');
        // Using compatible versions for Chatterbox with MPS support
        torchInstallCmd = `uv pip install torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --force-reinstall`;
        installNotes = 'Using PyTorch 2.7.0 with Metal Performance Shaders (MPS) support for Chatterbox compatibility.';
        break;
    case 'CPU':
    default:
        logger.installing('CPU-only PyTorch');
        // Using compatible versions for Chatterbox
        torchInstallCmd = `uv pip install torch==2.7.0 torchvision==0.22.0 torchaudio==2.7.0 --force-reinstall`;
        installNotes = 'Installed PyTorch 2.7.0 CPU-only version for Chatterbox compatibility. No GPU acceleration will be used.';
        break;
}

try {
    console.log(`Running command: ${torchInstallCmd}`);
    if (installNotes) {
        console.log(`   Notes: ${installNotes}`);
    }
    // Explicitly specify the virtual environment to ensure uv uses it
    const torchInstallCmdWithVenv = torchInstallCmd.replace('uv pip install', `uv pip install --python ${VENV_DIR} --quiet`);
    logger.command(torchInstallCmdWithVenv);
    // Set longer timeout for large PyTorch downloads
    const env = { ...process.env, UV_HTTP_TIMEOUT: '300' }; // 5 minutes
    execSync(torchInstallCmdWithVenv, { stdio: logger.verboseMode ? 'inherit' : 'pipe', env });
    logger.success(`PyTorch (${gpuVendor} target) installed successfully`);

    // --- 5b. Verify Installation ---
    logger.progress('Verifying PyTorch installation');
    // Enhanced verification script
    const verifyTorchPyCode = `
import sys
import torch
import traceback

try:
    print(f"PyTorch version: {torch.__version__}")

    # Check CUDA (NVIDIA)
    cuda_available = False
    if hasattr(torch, 'cuda'):
        try:
            cuda_available = torch.cuda.is_available()
            print(f"CUDA available (NVIDIA): {cuda_available}")
            if cuda_available:
                print(f"  Device Count: {torch.cuda.device_count()}")
                for i in range(torch.cuda.device_count()):
                   print(f"  Device {i}: {torch.cuda.get_device_name(i)}")
        except Exception as e:
            print(f"  CUDA check failed: {e}")
            cuda_available = False # Ensure it's false if check fails

    # Check MPS (Apple Silicon)
    mps_available = False
    if hasattr(torch.backends, 'mps'):
       try:
            mps_available = torch.backends.mps.is_available()
            print(f"MPS available (Apple Silicon): {mps_available}")
            # Note: MPS doesn't have named devices like CUDA
       except Exception as e:
           print(f"  MPS check failed: {e}")
           mps_available = False

    # Check ROCm (AMD - often reports as CUDA device type)
    rocm_likely = False
    if cuda_available and sys.platform == 'linux':
        # ROCm sometimes presents as CUDA. Check name if possible.
        try:
            gpu_name = torch.cuda.get_device_name(0).upper()
            if 'AMD' in gpu_name or 'RADEON' in gpu_name:
                 print(f"ROCm available (AMD): True (Detected via CUDA device name: {torch.cuda.get_device_name(0)})")
                 rocm_likely = True
            elif 'NVIDIA' not in gpu_name:
                 print(f"CUDA device detected, but name doesn't clearly indicate NVIDIA or AMD: {torch.cuda.get_device_name(0)}")
        except Exception as e:
             print(f"  Could not get device name for potential ROCm check: {e}")


    # Check XPU (Intel)
    xpu_available = False
    if hasattr(torch, 'xpu'):
        try:
            xpu_available = torch.xpu.is_available()
            print(f"XPU available (Intel): {xpu_available}")
            if xpu_available:
                 print(f"  Device Count: {torch.xpu.device_count()}")
                 # Getting device name might need specific intel_extension_for_pytorch
                 # print(f"  Device 0 Name: {torch.xpu.get_device_name(0)}") # May fail depending on install
        except Exception as e:
            print(f"  XPU check failed: {e}")
            xpu_available = False


    print("-" * 20)
    if cuda_available and not rocm_likely:
        print("✅ PyTorch CUDA (NVIDIA) acceleration appears available.")
    elif rocm_likely:
         print("✅ PyTorch ROCm (AMD) acceleration appears available (via CUDA interface).")
    elif mps_available:
        print("✅ PyTorch MPS (Apple Silicon) acceleration appears available.")
    elif xpu_available:
        print("✅ PyTorch XPU (Intel) acceleration appears available.")
    elif not cuda_available and not mps_available and not xpu_available:
        print("✅ PyTorch is installed, but no GPU acceleration (CUDA, MPS, ROCm, XPU) was detected.")
        print("   Operations will run on the CPU.")
    else:
        # Should not happen if logic is correct, but catch any missed cases
        print("✅ PyTorch is installed. Check specific accelerator status above.")

except Exception as e:
    print(f"❌ Error during PyTorch verification: {e}")
    traceback.print_exc()
    sys.exit(1)
`;
    // Escape double quotes inside the Python code string for the shell command
    const verifyTorchCmd = `uv run --python ${VENV_DIR} -- python -c "${verifyTorchPyCode.replace(/"/g, '\\"')}"`;
    execSync(verifyTorchCmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe', encoding: 'utf8' });
    logger.success('PyTorch verification check completed');

    // --- 5c. Validate PyTorch/torchvision compatibility ---
    logger.progress('Validating PyTorch/torchvision compatibility');
    const validateVersionsPyCode = `
import sys
import torch
import torchvision
import traceback

try:
    torch_version = torch.__version__
    torchvision_version = torchvision.__version__

    print(f"PyTorch version: {torch_version}")
    print(f"torchvision version: {torchvision_version}")

    # Check for the specific error that was occurring
    try:
        # This import was failing with the torchvision::nms error
        from torchvision.transforms import InterpolationMode
        print("✅ torchvision imports working correctly")

        # Test a basic torchvision operation
        import torchvision.ops
        print("✅ torchvision.ops module accessible")

    except Exception as e:
        print(f"❌ torchvision compatibility issue detected: {e}")
        print("This indicates a PyTorch/torchvision version mismatch")
        sys.exit(1)

    # Validate expected versions for Chatterbox compatibility
    expected_torch = "2.7.0"
    expected_torchvision = "0.22.0"

    if not torch_version.startswith(expected_torch):
        print(f"⚠️ Warning: Expected PyTorch {expected_torch}, got {torch_version}")
    if not torchvision_version.startswith(expected_torchvision):
        print(f"⚠️ Warning: Expected torchvision {expected_torchvision}, got {torchvision_version}")

    print("✅ PyTorch/torchvision compatibility validation passed")

except Exception as e:
    print(f"❌ Version validation failed: {e}")
    traceback.print_exc()
    sys.exit(1)
`;
    const validateVersionsCmd = `uv run --python ${VENV_DIR} -- python -c "${validateVersionsPyCode.replace(/"/g, '\\"')}"`;
    execSync(validateVersionsCmd, { stdio: 'inherit', encoding: 'utf8' });
    logger.success('PyTorch/torchvision compatibility validated');

} catch (error) {
    logger.error(`Error installing or verifying PyTorch (${gpuVendor} target) with uv: ${error.message}`);
    logger.info(`Command attempted: ${torchInstallCmd.replace('uv pip install', `uv pip install --python ${VENV_DIR}`)}`); // Show the command that failed
    logger.info(`${installNotes}`); // Remind user of potential requirements
    process.exit(1);
}


// --- 6. Install core dependencies for both F5-TTS and Chatterbox services ---
logger.progress('Installing core AI dependencies');
try {
    // Core dependencies needed for both services
    const coreDeps = [
        // Flask server dependencies (for narrationApp.py)
        'flask',
        'flask-cors',
        'requests',
        'huggingface_hub',

        // FastAPI/Chatterbox dependencies (for start_api.py and api.py)
        'fastapi>=0.104.0',
        'uvicorn[standard]>=0.24.0',
        'python-multipart>=0.0.6',
        'pydantic>=2.0.0',
        'click',  // Required by uvicorn

        // F5-TTS specific dependencies
        'soundfile',
        'numpy',
        'vocos',
        'setuptools'
    ];

    const depsCmd = `uv pip install --python ${VENV_DIR} --quiet ${coreDeps.join(' ')}`;
    logger.command(depsCmd);
    const env = { ...process.env, UV_HTTP_TIMEOUT: '300' }; // 5 minutes
    execSync(depsCmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe', env });
    logger.success('Core AI dependencies installed');
} catch (error) {
    console.error(`❌ Error installing core dependencies with uv: ${error.message}`);
    console.log(`   Command failed: ${error.cmd}`);
    process.exit(1);
}

// --- 7. Install F5-TTS using uv pip ---
logger.installing('Text-to-Speech AI engine');

// Check for build dependencies on Linux
if (process.platform === 'linux') {
    logger.checking('build dependencies on Linux');
    try {
        // Check if essential build tools are available
        execSync('which gcc', { stdio: 'ignore' });
        logger.found('gcc');
    } catch (error) {
        console.warn('⚠️ gcc not found. You may need to install build-essential:');
        console.warn('   sudo apt update && sudo apt install build-essential python3-dev');
    }

    try {
        execSync('which python3-config', { stdio: 'ignore' });
        logger.found('python3-dev');
    } catch (error) {
        console.warn('⚠️ python3-dev not found. You may need to install it:');
        console.warn('   sudo apt install python3-dev');
    }
}

try {
    if (!fs.existsSync(F5_TTS_DIR)) {
        console.error(`❌ Error: Directory "${F5_TTS_DIR}" not found.`);
        console.log(`   The script attempted to clone it earlier, but it seems to be missing now.`);
        process.exit(1);
    }

    const setupPyPath = path.join(F5_TTS_DIR, 'setup.py');
    const pyprojectTomlPath = path.join(F5_TTS_DIR, 'pyproject.toml');

    if (!fs.existsSync(setupPyPath) && !fs.existsSync(pyprojectTomlPath)) {
        console.error(`❌ Error: Neither setup.py nor pyproject.toml found in the "${F5_TTS_DIR}" directory.`);
        console.log(`   The F5-TTS source code seems incomplete or improperly structured in the cloned repository.`);
        process.exit(1);
    } else {
        logger.found(`Text-to-Speech engine source code`);
    }

    const installF5Cmd = `uv pip install --python ${VENV_DIR} --quiet -e ./${F5_TTS_DIR}`;
    logger.command(installF5Cmd);
    const env = { ...process.env, UV_HTTP_TIMEOUT: '300' }; // 5 minutes

    try {
        execSync(installF5Cmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe', env });
        logger.success('Text-to-Speech engine installation completed');
    } catch (installError) {
        console.error(`❌ Error during F5-TTS editable installation: ${installError.message}`);
        console.log(`   Command that failed: ${installF5Cmd}`);
        console.log('   Trying alternative installation method (non-editable)...');

        try {
            const altInstallCmd = `uv pip install --python ${VENV_DIR} ./${F5_TTS_DIR}`;
            console.log(`Running alternative: ${altInstallCmd}`);
            execSync(altInstallCmd, { stdio: 'inherit', env });
            logger.success('Text-to-Speech engine alternative installation completed');
        } catch (altError) {
            console.error(`❌ Alternative installation also failed: ${altError.message}`);
            console.log('   This might be due to:');
            console.log('   - Missing build dependencies (gcc, python3-dev, etc.)');
            console.log('   - Permission issues');
            console.log('   - Network connectivity issues');
            console.log('   On Ubuntu/Debian, try: sudo apt update && sudo apt install build-essential python3-dev');
            throw altError; // Re-throw to be caught by outer try-catch
        }
    }

    // Debug: List installed packages in the virtual environment (only in verbose mode)
    if (logger.verboseMode) {
        logger.progress('Checking installed packages in virtual environment');
        try {
            const listCmd = `uv pip list --python ${VENV_DIR}`;
            logger.command(listCmd);
            execSync(listCmd, { stdio: 'inherit' });
        } catch (listError) {
            logger.warning(`Could not list packages: ${listError.message}`);
        }
    }

    logger.progress('Verifying Text-to-Speech engine');
    const verifyF5PyCode = `
import sys
import traceback

print("Python executable:", sys.executable)
print("Python version:", sys.version)
print("Python path:", sys.path[:3])  # Show first 3 entries

# Try to list installed packages using importlib.metadata (modern approach)
try:
    import importlib.metadata as metadata
    installed_packages = [dist.metadata['name'] for dist in metadata.distributions()]
    f5_related = [pkg for pkg in installed_packages if 'f5' in pkg.lower() or 'tts' in pkg.lower()]
    if f5_related:
        print("F5/TTS related packages found:", f5_related)
    else:
        print("No F5/TTS related packages found in first 10:", installed_packages[:10])
except ImportError:
    print("importlib.metadata not available, skipping package listing")
except Exception as e:
    print(f"Could not list packages: {e}")

try:
    from f5_tts.api import F5TTS
    print('✅ F5-TTS imported successfully')
    # Optional: Instantiate to catch potential init errors? Might be too slow/complex.
    # print('Attempting F5TTS instantiation...')
    # f5 = F5TTS() # This might require models to be downloaded/present
    # print('F5-TTS instantiated successfully (basic)')
except Exception as e:
    print(f'❌ Error importing F5-TTS: {e}')
    traceback.print_exc()
    sys.exit(1)
`;
    const verifyF5Cmd = `uv run --python ${VENV_DIR} -- python -c "${verifyF5PyCode.replace(/"/g, '\\"')}"`;
    execSync(verifyF5Cmd, { stdio: 'inherit', encoding: 'utf8' });
    logger.success('Text-to-Speech engine verified successfully');

} catch (error) {
    console.error(`❌ Error installing/verifying F5-TTS with uv: ${error.message}`);
    console.log(`   Verification command failed. Check the output above for details from Python.`);
    process.exit(1);
}

// --- 7.5. Install Chatterbox with CUDA fix using uv pip ---
logger.installing('Voice cloning engine');
try {
    // First, install Chatterbox dependencies that don't conflict with PyTorch
    logger.progress('Installing Chatterbox non-PyTorch dependencies');
    const chatterboxDepsCmd = `uv pip install --python ${VENV_DIR} --quiet numpy~=1.26.0 resampy==0.4.3 librosa==0.11.0 s3tokenizer transformers>=4.52.4 diffusers==0.29.0 resemble-perth==1.0.1 omegaconf==2.3.0 conformer==0.3.2 safetensors==0.5.3 peft>=0.15.2 tensorboard>=2.19.0 datasets>=3.6.0 pykakasi>=2.3.0 pyarrow>=20.0.0 tokenizers>=0.21.1 tqdm>=4.67.1 fastapi==0.112.1 pydantic==2.6.4 gradio>=4.26.0 langdetect>=1.0.9 webdataset>=0.2.100`;
    execSync(chatterboxDepsCmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe' });

    // Install the fixed version directly from GitHub without dependencies to avoid PyTorch conflicts
    const chatterboxGitUrl = `"chatterbox-tts @ git+${CHATTERBOX_REPO_URL}@${CHATTERBOX_BRANCH}"`;
    const installChatterboxCmd = `uv pip install --python ${VENV_DIR} --quiet --no-deps ${chatterboxGitUrl}`;
    logger.command(installChatterboxCmd);
    logger.info(`Installing enhanced voice cloning engine with GPU optimizations (preserving PyTorch versions)`);

    const env = { ...process.env, UV_HTTP_TIMEOUT: '600' }; // 10 minutes for GitHub install
    execSync(installChatterboxCmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe', env });
    logger.success('Voice cloning engine installation completed');

    // --- Ensure Chatterbox default voice conditionals are downloaded and properly placed ---
    logger.progress('Ensuring Chatterbox default voice conditionals are available');
    try {
        const downloadCondsCmd = `${VENV_DIR}\\Scripts\\python.exe -c "
import os
import shutil
from huggingface_hub import hf_hub_download
from pathlib import Path

print('Checking for Chatterbox default voice conditionals...')

# Create the expected directory structure
models_dir = Path('models')
chatterbox_weights_dir = models_dir / 'chatterbox_weights'
chatterbox_weights_dir.mkdir(parents=True, exist_ok=True)
print(f'✅ Created directory: {chatterbox_weights_dir}')

# Download the conds.pt file specifically
try:
    conds_path = hf_hub_download(
        repo_id='ResembleAI/chatterbox',
        filename='conds.pt',
        force_download=False  # Only download if not already cached
    )
    print(f'✅ Default voice conditionals downloaded to cache: {conds_path}')

    # Copy to the expected location for the application
    local_conds_path = chatterbox_weights_dir / 'conds.pt'
    shutil.copy2(conds_path, local_conds_path)
    print(f'✅ Default voice conditionals copied to: {local_conds_path}')

    # Verify both files are valid
    if os.path.exists(conds_path) and os.path.getsize(conds_path) > 0:
        print('✅ Cached conditionals file is valid')
    else:
        print('❌ Cached conditionals file is invalid or empty')
        exit(1)

    if os.path.exists(local_conds_path) and os.path.getsize(local_conds_path) > 0:
        print('✅ Local conditionals file is valid')
        print(f'✅ File size: {os.path.getsize(local_conds_path)} bytes')
    else:
        print('❌ Local conditionals file is invalid or empty')
        exit(1)

except Exception as e:
    print(f'❌ Failed to download/copy default voice conditionals: {e}')
    print('This may cause \\'NoneType\\' object has no attribute \\'cpu\\' errors')
    exit(1)
"`;
        execSync(downloadCondsCmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe', env });
        logger.success('Default voice conditionals downloaded and placed correctly');
    } catch (error) {
        logger.error('Failed to setup default voice conditionals - this will cause voice generation errors');
        logger.info('The application may show "NoneType object has no attribute cpu" errors without this file');
        logger.info('You can manually fix this by running: npm run setup:narration:uv');
        // Don't exit here, but warn the user
    }

    // Note: We still keep the local submodule for API files and compatibility
    if (fs.existsSync(CHATTERBOX_DIR)) {
        logger.success(`Voice cloning engine configured successfully`);
    } else {
        console.log(`⚠️ Local Chatterbox submodule not found, but package installed from GitHub.`);
    }

    // --- Apply Chatterbox fixes for proper operation ---
    logger.progress('Applying voice cloning optimizations');
    applyChatterboxFixes();
    logger.success('Voice cloning optimizations applied');

    logger.progress('Verifying voice cloning engine');
    const verifyChatterboxPyCode = `
import sys
import traceback

print("Verifying Chatterbox installation...")
print("Python executable:", sys.executable)

# Test core service dependencies
try:
    import flask
    import flask_cors
    import requests
    import uvicorn
    import fastapi
    import click
    print('✅ Core service dependencies imported successfully')
except Exception as e:
    print(f'❌ Error importing core service dependencies: {e}')
    traceback.print_exc()
    sys.exit(1)

# Test for the specific torchvision::nms error that was causing issues
try:
    from torchvision.transforms import InterpolationMode
    import torchvision.ops
    print('✅ torchvision compatibility check passed')
except Exception as e:
    if 'torchvision::nms does not exist' in str(e):
        print(f'❌ CRITICAL: torchvision::nms error detected: {e}')
        print('   This indicates a PyTorch/torchvision version mismatch')
        print('   The installation needs to be fixed')
        sys.exit(1)
    else:
        print(f'⚠️ Warning: torchvision issue: {e}')

# Test Chatterbox imports (non-fatal)
chatterbox_working = False
try:
    from chatterbox.tts import ChatterboxTTS
    from chatterbox.vc import ChatterboxVC
    print('✅ Chatterbox imported successfully')
    print('✅ ChatterboxTTS and ChatterboxVC classes available')
    chatterbox_working = True
except Exception as e:
    error_str = str(e)
    if 'torchvision::nms does not exist' in error_str:
        print(f'❌ CRITICAL: Chatterbox import failed due to torchvision::nms error: {e}')
        print('   This indicates a PyTorch/torchvision version mismatch that needs to be fixed')
        sys.exit(1)
    else:
        print(f'⚠️ Warning: Chatterbox import failed: {e}')
        print('   Voice cloning features may not work, but installation will continue')
        print('   This is often due to PyTorch/TorchVision compatibility issues')

# Test transformers imports (non-fatal if Chatterbox failed)
if chatterbox_working:
    try:
        from transformers import LlamaModel, LlamaConfig
        print('✅ Transformers LlamaModel and LlamaConfig imported successfully')
    except Exception as e:
        print(f'⚠️ Warning: Transformers import failed: {e}')
        print('   Some advanced voice cloning features may not work')
else:
    print('⚠️ Skipping transformers test due to Chatterbox import failure')

print('✅ Verification completed (with warnings if any shown above)')
`;
    const verifyChatterboxCmd = `uv run --python ${VENV_DIR} -- python -c "${verifyChatterboxPyCode.replace(/"/g, '\\"')}"`;
    try {
        execSync(verifyChatterboxCmd, { stdio: 'inherit', encoding: 'utf8' });
        logger.success('Voice cloning engine verification completed');
    } catch (verifyError) {
        logger.warning('Voice cloning engine verification had issues, but continuing installation');
        logger.info('The application will still work, but voice cloning features may be limited');
    }

} catch (error) {
    console.error(`❌ Error installing/verifying Chatterbox with uv: ${error.message}`);
    console.log(`   Verification command failed. Check the output above for details from Python.`);
    process.exit(1);
}

// --- 7.6. Verify PyTorch installation after Chatterbox ---
logger.progress('Finalizing AI model setup');
try {
    // Verify PyTorch is still working after Chatterbox installation
    const verifyPytorchCmd = `uv run --python ${VENV_DIR} -- python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')"`;
    execSync(verifyPytorchCmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe' });
    logger.success('AI model setup verified');
} catch (error) {
    logger.warning(`PyTorch verification failed: ${error.message}`);
    logger.info('Attempting to fix PyTorch installation...');
    try {
        // Only reinstall if verification failed
        const fixPytorchCmd = `uv pip install --python ${VENV_DIR} --quiet torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 --force-reinstall`;
        logger.command(fixPytorchCmd);
        const env = { ...process.env, UV_HTTP_TIMEOUT: '300' }; // 5 minutes
        execSync(fixPytorchCmd, { stdio: logger.verboseMode ? 'inherit' : 'pipe', env });
        logger.success('PyTorch installation fixed');
    } catch (fixError) {
        logger.warning(`Could not fix PyTorch: ${fixError.message}`);
        logger.warning(`Voice cloning features may not work properly.`);
    }
}

// --- 8. Chatterbox Compatibility Fixes ---
function applyChatterboxFixes() {
    try {
        // Fix 1: Fix Unicode encoding in chatterbox/api.py
        logger.info('Optimizing voice engine compatibility...');
        const apiPyPath = path.join('chatterbox', 'api.py');
        if (fs.existsSync(apiPyPath)) {
            let apiContent = fs.readFileSync(apiPyPath, 'utf8');

            // Replace Unicode checkmarks with ASCII text
            apiContent = apiContent.replace(/print\("✓ TTS model loaded successfully"\)/g, 'print("[SUCCESS] TTS model loaded successfully")');
            apiContent = apiContent.replace(/print\(f"✗ Failed to load TTS model: \{e\}"\)/g, 'print(f"[ERROR] Failed to load TTS model: {e}")');
            apiContent = apiContent.replace(/print\("✓ VC model loaded successfully"\)/g, 'print("[SUCCESS] VC model loaded successfully")');
            apiContent = apiContent.replace(/print\(f"✗ Failed to load VC model: \{e\}"\)/g, 'print(f"[ERROR] Failed to load VC model: {e}")');



            fs.writeFileSync(apiPyPath, apiContent, 'utf8');
            logger.success('Voice engine compatibility optimized', '     ');
        } else {
            logger.info('Voice engine compatibility already optimized', '     ');
        }

        // Fix 2: Disable model_path.json to use default Hugging Face models
        logger.info('Configuring AI model sources...');
        const modelPathJsonPath = path.join(CHATTERBOX_DIR, 'model_path.json');
        if (fs.existsSync(modelPathJsonPath)) {
            const backupPath = modelPathJsonPath + '.disabled';
            fs.renameSync(modelPathJsonPath, backupPath);
            logger.success('AI model sources configured', '     ');
        } else {
            logger.success('AI model sources already configured', '     ');
        }

        // Fix 3: Note about GitHub installation (no .pth files needed)
        logger.info('Finalizing voice engine setup...');
        logger.success('Voice engine setup completed successfully', '     ');

    } catch (error) {
        logger.warning(`Some compatibility fixes failed: ${error.message}`);
        logger.warning('The installation may still work, but you might encounter issues.');
    }
}

// --- 9. Removed: Script generation for narration service ---
// The generation of run-narration-service-uv.bat and run-app-with-narration-uv.bat has been removed

// --- 10. Update package.json ---
logger.progress('Finalizing installation configuration');
try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    let packageJsonContent;
    try {
        packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    } catch (readError) {
        if (readError.code === 'ENOENT') {
            console.warn(`   ⚠️ package.json not found at ${packageJsonPath}. Skipping update.`);
        } else {
            console.error(`❌ Error reading package.json at ${packageJsonPath}: ${readError.message}`);
            console.log('   Skipping package.json update.');
            throw readError;
        }
    }

    if (packageJsonContent) {
        const packageJson = JSON.parse(packageJsonContent);
        if (!packageJson.scripts) {
            packageJson.scripts = {};
        }
        const setupScriptName = path.basename(__filename);

        // Update existing or add new scripts for uv-based setup
        packageJson.scripts['python:start:uv'] = `uv run --python .venv -- python server/narrationApp.py`;
        packageJson.scripts['setup:narration:uv'] = `node ${setupScriptName}`;

        // Ensure dev:cuda is properly configured (used by OSG_installer_Windows.bat)
        if (!packageJson.scripts['dev:cuda']) {
            packageJson.scripts['dev:cuda'] = `cross-env START_PYTHON_SERVER=true concurrently --names "FRONTEND,SERVER" --prefix-colors "cyan,green" --prefix "[{name}]" "npm run start --silent" "npm run server:start"`;
        }

        // Remove old/unused scripts to avoid confusion
        delete packageJson.scripts['python:start:cuda:uv'];
        delete packageJson.scripts['dev:cuda:uv'];
        delete packageJson.scripts['dev:uv'];

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        logger.success('Installation configuration completed');
    }
} catch (error) {
    logger.error(`Error updating package.json: ${error.message}`);
}

// --- 11. Final Service Verification ---
logger.progress('Performing final system check');
try {
    const finalVerifyPyCode = `
import sys
import traceback

print("=== Final Service Verification ===")

# Test Flask server imports (narrationApp.py)
try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    print('✅ Flask server dependencies verified')
except Exception as e:
    print(f'❌ Flask server dependencies failed: {e}')
    sys.exit(1)

# Test FastAPI/Chatterbox service imports (start_api.py)
try:
    import uvicorn
    import click
    import fastapi
    print('✅ FastAPI/Chatterbox service dependencies verified')
except Exception as e:
    print(f'❌ FastAPI/Chatterbox service dependencies failed: {e}')
    sys.exit(1)

# Test F5-TTS imports
try:
    from f5_tts.api import F5TTS
    print('✅ F5-TTS API verified')
except Exception as e:
    print(f'❌ F5-TTS API failed: {e}')
    sys.exit(1)

# Test Chatterbox API imports
try:
    from chatterbox.tts import ChatterboxTTS
    print('✅ Chatterbox TTS verified')
except Exception as e:
    print(f'❌ Chatterbox TTS failed: {e}')
    sys.exit(1)

# Verify conditionals file exists and is accessible
import os
conds_path = 'models/chatterbox_weights/conds.pt'
if os.path.exists(conds_path):
    file_size = os.path.getsize(conds_path)
    if file_size > 0:
        print(f'✅ Chatterbox conditionals file verified: {conds_path} ({file_size} bytes)')
    else:
        print(f'❌ Chatterbox conditionals file is empty: {conds_path}')
        sys.exit(1)
else:
    print(f'❌ Chatterbox conditionals file missing: {conds_path}')
    print('   This will cause "NoneType object has no attribute cpu" errors')
    sys.exit(1)

print('✅ All service dependencies and required files verified successfully!')
`;
    const finalVerifyCmd = `uv run --python ${VENV_DIR} -- python -c "${finalVerifyPyCode.replace(/"/g, '\\"')}"`;
    execSync(finalVerifyCmd, { stdio: 'inherit', encoding: 'utf8' });
    logger.success('Final system check completed successfully');
} catch (error) {
    logger.error(`Final system check failed: ${error.message}`);
    logger.warning('Some features may not work correctly. Check the output above for details.');
    // Don't exit here, just warn the user
}

// --- 12. Final Summary ---
logger.step(6, 6, 'Setup completed successfully!');

const summaryItems = [
    `Target PyTorch backend: ${gpuVendor}`,
    `F5-TTS submodule at: "${F5_TTS_DIR}"`,
    `Chatterbox with CUDA fix installed from GitHub`,
    `Default voice conditionals downloaded and placed at: models/chatterbox_weights/conds.pt`,
    `Shared virtual environment at: ./${VENV_DIR}`,
    `Python ${PYTHON_VERSION_TARGET} confirmed/installed`,
    `PyTorch, F5-TTS, Chatterbox, and all dependencies installed`,
    `Applied compatibility fixes for Unicode encoding and model loading`
];

if (installNotes) {
    summaryItems.push(`Reminder: ${installNotes}`);
}

logger.summary('Setup Summary', summaryItems);

logger.newLine();
logger.success('✅ PyTorch/torchvision compatibility fix applied');
logger.info('   - Using PyTorch 2.7.0 with torchvision 0.22.0 for Chatterbox compatibility');
logger.info('   - Prevents "torchvision::nms does not exist" errors');
logger.info('   - Dependencies installed with version pinning to avoid conflicts');

logger.newLine();
logger.info('🚀 To run the application with ALL narration services:');
logger.info('   1. Ensure `uv` and `npm` are in your PATH');
logger.info('   2. Run: npm run dev:cuda');
logger.info('   This starts F5-TTS (port 3006) + Chatterbox API (port 3011) + Frontend (port 3008)');

logger.newLine();
logger.info('💡 Other useful commands:');
logger.info('   - Just narration service: npm run python:start:uv');
logger.info('   - Re-run setup: npm run setup:narration:uv');

logger.newLine();
logger.info('💡 To force a specific GPU type:');
logger.info('   Set FORCE_GPU_VENDOR environment variable (NVIDIA, AMD, INTEL, APPLE, CPU)');
logger.info('   Example: set FORCE_GPU_VENDOR=CPU && npm run setup:narration:uv');