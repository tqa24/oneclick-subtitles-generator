/**
 * Per-engine installer: Chatterbox (voice cloning).
 *
 * Faithful extraction of the Chatterbox install block from setup-narration.js (section 6), but
 * targeting this engine's OWN venv (.venvs/chatterbox) instead of the legacy shared .venv. Every
 * pin/ref/constraint/flag is preserved verbatim — only the venv path is swapped.
 *
 *   - clone resemble-ai/chatterbox at the pinned multilingual 0.1.7 commit;
 *   - rewrite its pyproject.toml for torch-profile / dependency compatibility;
 *   - install torch for the detected GPU profile, then chatterbox from the local modified dir.
 */

const fs = require('fs');
const path = require('path');

const { getEngineVenvTarget, projectRoot } = require('../venvPaths');
const { executeWithRetry, shallowCloneAtRef, runCommand } = require('./execHelpers');
const { installServiceDeps } = require('./serviceDeps');
const torch = require('../torchProfile');

const ID = 'chatterbox';

// Pins preserved verbatim from setup-narration.js — do not bump without testing the engine.
const CHATTERBOX_DIR = path.join(projectRoot, 'chatterbox-temp'); // Temporary dir for installation
const CHATTERBOX_REPO_URL = 'https://github.com/resemble-ai/chatterbox.git';
const CHATTERBOX_REF = process.env.CHATTERBOX_REF || '65b18437192794391a0308a8f705b1e33e633948'; // Pinned multilingual 0.1.7 commit; override explicitly if needed

const NARRATION_CONSTRAINTS_FILE = path.join(projectRoot, 'narration-constraints.txt');

function getNarrationConstraintArgs() {
  return fs.existsSync(NARRATION_CONSTRAINTS_FILE) ? ['-c', NARRATION_CONSTRAINTS_FILE] : [];
}

function buildTorchIndexArgList(profile) {
  return profile.indexUrl ? ['--index-url', profile.indexUrl, '--extra-index-url', 'https://pypi.org/simple'] : [];
}

