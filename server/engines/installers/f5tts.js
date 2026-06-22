/**
 * Per-engine installer for F5-TTS (the Text-to-Speech AI engine).
 *
 * Gives F5-TTS its OWN venv (.venvs/f5tts) instead of the legacy shared .venv. Every install
 * command/pin/ref/constraint is reproduced verbatim from setup-narration.js (the F5-TTS block and
 * verifyF5TTSRuntime) — only the venv path is swapped. Network steps go through executeWithRetry so
 * a transient blip during the torch download or the uv pip install retries instead of aborting.
 */

const fs = require('fs');
const path = require('path');
const { getEngineVenvTarget, projectRoot } = require('../venvPaths');
const { executeWithRetry, runCommand } = require('./execHelpers');
const { installServiceDeps } = require('./serviceDeps');
const torch = require('../torchProfile');

const ID = 'f5tts';

// Pins reproduced verbatim from setup-narration.js — do not bump without testing the engine.
const F5_TTS_DIR = path.join(projectRoot, 'f5-tts-temp'); // Temporary directory for F5-TTS installation
const F5_TTS_REPO_URL = 'https://github.com/SWivid/F5-TTS.git';
const F5_TTS_REF = process.env.F5_TTS_REF || '1.1.20'; // Pin to a known-good release; override explicitly if needed

// Shared narration compatibility constraints applied before verification.
const NARRATION_CONSTRAINTS_FILE = path.join(projectRoot, 'narration-constraints.txt');
const NARRATION_COMPAT_PACKAGE_SPECS = ['protobuf>=4.25.8,<7'];

function getNarrationConstraintArgs() {
  return fs.existsSync(NARRATION_CONSTRAINTS_FILE) ? ['-c', NARRATION_CONSTRAINTS_FILE] : [];
}

async function install({ onLog = () => {} } = {}) {
  const log = (m) => onLog(String(m));
  const logger = {
    info: log, warning: log, progress: log, command: log, success: log,
    found: log, installing: log, subsection: log, step: () => {}, error: log,
  };

  const venv = getEngineVenvTarget(ID);

  // --- 1. Create the engine's own venv ---
  logger.subsection(`Creating F5-TTS venv at ${venv}`);
  await runCommand('uv', ['venv', venv, '-p', 'python3.11'], { label: 'F5-TTS venv create', logger });

  // --- 2. Install PyTorch (profile resolved by GPU detection) ---
  const { profile, installNotes, vendor } = torch.resolveTorchProfile(logger);
  logger.info(installNotes);
  await executeWithRetry('uv', torch.buildTorchInstallArgs(profile, venv, true), { label: 'torch install', logger });
  await torch.installTorchCompatibilityPackages(profile, venv, { logger });

  // --- 2b. Flask (+ shared service deps) the narration server (server/narrationApp.py) imports;
  //         F5-TTS itself does not pull a web framework, so install it explicitly (see serviceDeps.js).
  await installServiceDeps(venv, { logger });

  // --- 3. Install F5-TTS from its pinned release ---
  logger.installing('Text-to-Speech AI engine');
  try {
    // Clone the official F5-TTS repository at the pinned tag.
    logger.progress('Cloning official F5-TTS repository');

    // Remove existing F5-TTS directory if it exists.
    if (fs.existsSync(F5_TTS_DIR)) {
      logger.info('Removing existing F5-TTS directory...');
      fs.rmSync(F5_TTS_DIR, { recursive: true, force: true });
    }

    // Clone the repository (tag clone; --depth 1 keeps it shallow).
    await executeWithRetry(
      'git',
      ['clone', '--depth', '1', '--branch', F5_TTS_REF, F5_TTS_REPO_URL, F5_TTS_DIR],
      { label: 'F5-TTS clone', logger }
    );
    logger.success('F5-TTS repository cloned');

    // Modify F5-TTS pyproject.toml to include package data (configs, etc.).
    logger.progress('Ensuring F5-TTS package data is included');
    const f5PyprojectPath = path.join(F5_TTS_DIR, 'pyproject.toml');

    if (fs.existsSync(f5PyprojectPath)) {
      let f5PyprojectContent = fs.readFileSync(f5PyprojectPath, 'utf8');

      // Add package data configuration if not present.
      if (!f5PyprojectContent.includes('[tool.setuptools.packages.find]')) {
        f5PyprojectContent += '\n\n[tool.setuptools.packages.find]\nwhere = ["src"]\n\n[tool.setuptools.package-data]\nf5_tts = ["configs/*.yaml", "model/*.pt", "model/*.safetensors", "infer/examples/*.txt", "infer/examples/*.wav", "infer/examples/*.flac", "infer/examples/*.toml", "infer/examples/multi/*.txt", "infer/examples/multi/*.flac", "infer/examples/multi/*.toml", "infer/examples/basic/*.wav", "infer/examples/basic/*.toml", "runtime/**/*.txt"]\n';
        fs.writeFileSync(f5PyprojectPath, f5PyprojectContent, 'utf8');
        logger.success('Added comprehensive package data configuration to F5-TTS pyproject.toml');
      } else {
        logger.info('F5-TTS pyproject.toml already has package data configuration');
      }
    } else {
      logger.warning('F5-TTS pyproject.toml not found, package data may not be included');
    }

    // Install F5-TTS from the local modified directory.
    logger.progress('Installing F5-TTS from local directory');
    // Don't use -e flag, we want it copied to site-packages.
    const env = { UV_HTTP_TIMEOUT: '600' }; // 10 minutes for installation
    await executeWithRetry(
      'uv',
      ['pip', 'install', '--python', venv, ...getNarrationConstraintArgs(), '--no-build-isolation', F5_TTS_DIR],
      { label: 'F5-TTS install', env, logger }
    );
    logger.success('F5-TTS installation completed');

    // Copy example audio files to server directory for the reference audio controller.
    logger.progress('Copying example audio files to server directory');
    try {
      const exampleAudioDir = path.join(projectRoot, 'server', 'example-audio');
      if (!fs.existsSync(exampleAudioDir)) {
        fs.mkdirSync(exampleAudioDir, { recursive: true });
      }

      // Copy basic reference audio files from the F5-TTS package.
      // Use platform-specific site-packages path.
      const sitePackagesPath = process.platform === 'win32'
        ? path.join(venv, 'Lib', 'site-packages')
        : path.join(venv, 'lib', 'python3.11', 'site-packages');

      const basicRefEnSrc = path.join(sitePackagesPath, 'f5_tts', 'infer', 'examples', 'basic', 'basic_ref_en.wav');
      const basicRefEnDest = path.join(exampleAudioDir, 'basic_ref_en.wav');
      if (fs.existsSync(basicRefEnSrc)) {
        fs.copyFileSync(basicRefEnSrc, basicRefEnDest);
        logger.info('Copied basic_ref_en.wav to server/example-audio/');
      }

      const basicRefZhSrc = path.join(sitePackagesPath, 'f5_tts', 'infer', 'examples', 'basic', 'basic_ref_zh.wav');
      const basicRefZhDest = path.join(exampleAudioDir, 'basic_ref_zh.wav');
      if (fs.existsSync(basicRefZhSrc)) {
        fs.copyFileSync(basicRefZhSrc, basicRefZhDest);
        logger.info('Copied basic_ref_zh.wav to server/example-audio/');
      }

      // Copy additional example files that might be useful.
      const additionalFiles = [
        { src: 'infer/examples/basic/basic.toml', dest: 'basic.toml' },
        { src: 'infer/examples/multi/story.txt', dest: 'story.txt' },
        { src: 'infer/examples/multi/story.toml', dest: 'story.toml' },
        { src: 'infer/examples/vocab.txt', dest: 'vocab.txt' },
      ];

      for (const file of additionalFiles) {
        const srcPath = path.join(sitePackagesPath, 'f5_tts', file.src);
        const destPath = path.join(exampleAudioDir, file.dest);
        if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
          logger.info(`Copied ${file.dest} to server/example-audio/`);
        }
      }

      logger.success('Example audio files copied successfully');
    } catch (copyError) {
      logger.warning(`Could not copy example audio files: ${copyError.message}`);
    }

    // Clean up the temporary directory after installation.
    logger.progress('Cleaning up temporary directory');
    try {
      fs.rmSync(F5_TTS_DIR, { recursive: true, force: true });
      logger.success('Temporary directory removed');
    } catch (err) {
      logger.warning('Could not remove temporary directory');
    }

    // --- 4. Verify ---
    logger.progress('Verifying Text-to-Speech engine');
    await repairNarrationCompatibility(venv, logger,
      'Applying shared narration compatibility constraints before F5-TTS verification');
    await verifyF5TTSRuntime(venv, logger, vendor === 'NVIDIA');
    logger.success('Text-to-Speech engine verification completed');
  } catch (error) {
    logger.error(`Error installing/verifying F5-TTS with uv: ${error.message}`);
    throw error;
  }
}

