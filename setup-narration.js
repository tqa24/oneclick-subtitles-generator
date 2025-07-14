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

const VENV_DIR = '.venv'; // Define the virtual environment directory name
const PYTHON_VERSION_TARGET = "3.11"; // Target Python version
const F5_TTS_DIR = 'F5-TTS'; // Define the F5-TTS directory name
const F5_TTS_REPO_URL = 'https://github.com/SWivid/F5-TTS.git';

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
    console.log('\n🔍 Detecting GPU Vendor...');
    const platform = process.platform;
    const arch = process.arch;

    // --- 1. Check Environment Variable Override ---
    const forcedVendor = process.env.FORCE_GPU_VENDOR?.toUpperCase();
    if (forcedVendor && ['NVIDIA', 'AMD', 'INTEL', 'APPLE', 'CPU'].includes(forcedVendor)) {
        console.log(`   User override detected: FORCE_GPU_VENDOR=${forcedVendor}`);
        // Map APPLE to MPS for clarity internally if needed, but keep APPLE for user consistency
        return forcedVendor === 'APPLE' ? 'APPLE_SILICON' : forcedVendor;
    }

    // --- 2. Apple Silicon Check (macOS arm64) ---
    if (platform === 'darwin' && arch === 'arm64') {
        console.log('   Detected Apple Silicon (macOS arm64).');
        return 'APPLE_SILICON'; // MPS support
    }

    // --- 3. NVIDIA Check (nvidia-smi) ---
    // nvidia-smi is the most reliable indicator for NVIDIA.
    if (commandExists('nvidia-smi')) {
        try {
            execSync('nvidia-smi -L', { stdio: 'ignore' }); // Run a simple command to ensure it works
            console.log('   Detected NVIDIA GPU (via nvidia-smi).');
            return 'NVIDIA'; // CUDA support
        } catch (error) {
            console.log('   nvidia-smi found but execution failed, proceeding with other checks...');
        }
    }

    // --- 4. Platform-Specific Checks (Less reliable than nvidia-smi) ---
    try {
        if (platform === 'win32') {
            // Windows: Use WMIC
            const wmicOutput = execSync('wmic path win32_VideoController get name', { encoding: 'utf8' }).toUpperCase();
            if (wmicOutput.includes('NVIDIA')) {
                console.log('   Detected NVIDIA GPU (via WMIC).');
                return 'NVIDIA';
            }
            if (wmicOutput.includes('AMD') || wmicOutput.includes('RADEON')) {
                console.log('   Detected AMD GPU (via WMIC).');
                return 'AMD'; // ROCm (Linux mainly) or DirectML (Windows - requires different PyTorch build usually not covered by standard ROCm wheels)
            }
            if (wmicOutput.includes('INTEL')) {
                console.log('   Detected Intel GPU (via WMIC).');
                return 'INTEL'; // XPU support
            }
        } else if (platform === 'linux') {
            // Linux: Use lspci (requires pciutils)
            if (commandExists('lspci')) {
                 const lspciOutput = execSync("lspci | grep -i 'VGA\\|3D\\|2D'", { encoding: 'utf8' }).toUpperCase();
                 if (lspciOutput.includes('NVIDIA')) {
                    console.log('   Detected NVIDIA GPU (via lspci).');
                    return 'NVIDIA';
                }
                if (lspciOutput.includes('ADVANCED MICRO DEVICES') || lspciOutput.includes('AMD') || lspciOutput.includes('ATI') || lspciOutput.includes('RADEON')) {
                    console.log('   Detected AMD GPU (via lspci).');
                    return 'AMD'; // ROCm support (primarily on Linux)
                }
                if (lspciOutput.includes('INTEL')) {
                    console.log('   Detected Intel GPU (via lspci).');
                    return 'INTEL'; // XPU support
                }
            } else {
                console.log("   'lspci' command not found, cannot perform detailed PCI check on Linux.");
            }
        }
        // Add macOS non-ARM detection if necessary, though less common for accelerated PyTorch outside ARM/NVIDIA eGPUs
    } catch (error) {
        console.warn(`   Warning during GPU detection using system commands: ${error.message}`);
    }

    // --- 5. Fallback ---
    console.log('   Could not reliably detect a supported accelerated GPU vendor (NVIDIA, AMD, Intel, Apple Silicon).');
    console.log('   Will attempt to install the CPU-only version of PyTorch.');
    console.log('   For specific GPU support, set the FORCE_GPU_VENDOR environment variable (NVIDIA, AMD, INTEL, APPLE).');
    return 'CPU';
}