async function install({ onLog = () => {} } = {}) {
  const log = (m) => onLog(String(m));
  const logger = {
    info: log, warning: log, progress: log, command: log, success: log,
    found: log, installing: log, subsection: log, step: () => {}, error: log,
  };

  const venv = getEngineVenvTarget(ID);

  // 1) Create the per-engine venv.
  logger.subsection('Creating Chatterbox virtual environment');
  await runCommand('uv', ['venv', venv, '-p', 'python3.11'], { label: 'Chatterbox venv create', logger });

  // 2) Install torch for the detected GPU profile into this venv.
  logger.progress('Resolving PyTorch profile for this machine');
  const { profile: selectedTorchProfile, vendor } = torch.resolveTorchProfile(logger);
  logger.installing(`PyTorch (${selectedTorchProfile.description})`);
  await executeWithRetry('uv', torch.buildTorchInstallArgs(selectedTorchProfile, venv, true), { label: 'torch', logger });
  await torch.installTorchCompatibilityPackages(selectedTorchProfile, venv, { logger });

  // 2b) FastAPI/uvicorn (+ flask, requests, click) the service imports (start_api.py / api.py) and
  //     that the verification below checks — not pulled by chatterbox itself (see serviceDeps.js).
  await installServiceDeps(venv, { logger });

  // 3) Install official chatterbox using uv pip.
  logger.installing('Voice cloning engine (chatterbox)');

  // Clone the official chatterbox repository at the pinned commit.
  logger.progress(`Cloning official chatterbox repository at pinned ref ${CHATTERBOX_REF}`);
  await shallowCloneAtRef(CHATTERBOX_REPO_URL, CHATTERBOX_REF, CHATTERBOX_DIR, { logger });
  logger.success(`Chatterbox repository cloned at ${CHATTERBOX_REF}`);

  // Apply PyTorch compatibility fix by modifying chatterbox dependencies.
  logger.progress('Applying PyTorch compatibility fix for chatterbox');
  const pyprojectPath = path.join(CHATTERBOX_DIR, 'pyproject.toml');

  if (fs.existsSync(pyprojectPath)) {
    logger.info(`Updating chatterbox dependencies for PyTorch ${selectedTorchProfile.expectedTorch} compatibility...`);

    let pyprojectContent = fs.readFileSync(pyprojectPath, 'utf8');

    // Replace incompatible PyTorch versions with working ones that support both F5-TTS and Chatterbox.
    // Pin to CUDA versions to prevent CPU installs - target specific packages only.
    pyprojectContent = pyprojectContent
      .replace(/torch==2\.\d+\.\d+(\+cu\d+)?/g, `torch==${selectedTorchProfile.torch}`)
      .replace(/torchaudio==2\.\d+\.\d+(\+cu\d+)?/g, `torchaudio==${selectedTorchProfile.torchaudio}`)
      .replace(/torchvision==0\.\d+\.\d+(\+cu\d+)?/g, `torchvision==${selectedTorchProfile.torchvision}`)
      .replace(/transformers==4\.4[6-9]\.\d+/g, 'transformers>=4.40.0,<4.47.0')
      .replace(/diffusers==0\.2[9]\.\d+/g, 'diffusers>=0.25.0,<0.30.0')
      // Replace the UNPINNED git dep `resemble-perth @ git+.../Perth.git@master` with the
      // equivalent PyPI release (same 1.0.1 version git master resolves to). The git source
      // uses the uv_build backend which fails under --no-build-isolation; the PyPI wheel
      // installs cleanly and makes the pinned commit fully reproducible.
      .replace(/resemble-perth\s*@\s*git\+[^"']+/g, 'resemble-perth==1.0.1');

    // Remove russian-text-stresser due to spacy==3.6.* hard pin causing conflict with gradio/typer (pydantic v2).
    try {
      const beforeLenRTS = pyprojectContent.length;
      pyprojectContent = pyprojectContent.replace(/^[\t ]*["']russian-text-stresser\b[^\n]*$/gmi, '');
      if (pyprojectContent.length !== beforeLenRTS) {
        logger.info('Removed russian-text-stresser to avoid spacy/typer/pydantic conflict');
        logger.info('Note: Russian stress features will be disabled.');
      }
    } catch (e) {
      logger.warning('Could not adjust russian-text-stresser dependency automatically');
    }

    // Remove or comment out pkuseg on Windows (requires MSVC compiler).
    if (process.platform === 'win32') {
      logger.info('Removing pkuseg dependency on Windows (requires MSVC compiler)...');
      // Remove pkuseg line entirely (commenting causes TOML parse issues).
      pyprojectContent = pyprojectContent.replace(
        /^\s*"pkuseg\s*==\s*[^"]+",?\s*$/gm,
        '', // Remove the line entirely
      );
    }

    fs.writeFileSync(pyprojectPath, pyprojectContent, 'utf8');
    logger.success('Chatterbox dependencies updated for compatibility');
  } else {
    logger.warning('pyproject.toml not found in chatterbox directory');
  }

  // First ensure numpy is installed (required for pkuseg build dependency).
  logger.progress('Installing numpy (required for chatterbox dependencies)');
  await executeWithRetry(
    'uv',
    ['pip', 'install', '--python', venv, ...getNarrationConstraintArgs(), 'numpy'],
    { label: 'numpy install', logger }
  );

  // Ensure Poetry build backend is available for dependencies using poetry.core (e.g., russian-text-stresser).
  logger.progress('Ensuring Poetry build backend (poetry-core) is available');
  try {
    await executeWithRetry(
      'uv',
      ['pip', 'install', '--python', venv, ...getNarrationConstraintArgs(), 'poetry-core'],
      { label: 'poetry-core install', logger }
    );
    logger.success('poetry-core installed into the chatterbox virtual environment');
  } catch (poetryCoreError) {
    logger.warning(`Failed to install poetry-core automatically: ${poetryCoreError.message}`);
    logger.info('Dependencies that use the poetry.core build backend may fail to build without this.');
  }

  // Install chatterbox from the local modified directory.
  logger.progress('Installing chatterbox from local modified directory');
  // Don't use -e flag, we want it copied to site-packages.
  // Root fix: install chatterbox together with python-dateutil in a single resolution to prevent pruning.
  // Use CUDA index to ensure PyTorch CUDA version is used, avoid --force-reinstall to prevent PyTorch conflicts.
  logger.info('Installing chatterbox with pinned python-dateutil (single resolution, site-packages)');

  const env = { UV_HTTP_TIMEOUT: '600' }; // 10 minutes for installation
  await executeWithRetry(
    'uv',
    [
      'pip', 'install', '--python', venv,
      ...getNarrationConstraintArgs(),
      '--no-build-isolation',
      ...buildTorchIndexArgList(selectedTorchProfile),
      CHATTERBOX_DIR,
      'python-dateutil==2.9.0.post0',
    ],
    { label: 'Chatterbox install', env, logger }
  );
  logger.success('Chatterbox installation completed');

  // Clean up the temporary directory after installation.
  logger.progress('Cleaning up temporary directory');
  try {
    fs.rmSync(CHATTERBOX_DIR, { recursive: true, force: true });
    logger.success('Temporary directory removed');
  } catch (err) {
    logger.warning('Could not remove temporary directory');
  }

  // 4) Verify PyTorch versions are correct.
  logger.progress('Verifying PyTorch compatibility after chatterbox installation');
  try {
    const verifyCode = "import torch; print(f'PyTorch version: {torch.__version__}')";
    const { stdout: output } = await runCommand('uv', ['run', '--python', venv, '--', 'python', '-c', verifyCode], {
      label: 'Chatterbox torch verify',
      logger,
    });
    if (output.includes(selectedTorchProfile.expectedTorch)) {
      logger.success(`PyTorch ${selectedTorchProfile.expectedTorch} verified successfully`);
    } else {
      logger.warning('PyTorch version mismatch detected, reinstalling...');
      await executeWithRetry('uv', torch.buildTorchInstallArgs(selectedTorchProfile, venv, true), { label: 'torch reinstall', env, logger });
      await torch.installTorchCompatibilityPackages(selectedTorchProfile, venv, { logger });
      logger.success(`PyTorch ${selectedTorchProfile.expectedTorch} reinstalled`);
    }
  } catch (error) {
    logger.warning(`PyTorch verification failed: ${error.message}`);
  }

  logger.success('Chatterbox is ready to use');

  // Verify the voice cloning engine (non-fatal — installation succeeds even if imports warn).
  logger.progress('Verifying voice cloning engine');
  const verifyChatterboxPyCode = `
import sys
import traceback

print("Verifying chatterbox installation...")
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
${vendor === 'NVIDIA' ? `
# NVIDIA box: a CUDA torch build was installed, so Chatterbox MUST see CUDA. Fail otherwise rather
# than silently run voice cloning on CPU.
import torch
if not torch.cuda.is_available():
    print('FATAL: NVIDIA GPU detected and a CUDA torch build installed, but torch.cuda.is_available()')
    print('       is False (driver/arch mismatch). Refusing to leave Chatterbox on CPU.')
    sys.exit(1)
print('torch CUDA OK:', torch.cuda.get_device_name(0))` : ''}

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
    print('⚠️ Skipping transformers test due to chatterbox import failure')

print('✅ Verification completed (with warnings if any shown above)')
`;
  const verifyChatterboxCmd = `uv run --python ${venv} -- python -c "${verifyChatterboxPyCode.replace(/"/g, '\\"')}"`;
  try {
    logger.command(verifyChatterboxCmd);
    await runCommand('uv', ['run', '--python', venv, '--', 'python', '-c', verifyChatterboxPyCode], {
      label: 'Chatterbox verify',
      logger,
    });
    logger.success('Voice cloning engine verification completed');
  } catch (verifyError) {
    logger.error(`Voice cloning engine verification failed: ${verifyError.message}`);
    throw verifyError;
  }
}

module.exports = { id: ID, install };
