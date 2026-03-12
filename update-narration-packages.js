/**
 * Lightweight narration maintenance script for the shared virtual environment.
 * It repairs compatibility drift and verifies installed runtimes without pulling
 * unpinned upstream package updates into a repo-managed setup.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Import our logging utility
const { Logger } = require('./utils/logger');
const logger = new Logger({
    verbose: process.env.VERBOSE === 'true',
    quiet: process.env.QUIET === 'true'
});

// Define the virtual environment directory
const VENV_DIR = '.venv';
const isWindows = os.platform() === 'win32';
const venvBinDir = isWindows ? 'Scripts' : 'bin';
const NARRATION_CONSTRAINTS_FILE = path.join(__dirname, 'narration-constraints.txt');
const NARRATION_COMPAT_PACKAGE_SPECS = ['protobuf>=4.25.8,<7'];
const BLACKWELL_GPU_REGEX = /\b(BLACKWELL|RTX 5090|RTX 5080|RTX 5070|RTX 5060|RTX 5050)\b/i;
const TORCH_PROFILES = {
  NVIDIA_CU121: {
    id: 'nvidia-cu121',
    torch: '2.5.1+cu121',
    torchvision: '0.20.1+cu121',
    torchaudio: '2.5.1+cu121',
    expectedTorch: '2.5.1',
    indexUrl: 'https://download.pytorch.org/whl/cu121',
    description: 'PyTorch 2.5.1 with CUDA 12.1',
    compatibilityPackages: [],
  },
  NVIDIA_BLACKWELL_CU128: {
    id: 'nvidia-blackwell-cu128',
    torch: '2.7.1+cu128',
    torchvision: '0.22.1+cu128',
    torchaudio: '2.7.1+cu128',
    expectedTorch: '2.7.1',
    indexUrl: 'https://download.pytorch.org/whl/cu128',
    description: 'PyTorch 2.7.1 with CUDA 12.8 for NVIDIA Blackwell GPUs',
    compatibilityPackages: ['numpy==1.25.2', 'pillow==11.3.0'],
  },
  CPU_GENERIC: {
    id: 'cpu-generic',
    torch: '2.5.1',
    torchvision: '0.20.1',
    torchaudio: '2.5.1',
    expectedTorch: '2.5.1',
    indexUrl: null,
    description: 'PyTorch 2.5.1 CPU/MPS/XPU-compatible build',
    compatibilityPackages: [],
  },
};

function getNarrationConstraintsArg() {
  return fs.existsSync(NARRATION_CONSTRAINTS_FILE)
    ? `-c "${NARRATION_CONSTRAINTS_FILE}"`
    : '';
}

function quotePackageSpecs(specs) {
  return specs.map(spec => `"${spec}"`).join(' ');
}

function commandExists(command) {
  try {
    const baseCommand = command.split(' ')[0];
    const checkCmd = isWindows ? `where ${baseCommand}` : `command -v ${baseCommand}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function buildTorchInstallCommand(profile) {
  const indexArg = profile.indexUrl ? ` --index-url ${profile.indexUrl}` : '';
  return `uv pip install --python .venv torch==${profile.torch} torchvision==${profile.torchvision} torchaudio==${profile.torchaudio}${indexArg} --force-reinstall`;
}

function installTorchCompatibilityPackages(profile) {
  if (!profile.compatibilityPackages || profile.compatibilityPackages.length === 0) {
    return;
  }

  const command = `uv pip install --python .venv ${profile.compatibilityPackages.map(pkg => `"${pkg}"`).join(' ')}`;
  logger.command(command);
  execSync(command, { stdio: 'inherit', env: { ...process.env, UV_HTTP_TIMEOUT: '300' } });
}

function checkPackageInstalled(packageName) {
  const checkCommand = `uv pip list --python .venv | findstr /C:"${packageName}"`;
  execSync(checkCommand, { stdio: 'ignore' });
}

function getPackageVersion(packageName) {
  const versionCommand = `uv pip show --python .venv ${packageName} | findstr /C:"Version:"`;
  const versionOutput = execSync(versionCommand, { encoding: 'utf8' }).trim();
  return versionOutput.split(':')[1].trim();
}

function repairNarrationCompatibility(reason) {
  const constraintsArg = getNarrationConstraintsArg();
  if (!constraintsArg) {
    logger.warning('Narration constraints file not found. Compatibility repair skipped.');
    return;
  }

  logger.progress(reason);
  executeWithRetry(
    `uv pip install --python .venv ${constraintsArg} ${quotePackageSpecs(NARRATION_COMPAT_PACKAGE_SPECS)}`
  );
}

function verifyPythonRuntime(label, pyCode) {
  const command = `uv run --python .venv -- python -c "${pyCode.replace(/"/g, '\\"')}"`;
  logger.command(command);
  execSync(command, { stdio: 'inherit', encoding: 'utf8' });
  logger.success(`${label} verified`);
}

function getTorchRuntimeInfo() {
  const tempFile = path.join(os.tmpdir(), `osg_torch_info_${process.pid}.py`);
  const pythonCode = `
import json
import torch

info = {
    "torch_version": torch.__version__,
    "cuda_available": False,
    "device_name": None,
    "device_arch": None,
    "supported_arches": [],
    "arch_compatible": True,
}

if hasattr(torch, "cuda") and torch.cuda.is_available():
    info["cuda_available"] = True
    info["device_name"] = torch.cuda.get_device_name(0)
    capability = torch.cuda.get_device_capability(0)
    info["device_arch"] = f"sm_{capability[0]}{capability[1]}"
    info["supported_arches"] = list(getattr(torch.cuda, "get_arch_list", lambda: [])())
    if info["supported_arches"]:
        info["arch_compatible"] = any(
            arch == info["device_arch"] or arch.startswith(info["device_arch"])
            for arch in info["supported_arches"]
        )

print(json.dumps(info))
`;

  fs.writeFileSync(tempFile, pythonCode, 'utf8');
  try {
    const command = `uv run --python .venv -- python "${tempFile}"`;
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
    const jsonLine = output.split(/\r?\n/).filter(Boolean).slice(-1)[0];
    return JSON.parse(jsonLine);
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch (error) {
      if (logger.verboseMode) {
        logger.warning(`Could not remove temporary torch info file: ${error.message}`);
      }
    }
  }
}

function chooseTorchProfile(torchInfo) {
  const forcedTorchProfile = process.env.FORCE_TORCH_PROFILE?.toUpperCase();
  if (forcedTorchProfile === 'BLACKWELL') {
    return TORCH_PROFILES.NVIDIA_BLACKWELL_CU128;
  }
  if (forcedTorchProfile === 'DEFAULT') {
    return TORCH_PROFILES.NVIDIA_CU121;
  }

  if (commandExists('nvidia-smi')) {
    try {
      const gpuNames = execSync('nvidia-smi --query-gpu=name --format=csv,noheader', { encoding: 'utf8' })
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(Boolean);
      if (gpuNames.some(name => BLACKWELL_GPU_REGEX.test(name))) {
        return TORCH_PROFILES.NVIDIA_BLACKWELL_CU128;
      }
      if (gpuNames.length > 0) {
        return TORCH_PROFILES.NVIDIA_CU121;
      }
    } catch (error) {
      if (logger.verboseMode) {
        logger.warning(`Could not inspect NVIDIA GPU model for Torch profile selection: ${error.message}`);
      }
    }
  }

  if (torchInfo.cuda_available) {
    if (
      (torchInfo.device_name && BLACKWELL_GPU_REGEX.test(torchInfo.device_name)) ||
      torchInfo.device_arch === 'sm_120'
    ) {
      return TORCH_PROFILES.NVIDIA_BLACKWELL_CU128;
    }
    return TORCH_PROFILES.NVIDIA_CU121;
  }

  return TORCH_PROFILES.CPU_GENERIC;
}

// Helper function to execute commands with retries
function executeWithRetry(command, options = {}, maxRetries = 3) {
  let retries = 0;
  let lastError = null;

  while (retries < maxRetries) {
    try {
      logger.command(command);
      const env = { ...process.env, UV_HTTP_TIMEOUT: '300', ...options.env }; // 5 minutes timeout
      execSync(command, { stdio: logger.verboseMode ? 'inherit' : 'ignore', env, ...options });
      return true; // Success
    } catch (error) {
      lastError = error;
      retries++;
      if (logger.verboseMode) {
        logger.warning(`Attempt ${retries}/${maxRetries} failed: ${error.message}`);
      }

      if (retries < maxRetries) {
        const waitTime = retries * 2000; // Exponential backoff: 2s, 4s, 6s...
        logger.progress(`Waiting ${waitTime/1000} seconds before retrying...`);
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

// Check if virtual environment exists
logger.checking('virtual environment');
if (!fs.existsSync(VENV_DIR)) {
  logger.warning('Virtual environment not found. Narration packages update skipped.');
  logger.info('Run setup-narration.js first to set up the environment.');
  process.exit(0);
}

// Repair and verify F5-TTS if installed
logger.checking('F5-TTS package');
try {
  checkPackageInstalled('f5-tts');
  const currentVersion = getPackageVersion('f5-tts');
  logger.found(`F5-TTS is installed (${currentVersion})`);

  repairNarrationCompatibility('Repairing shared narration dependency constraints');
  verifyPythonRuntime(
    'F5-TTS runtime',
    `
import importlib.metadata as md
import wandb
from f5_tts.api import F5TTS
print("protobuf:", md.version("protobuf"))
print("wandb:", md.version("wandb"))
print("f5-tts:", md.version("f5-tts"))
`
  );
} catch (error) {
  if (error.message.includes('Access is denied') || error.message.includes('os error 5')) {
    logger.warning('F5-TTS verification skipped because packages appear to be in use');
    logger.info('Restart the application and rerun the maintenance step to verify imports');
  } else {
    logger.warning(`F5-TTS maintenance failed: ${error.message}`);
    logger.info('Run node setup-narration.js to reinstall the repo-pinned narration stack if this persists.');
  }
}

// Verify Chatterbox if installed
logger.checking('Chatterbox package');
try {
  checkPackageInstalled('chatterbox-tts');
  const currentVersion = getPackageVersion('chatterbox-tts');
  logger.found(`Chatterbox is installed (${currentVersion})`);
  verifyPythonRuntime(
    'Chatterbox runtime',
    `
from chatterbox.tts import ChatterboxTTS
print("chatterbox import ok")
`
  );
} catch (error) {
  if (error.message.includes('Access is denied') || error.message.includes('os error 5')) {
    logger.warning('Chatterbox verification skipped because packages appear to be in use');
    logger.info('Restart the application and rerun the maintenance step to verify imports');
  } else {
    logger.warning(`Chatterbox maintenance failed: ${error.message}`);
  }
}

logger.newLine();
logger.success('Narration packages maintenance completed!');
logger.info('F5-TTS and Chatterbox runtimes were checked without pulling unpinned upstream upgrades.');
logger.info('If packages were in use, restart the application to apply any pending repairs.');
logger.info('If you need to install them initially, run: npm run setup:narration:uv');

// Safeguard: Ensure PyTorch versions remain compatible
logger.checking('PyTorch version compatibility');
let selectedTorchProfile = TORCH_PROFILES.CPU_GENERIC;
let torchProfileRepaired = false;
try {
  const torchInfo = getTorchRuntimeInfo();
  selectedTorchProfile = chooseTorchProfile(torchInfo);

  const versionCompatible = torchInfo.torch_version.startsWith(selectedTorchProfile.expectedTorch);
  const archCompatible = !torchInfo.cuda_available || torchInfo.arch_compatible;

  if (versionCompatible && archCompatible) {
    logger.success(`PyTorch is compatible (${torchInfo.torch_version})`);
  } else if (!archCompatible) {
    throw new Error(
      `Installed PyTorch (${torchInfo.torch_version}) does not support GPU ${torchInfo.device_name} (${torchInfo.device_arch}); supported arches: ${torchInfo.supported_arches.join(', ')}`
    );
  } else {
    throw new Error(`PyTorch version ${torchInfo.torch_version} is not compatible with ${selectedTorchProfile.description}`);
  }
} catch (error) {
  logger.warning('PyTorch version compatibility check failed');
  logger.info(`Reinstalling compatible PyTorch profile (${selectedTorchProfile.description})...`);
  try {
    executeWithRetry(buildTorchInstallCommand(selectedTorchProfile));
    installTorchCompatibilityPackages(selectedTorchProfile);
    logger.success('PyTorch versions restored to compatible versions');
    torchProfileRepaired = true;
  } catch (fixError) {
    logger.warning(`Could not restore PyTorch versions: ${fixError.message}`);
  }
}

if (torchProfileRepaired) {
  repairNarrationCompatibility('Reapplying narration dependency constraints after PyTorch repair');
  verifyPythonRuntime(
    'F5-TTS runtime',
    `
import importlib.metadata as md
import wandb
from f5_tts.api import F5TTS
print("protobuf:", md.version("protobuf"))
print("wandb:", md.version("wandb"))
print("f5-tts:", md.version("f5-tts"))
`
  );
  verifyPythonRuntime(
    'Chatterbox runtime',
    `
from chatterbox.tts import ChatterboxTTS
print("chatterbox import ok")
`
  );
}