// --- 1. Check for uv ---
console.log('🔍 Checking for uv...');
if (!commandExists('uv')) {
    console.error('❌ uv is not installed or not found in PATH.');
    console.log('   Please install uv first. See: https://github.com/astral-sh/uv#installation');
    process.exit(1);
}
try {
    const uvVersion = execSync('uv --version', { encoding: 'utf8' }).trim();
    console.log(`✅ uv found: ${uvVersion}`);
} catch (error) {
    console.error('❌ Failed to execute uv. Make sure it is installed and in your PATH.');
    console.log('   See: https://github.com/astral-sh/uv#installation');
    process.exit(1);
}

// --- 2. Check for git, Remove Existing F5-TTS, and Clone Repository ---
console.log('\n🔍 Checking for git...');
if (!commandExists('git')) {
    console.error('❌ git is not installed or not found in PATH.');
    console.log('   Please install git first. See: https://git-scm.com/downloads');
    process.exit(1);
}
console.log('✅ git found.');

console.log(`\n🔍 Preparing target directory "${F5_TTS_DIR}"...`);
if (fs.existsSync(F5_TTS_DIR)) {
    console.log(`   Directory "${F5_TTS_DIR}" already exists. Removing it...`);
    try {
        fs.rmSync(F5_TTS_DIR, { recursive: true, force: true });
        console.log(`✅ Existing directory "${F5_TTS_DIR}" removed.`);
    } catch (error) {
        console.error(`❌ Error removing existing directory "${F5_TTS_DIR}": ${error.message}`);
        console.log('   Please check permissions or if files are in use.');
        console.log('   You may need to manually delete the directory.');
        process.exit(1);
    }
} else {
    console.log(`   Directory "${F5_TTS_DIR}" does not exist. Proceeding to clone.`);
}

console.log(`🔧 Cloning repository ${F5_TTS_REPO_URL} into "${F5_TTS_DIR}"...`);
try {
    execSync(`git clone ${F5_TTS_REPO_URL}`, { stdio: 'inherit' });
    console.log(`✅ Repository cloned successfully into "${F5_TTS_DIR}".`);
} catch (error) {
    console.error(`❌ Error cloning repository: ${error.message}`);
    console.log('   Please check your internet connection and git installation.');
    console.log(`   You may need to manually clone the repository: git clone ${F5_TTS_REPO_URL}`);
    process.exit(1);
}


// --- 3. Check for/Install Python 3.11 ---
console.log(`\n🔍 Checking for Python ${PYTHON_VERSION_TARGET}...`);
let pythonInterpreterIdentifier = null;
let triedUvInstall = false;

