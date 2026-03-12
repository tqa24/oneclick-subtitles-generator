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

function getNarrationConstraintsArg() {
  return fs.existsSync(NARRATION_CONSTRAINTS_FILE)
    ? `-c "${NARRATION_CONSTRAINTS_FILE}"`
    : '';
}

function quotePackageSpecs(specs) {
  return specs.map(spec => `"${spec}"`).join(' ');
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
try {
  // Check PyTorch version without assert to avoid shell escaping issues
  const torchCheckCmd = 'uv run --python .venv -- python -c "import torch; print(torch.__version__)"';
  const versionOutput = execSync(torchCheckCmd, { encoding: 'utf8', stdio: 'pipe' }).trim();

  if (versionOutput.startsWith('2.5.1')) {
    logger.success('PyTorch version is compatible');
  } else {
    throw new Error(`PyTorch version ${versionOutput} is not compatible`);
  }
} catch (error) {
  logger.warning('PyTorch version compatibility check failed');
  logger.info('Reinstalling compatible PyTorch versions...');
  try {
    executeWithRetry('uv pip install --python .venv torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --force-reinstall');
    logger.success('PyTorch versions restored to compatible versions');
  } catch (fixError) {
    logger.warning(`Could not restore PyTorch versions: ${fixError.message}`);
  }
}
