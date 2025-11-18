const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script to create a portable Python wheelhouse for Electron packaging
 * This creates a minimal venv with all required dependencies using uv
 */

const WHEELHOUSE_DIR = path.join(__dirname, '../bin/python-wheelhouse');
const VENV_DIR = path.join(__dirname, '../.venv');
const UV_EXECUTABLE = process.env.UV_EXECUTABLE || 'uv';

console.log('🔧 Creating Python wheelhouse for Electron packaging using uv...');

// Python dependencies that need to be bundled
const REQUIRED_PACKAGES = [
  'flask',
  'flask-cors',
  'soundfile',
  'numpy',
  'scipy',
  'fastapi',
  'uvicorn[standard]',
  'pydub',
  'onnxruntime',
  'python-dateutil==2.9.0.post0'
];

async function createWheelhouse() {
  try {
    // Check if uv is available
    try {
      execSync(`${UV_EXECUTABLE} --version`, { encoding: 'utf8' });
      console.log('✅ UV package manager found');
    } catch (error) {
      throw new Error('UV not found. Please install uv: https://astral.sh/uv');
    }

    // Create wheelhouse directory
    if (fs.existsSync(WHEELHOUSE_DIR)) {
      fs.rmSync(WHEELHOUSE_DIR, { recursive: true });
    }
    fs.mkdirSync(WHEELHOUSE_DIR, { recursive: true });

    console.log('📦 Creating virtual environment in wheelhouse using uv...');
    
    // Create new venv in wheelhouse directory using uv
    execSync(`${UV_EXECUTABLE} venv ${WHEELHOUSE_DIR}/venv`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    const pythonExec = process.platform === 'win32'
      ? path.join(WHEELHOUSE_DIR, 'venv', 'Scripts', 'python.exe')
      : path.join(WHEELHOUSE_DIR, 'venv', 'bin', 'python');

    const pipExec = process.platform === 'win32'
      ? path.join(WHEELHOUSE_DIR, 'venv', 'Scripts', 'pip.exe')
      : path.join(WHEELHOUSE_DIR, 'venv', 'bin', 'pip');

    console.log('⬆️  Upgrading pip...');
    execSync(`${UV_EXECUTABLE} pip install --upgrade pip`, {
      stdio: 'inherit',
      cwd: WHEELHOUSE_DIR
    });

    console.log('📚 Installing required packages...');
    
    // Install packages one by one to handle any failures
    for (const pkg of REQUIRED_PACKAGES) {
      try {
        console.log(`  Installing ${pkg}...`);
        execSync(`${UV_EXECUTABLE} pip install ${pkg}`, {
          stdio: 'inherit',
          cwd: WHEELHOUSE_DIR
        });
      } catch (error) {
        console.warn(`⚠️  Failed to install ${pkg}, continuing...`);
      }
    }

    // Install local packages if they exist
    const localPackages = [
      '../chatterbox-fastapi',
      '../parakeet_wrapper'
    ];

    for (const pkg of localPackages) {
      const pkgPath = path.join(__dirname, pkg);
      if (fs.existsSync(pkgPath)) {
        try {
          console.log(`  Installing local package: ${pkg}...`);
          execSync(`${UV_EXECUTABLE} pip install -e ${pkg}`, {
            stdio: 'inherit',
            cwd: WHEELHOUSE_DIR
          });
        } catch (error) {
          console.warn(`⚠️  Failed to install local package ${pkg}, continuing...`);
        }
      }
    }

    // Create startup script for the wheelhouse
    const startupScript = process.platform === 'win32'
      ? path.join(WHEELHOUSE_DIR, 'start-services.bat')
      : path.join(WHEELHOUSE_DIR, 'start-services.sh');

    const scriptContent = process.platform === 'win32'
      ? `@echo off
cd /d "%~dp0"
set PYTHONPATH=%cd%\\app;%cd%\\venv\\Lib\\site-packages
set PATH=%cd%\\venv\\Scripts;%PATH%

if "%1"=="narration" (
    echo Starting F5-TTS Narration Service...
    python app\\server\\narrationApp.py
) else if "%1"=="chatterbox" (
    echo Starting Chatterbox API Service...
    python app\\chatterbox-fastapi\\start_api.py --host 0.0.0.0 --port 5002
) else (
    echo Starting all services...
    start /B python app\\server\\narrationApp.py
    start /B python app\\chatterbox-fastapi\\start_api.py --host 0.0.0.0 --port 5002
)

pause`
      : `#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH="$(pwd)/app:$(pwd)/venv/lib/python*/site-packages"
export PATH="$(pwd)/venv/bin:$PATH"

if [ "$1" = "narration" ]; then
    echo "Starting F5-TTS Narration Service..."
    python app/server/narrationApp.py
elif [ "$1" = "chatterbox" ]; then
    echo "Starting Chatterbox API Service..."
    python app/chatterbox-fastapi/start_api.py --host 0.0.0.0 --port 5002
else
    echo "Starting all services..."
    python app/server/narrationApp.py &
    python app/chatterbox-fastapi/start_api.py --host 0.0.0.0 --port 5002 &
fi
`;

    fs.writeFileSync(startupScript, scriptContent);
    
    if (process.platform !== 'win32') {
      fs.chmodSync(startupScript, '755');
    }

    console.log('✅ Python wheelhouse created successfully!');
    console.log(`📁 Location: ${WHEELHOUSE_DIR}`);
    console.log('📋 Package list:');
    execSync(`${UV_EXECUTABLE} pip list`, { stdio: 'inherit', cwd: WHEELHOUSE_DIR });

  } catch (error) {
    console.error('❌ Failed to create wheelhouse:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createWheelhouse();
}

module.exports = { createWheelhouse, WHEELHOUSE_DIR };