// (Python detection logic remains the same as before)
// First, try to find an existing Python 3.11 interpreter
try {
  if (process.platform === 'win32') {
    try {
      const pyVersionsOutput = execSync('py -0p', { encoding: 'utf8' }).trim();
      console.log('   Available Python interpreters (via py launcher):');
      console.log(pyVersionsOutput || '   (None found or py command failed)');
      const lines = pyVersionsOutput.split('\n');
      const python311Line = lines.find(line => line.match(new RegExp(`^-${PYTHON_VERSION_TARGET}`)));
      if (python311Line) {
         const match = python311Line.match(/\s*(.+)$/);
         if(match && match[1]) {
            pythonInterpreterIdentifier = match[1].trim();
            if (pythonInterpreterIdentifier.includes(' ')) {
                pythonInterpreterIdentifier = `"${pythonInterpreterIdentifier}"`;
            }
            console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} interpreter via py: ${pythonInterpreterIdentifier}`);
         }
      }
      if (!pythonInterpreterIdentifier && execSync('py -0', { encoding: 'utf8' }).includes(`-${PYTHON_VERSION_TARGET}`)) {
         pythonInterpreterIdentifier = `python${PYTHON_VERSION_TARGET}`;
         console.log(`✅ Found Python ${PYTHON_VERSION_TARGET} via py launcher (using alias "${pythonInterpreterIdentifier}" for uv).`);
      }
    } catch (error) {
      console.log(`   py launcher check failed or Python ${PYTHON_VERSION_TARGET} not listed.`);
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
                 console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} via command "${pythonCommand}" at: ${pythonInterpreterIdentifier}`);
            } else {
                 pythonInterpreterIdentifier = pythonCommand;
                 console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} via command "${pythonCommand}" (using alias for uv).`);
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
    console.log(`⚠️ Python ${PYTHON_VERSION_TARGET} not found in standard locations.`);
    console.log(`🔧 Attempting to install Python ${PYTHON_VERSION_TARGET} using "uv python install ${PYTHON_VERSION_TARGET}"...`);
    triedUvInstall = true;
    try {
        execSync(`uv python install ${PYTHON_VERSION_TARGET}`, { stdio: 'inherit' });
        console.log(`✅ Python ${PYTHON_VERSION_TARGET} installation via uv successful.`);
        pythonInterpreterIdentifier = PYTHON_VERSION_TARGET;
    } catch (installError) {
        console.error(`❌ Failed to install Python ${PYTHON_VERSION_TARGET} using uv: ${installError.message}`);
        console.log(`   Please try installing Python ${PYTHON_VERSION_TARGET} manually (https://www.python.org/downloads/)`);
        console.log(`   or ensure uv has the necessary permissions and network access.`);
        process.exit(1);
    }
} else {
     console.log(`✅ Using Python ${PYTHON_VERSION_TARGET} interpreter identifier for uv: ${pythonInterpreterIdentifier}`);
}

if (!pythonInterpreterIdentifier) {
    console.error(`❌ Could not find or install Python ${PYTHON_VERSION_TARGET}. Cannot proceed.`);
    process.exit(1);
}


// --- 4. Create a virtual environment with uv using the determined Python ---
console.log(`\n🔧 Creating virtual environment with uv at ./${VENV_DIR} using Python "${pythonInterpreterIdentifier}"...`);
try {
  execSync(`uv venv -p ${pythonInterpreterIdentifier} ${VENV_DIR}`, { stdio: 'inherit' });
  console.log(`✅ Virtual environment created at ${VENV_DIR}`);
} catch (error) {
  console.error(`❌ Error creating virtual environment with uv: ${error.message}`);
   if (triedUvInstall) {
      console.log(`   Even after attempting 'uv python install', creating the venv with '${pythonInterpreterIdentifier}' failed.`);
      console.log(`   This might indicate an issue with the uv installation or environment.`);
      console.log(`   Try running 'uv venv -p ${PYTHON_VERSION_TARGET} ${VENV_DIR}' manually to diagnose.`);
   } else {
      console.log(`   Failed to create venv with existing interpreter "${pythonInterpreterIdentifier}". Is it a valid Python executable or alias known to uv?`);
      console.log(`   Try running 'uv venv -p ${pythonInterpreterIdentifier} ${VENV_DIR}' manually.`);
   }
  process.exit(1);
}

// --- 5. Detect GPU and Install Appropriate PyTorch Build ---
const gpuVendor = detectGpuVendor(); // Call the detection function
let torchInstallCmd = '';
let installNotes = '';

switch (gpuVendor) {
    case 'NVIDIA':
        console.log('\n🔧 Installing PyTorch for NVIDIA GPU (CUDA)...');
        // Using CUDA 12.4 as requested
        torchInstallCmd = `uv pip install torch==2.4.0+cu124 torchvision==0.19.0+cu124 torchaudio==2.4.0+cu124 --extra-index-url https://download.pytorch.org/whl/cu124`;
        installNotes = 'Ensure NVIDIA drivers compatible with CUDA 12.4 are installed.';
        break;
    case 'AMD':
        console.log('\n🔧 Installing PyTorch for AMD GPU (ROCm)...');
        if (process.platform !== 'linux') {
            console.warn('⚠️ WARNING: PyTorch ROCm wheels are officially supported only on Linux.');
            console.warn('   Installation may fail or runtime errors may occur on non-Linux systems.');
            // Fallback to CPU? Or let the user try anyway? Let's try anyway but warn.
        }
        // Using ROCm 6.2 as requested
        torchInstallCmd = `uv pip install torch==2.5.1+rocm6.2 torchvision==0.20.1+rocm6.2 torchaudio==2.5.1+rocm6.2 --extra-index-url https://download.pytorch.org/whl/rocm6.2`;
        installNotes = 'Ensure AMD ROCm drivers (v6.2 or compatible) are installed (Linux Recommended).';
        break;
    case 'INTEL':
        console.log('\n🔧 Installing PyTorch for Intel GPU (XPU)...');
        // Using XPU test channel as requested
        torchInstallCmd = `uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/test/xpu`;
        installNotes = 'Ensure Intel GPU drivers and potentially Intel oneAPI Base Toolkit are installed.\n   Alternatively, investigate Intel Extension for PyTorch (IPEX): https://pytorch-extension.intel.com/';
        break;
    case 'APPLE_SILICON':
        console.log('\n🔧 Installing PyTorch for Apple Silicon (MPS)...');
        // Standard stable PyTorch wheels include MPS support
        torchInstallCmd = `uv pip install torch torchvision torchaudio`;
        installNotes = 'Using standard PyTorch build with Metal Performance Shaders (MPS) support.';
        break;
    case 'CPU':
    default:
        console.log('\n🔧 Installing CPU-only PyTorch...');
        // Standard stable PyTorch wheels work for CPU
        torchInstallCmd = `uv pip install torch torchvision torchaudio`;
        installNotes = 'Installed CPU-only version. No GPU acceleration will be used by PyTorch.';
        break;
}

try {
    console.log(`Running command: ${torchInstallCmd}`);
    if (installNotes) {
        console.log(`   Notes: ${installNotes}`);
    }
    // Explicitly specify the virtual environment to ensure uv uses it
    const torchInstallCmdWithVenv = torchInstallCmd.replace('uv pip install', `uv pip install --python ${VENV_DIR}`);
    console.log(`Using explicit venv: ${torchInstallCmdWithVenv}`);
    // Set longer timeout for large PyTorch downloads
    const env = { ...process.env, UV_HTTP_TIMEOUT: '300' }; // 5 minutes
    execSync(torchInstallCmdWithVenv, { stdio: 'inherit', env });
    console.log(`✅ PyTorch (${gpuVendor} target) installed successfully.`);

    // --- 5b. Verify Installation ---
    console.log('\n🔍 Verifying PyTorch installation using uv run...');
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
    const verifyTorchCmd = `uv run -- python -c "${verifyTorchPyCode.replace(/"/g, '\\"')}"`;
    execSync(verifyTorchCmd, { stdio: 'inherit', encoding: 'utf8' });
    console.log('✅ PyTorch verification check completed.');

} catch (error) {
    console.error(`❌ Error installing or verifying PyTorch (${gpuVendor} target) with uv: ${error.message}`);
    console.log(`   Command attempted: ${torchInstallCmd.replace('uv pip install', `uv pip install --python ${VENV_DIR}`)}`); // Show the command that failed
    console.log(`   ${installNotes}`); // Remind user of potential requirements
    process.exit(1);
}


// --- 6. Install F5-TTS dependencies using uv pip ---
console.log('\n🔧 Installing F5-TTS dependencies using uv...');
try {
    // Added torchvision here as it's commonly needed and installed with torch now
    const depsCmd = `uv pip install --python ${VENV_DIR} flask flask-cors soundfile numpy vocos`;
    console.log(`Running: ${depsCmd}`);
    const env = { ...process.env, UV_HTTP_TIMEOUT: '300' }; // 5 minutes
    execSync(depsCmd, { stdio: 'inherit', env });
    console.log('✅ F5-TTS dependencies installed.');
} catch (error) {
    console.error(`❌ Error installing F5-TTS dependencies with uv: ${error.message}`);
    console.log(`   Command failed: ${error.cmd}`);
    process.exit(1);
}

// --- 7. Install F5-TTS using uv pip ---
console.log('\n🔧 Installing F5-TTS using uv...');

// Check for build dependencies on Linux
if (process.platform === 'linux') {
    console.log('🔍 Checking for build dependencies on Linux...');
    try {
        // Check if essential build tools are available
        execSync('which gcc', { stdio: 'ignore' });
        console.log('✅ gcc found');
    } catch (error) {
        console.warn('⚠️ gcc not found. You may need to install build-essential:');
        console.warn('   sudo apt update && sudo apt install build-essential python3-dev');
    }

    try {
        execSync('which python3-config', { stdio: 'ignore' });
        console.log('✅ python3-dev found');
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
        console.log(`✅ Found F5-TTS directory and a setup file (${fs.existsSync(pyprojectTomlPath) ? 'pyproject.toml' : 'setup.py'}).`);
    }

    const installF5Cmd = `uv pip install --python ${VENV_DIR} -e ./${F5_TTS_DIR}`;
    console.log(`Running: ${installF5Cmd}`);
    const env = { ...process.env, UV_HTTP_TIMEOUT: '300' }; // 5 minutes

    try {
        execSync(installF5Cmd, { stdio: 'inherit', env });
        console.log('✅ F5-TTS installation command completed.');
    } catch (installError) {
        console.error(`❌ Error during F5-TTS editable installation: ${installError.message}`);
        console.log(`   Command that failed: ${installF5Cmd}`);
        console.log('   Trying alternative installation method (non-editable)...');

        try {
            const altInstallCmd = `uv pip install --python ${VENV_DIR} ./${F5_TTS_DIR}`;
            console.log(`Running alternative: ${altInstallCmd}`);
            execSync(altInstallCmd, { stdio: 'inherit', env });
            console.log('✅ F5-TTS alternative installation completed.');
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

    // Debug: List installed packages in the virtual environment
    console.log('\n🔍 Checking installed packages in virtual environment...');
    try {
        const listCmd = `uv pip list --python ${VENV_DIR}`;
        console.log(`Running: ${listCmd}`);
        execSync(listCmd, { stdio: 'inherit' });
    } catch (listError) {
        console.warn(`⚠️ Could not list packages: ${listError.message}`);
    }

    console.log('\n🔍 Verifying F5-TTS installation using uv run...');
    const verifyF5PyCode = `
import sys
import traceback
import pkg_resources

print("Python executable:", sys.executable)
print("Python version:", sys.version)
print("Python path:", sys.path[:3])  # Show first 3 entries

# List installed packages that might be related
try:
    installed_packages = [d.project_name for d in pkg_resources.working_set]
    f5_related = [pkg for pkg in installed_packages if 'f5' in pkg.lower() or 'tts' in pkg.lower()]
    if f5_related:
        print("F5/TTS related packages found:", f5_related)
    else:
        print("No F5/TTS related packages found in:", installed_packages[:10])  # Show first 10
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
    const verifyF5Cmd = `uv run -- python -c "${verifyF5PyCode.replace(/"/g, '\\"')}"`;
    execSync(verifyF5Cmd, { stdio: 'inherit', encoding: 'utf8' });
    console.log('✅ F5-TTS installation verified (import successful).');

} catch (error) {
    console.error(`❌ Error installing/verifying F5-TTS with uv: ${error.message}`);
    console.log(`   Verification command failed. Check the output above for details from Python.`);
    process.exit(1);
}

// --- 8. Removed: Script generation for narration service ---
// The generation of run-narration-service-uv.bat and run-app-with-narration-uv.bat has been removed

// --- 9. Update package.json ---
console.log('\n🔧 Updating package.json with uv commands...');
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

        // Update existing or add new scripts
        packageJson.scripts['python:start:uv'] = `uv run -- python server/narrationApp.py`; // Generic name
        packageJson.scripts['dev:uv'] = `concurrently "npm run start" "npm run server:start" "npm run python:start:uv"`; // Generic name
        packageJson.scripts['setup:narration:uv'] = `node ${setupScriptName}`;

        // Remove old CUDA specific ones if they exist to avoid confusion
        delete packageJson.scripts['python:start:cuda:uv'];
        delete packageJson.scripts['dev:cuda:uv'];

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`✅ Updated package.json with setup command "setup:narration:uv" and generic run commands ("dev:uv", "python:start:uv").`);
    }
} catch (error) {
    console.error(`❌ Error updating package.json: ${error.message}`);
}