async function repairNarrationCompatibility(venv, logger, reason) {
  const constraintArgs = getNarrationConstraintArgs();
  if (constraintArgs.length === 0) {
    logger.warning('Narration constraints file not found; compatibility repair skipped');
    return;
  }

  logger.progress(reason);
  await executeWithRetry(
    'uv',
    ['pip', 'install', '--python', venv, ...constraintArgs, ...NARRATION_COMPAT_PACKAGE_SPECS],
    { label: 'narration compatibility repair', logger }
  );
}

async function verifyF5TTSRuntime(venv, logger, expectCuda = false) {
  // On an NVIDIA box (a CUDA torch build was installed) F5-TTS MUST see CUDA — fail the install
  // otherwise so it never silently runs on CPU. F5-TTS runs on torch, so torch.cuda is the gate.
  const cudaCheck = expectCuda ? `
import torch
if not torch.cuda.is_available():
    print("FATAL: NVIDIA GPU detected and a CUDA torch build installed, but torch.cuda.is_available()")
    print("       is False (driver/arch mismatch). Refusing to leave F5-TTS on CPU.")
    sys.exit(1)
print("torch CUDA OK:", torch.cuda.get_device_name(0))` : '';
  const verifyF5PyCode = `
import sys
import importlib.metadata as md
import flask          # narration server (server/narrationApp.py) — not pulled by F5-TTS itself
import flask_cors
import wandb
from f5_tts.api import F5TTS
${cudaCheck}
print("protobuf:", md.version("protobuf"))
print("wandb:", md.version("wandb"))
print("f5-tts:", md.version("f5-tts"))
print("F5-TTS API verified")
	`;

  await runCommand('uv', ['run', '--python', venv, '--', 'python', '-c', verifyF5PyCode], {
    label: 'F5-TTS verify',
    logger,
  });
}

module.exports = { id: ID, install };