// --- Final Summary ---
console.log('\n✅ Setup using uv completed successfully!');
console.log(`   - Target PyTorch backend: ${gpuVendor}`);
console.log(`   - Removed any existing "${F5_TTS_DIR}" directory.`);
console.log(`   - Cloned fresh F5-TTS repository into "${F5_TTS_DIR}".`);
console.log(`   - Virtual environment created at: ./${VENV_DIR}`);
console.log(`   - Python ${PYTHON_VERSION_TARGET} confirmed/installed within the venv.`);
console.log(`   - PyTorch (${gpuVendor} target), F5-TTS, and dependencies installed in the venv.`);
if (installNotes) {
    console.log(`   - Reminder: ${installNotes}`);
}
console.log('\n🚀 To run the application with narration service:');
console.log('   1. Ensure `uv` and `npm` are in your PATH.');
console.log('   2. Run the npm script: npm run dev:uv');
console.log('\n💡 To just run the narration service:');
console.log('   - npm run python:start:uv');
console.log('\n🔧 To re-run this setup (will delete F5-TTS and reinstall venv packages):');
console.log(`   - node ${path.basename(__filename)}`);
console.log(`   - OR npm run setup:narration:uv (if package.json was updated)`);
console.log('\n💡 To force a specific PyTorch build (e.g., for CPU or if detection fails):');
console.log('   Set the FORCE_GPU_VENDOR environment variable before running the setup script:');
console.log('   Example (Powershell): $env:FORCE_GPU_VENDOR="CPU"; node setup-narration-uv.js');
console.log('   Example (Bash/Zsh):  FORCE_GPU_VENDOR=CPU node setup-narration-uv.js');
console.log('   Valid values: NVIDIA, AMD, INTEL, APPLE, CPU');