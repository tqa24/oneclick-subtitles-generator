/**
 * Script to set up the narration service with PyTorch CUDA support using uv.
 * Automatically attempts to install Python 3.11 via 'uv python install' if not found.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VENV_DIR = '.venv'; // Define the virtual environment directory name
const PYTHON_VERSION_TARGET = "3.11"; // Target Python version

// --- Helper Function to Check Command Existence ---
function commandExists(command) {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `command -v ${command}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
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


// --- 2. Check for/Install Python 3.11 ---
console.log(`\n🔍 Checking for Python ${PYTHON_VERSION_TARGET}...`);
let pythonInterpreterIdentifier = null; // Can be a path, alias like 'python3.11', or just the version '3.11' for uv
let triedUvInstall = false;

// First, try to find an existing Python 3.11 interpreter
try {
  // Check if py launcher is available (Windows)
  if (process.platform === 'win32') {
    try {
      const pyVersionsOutput = execSync('py -0p', { encoding: 'utf8' }).trim(); // -0p gives paths
      console.log('Available Python interpreters (via py launcher):');
      console.log(pyVersionsOutput);
      const lines = pyVersionsOutput.split('\n');
      // Match lines like ' -3.11-64 C:\Python311\python.exe' or ' -3.11    C:\Users\...\python.exe'
      const python311Line = lines.find(line => line.match(new RegExp(`^-${PYTHON_VERSION_TARGET}`)));
      if (python311Line) {
         const match = python311Line.match(/\s*(.+)$/);
         if(match && match[1]) {
            pythonInterpreterIdentifier = match[1].trim();
            console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} interpreter via py: ${pythonInterpreterIdentifier}`);
         }
      }
       // Fallback if path parsing failed but version exists via py -0
      if (!pythonInterpreterIdentifier && execSync('py -0', { encoding: 'utf8' }).includes(`-${PYTHON_VERSION_TARGET}`)) {
         pythonInterpreterIdentifier = `python${PYTHON_VERSION_TARGET}`; // Try alias
         console.log(`✅ Found Python ${PYTHON_VERSION_TARGET} via py launcher (using alias "${pythonInterpreterIdentifier}" for uv).`);
      }
    } catch (error) {
      console.log('py launcher check failed or Python ${PYTHON_VERSION_TARGET} not listed.');
    }
  }

  // Try checking standard pythonX.Y command (Linux/macOS or if py failed)
  const pythonCommand = `python${PYTHON_VERSION_TARGET}`;
  if (!pythonInterpreterIdentifier && commandExists(pythonCommand)) {
     try {
        const pythonVersion = execSync(`${pythonCommand} --version`, { encoding: 'utf8' }).trim();
        console.log(`Found Python via command: ${pythonVersion}`);
        if (pythonVersion.includes(PYTHON_VERSION_TARGET)) {
            pythonInterpreterIdentifier = pythonCommand; // Use the command name
            console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} via command "${pythonCommand}".`);
        }
     } catch(error) {
         console.log(`'${pythonCommand}' command exists but execution failed.`);
     }
  }
} catch (error) {
  console.warn(`Warning during initial Python ${PYTHON_VERSION_TARGET} check: ${error.message}. Will proceed.`);
}

// If not found by initial checks, try installing with uv
if (!pythonInterpreterIdentifier) {
    console.log(`⚠️ Python ${PYTHON_VERSION_TARGET} not found in standard locations.`);
    console.log(`🔧 Attempting to install Python ${PYTHON_VERSION_TARGET} using "uv python install ${PYTHON_VERSION_TARGET}"...`);
    triedUvInstall = true;
    try {
        // Use 'inherit' to show uv's download/install progress
        execSync(`uv python install ${PYTHON_VERSION_TARGET}`, { stdio: 'inherit' });
        console.log(`✅ Python ${PYTHON_VERSION_TARGET} installation via uv successful.`);
        // After uv installs, we can reliably tell uv to use the version number
        pythonInterpreterIdentifier = PYTHON_VERSION_TARGET;
    } catch (installError) {
        console.error(`❌ Failed to install Python ${PYTHON_VERSION_TARGET} using uv: ${installError.message}`);
        console.log(`   Please try installing Python ${PYTHON_VERSION_TARGET} manually (https://www.python.org/downloads/)`);
        console.log(`   or ensure uv has the necessary permissions and network access.`);
        process.exit(1);
    }
} else {
     console.log(`✅ Using Python ${PYTHON_VERSION_TARGET} interpreter: ${pythonInterpreterIdentifier}`);
}

// Final check - Should have an interpreter identifier if we reached here
if (!pythonInterpreterIdentifier) {
    // This state should ideally not be reached if the logic above is correct
    console.error(`❌ Could not find or install Python ${PYTHON_VERSION_TARGET}. Cannot proceed.`);
    process.exit(1);
}


// --- 3. Create a virtual environment with uv using the determined Python ---
console.log(`\n🔧 Creating virtual environment with uv at ./${VENV_DIR} using Python "${pythonInterpreterIdentifier}"...`);
try {
  // Use the determined identifier (could be a path, alias like python3.11, or just "3.11")
  execSync(`uv venv -p "${pythonInterpreterIdentifier}" ${VENV_DIR}`, { stdio: 'inherit' });
  console.log(`✅ Virtual environment created at ${VENV_DIR}`);
} catch (error) {
  console.error(`❌ Error creating virtual environment with uv: ${error.message}`);
   if (triedUvInstall) {
      console.log(`   Even after attempting 'uv python install', creating the venv with '${pythonInterpreterIdentifier}' failed.`);
      console.log(`   This might indicate an issue with the uv installation or environment.`);
      console.log(`   Try running 'uv venv -p ${PYTHON_VERSION_TARGET} ${VENV_DIR}' manually to diagnose.`);
   } else {
      console.log(`   Failed to create venv with existing interpreter "${pythonInterpreterIdentifier}". Is it a valid Python executable or alias known to uv?`);
   }
  process.exit(1);
}

// --- 4. Install PyTorch with CUDA support using uv pip ---
console.log('\n🔧 Installing PyTorch with CUDA support using uv...');
try {
  console.log(`Running: uv pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118`);
  // uv automatically uses the .venv-uv environment in the current dir
  execSync(`uv pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118`, { stdio: 'inherit' });

  // Verify installation using uv run
  console.log('\n🔍 Verifying PyTorch installation using uv run...');
  const verifyTorchCmd = `uv run -- python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA device count: {torch.cuda.device_count() if torch.cuda.is_available() else 0}'); print(f'CUDA device name: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \\"N/A\\" }')"`;
  const torchInfo = execSync(verifyTorchCmd).toString().trim();
  console.log(torchInfo);

  if (!torchInfo.includes('CUDA available: True')) {
    console.log('⚠️ CUDA is not available according to PyTorch. Ensure NVIDIA drivers and CUDA Toolkit compatible with cu118 are installed.');
  } else {
      console.log('✅ PyTorch CUDA check successful.');
  }
} catch (error) {
  console.error(`❌ Error installing/verifying PyTorch with uv: ${error.message}`);
  process.exit(1);
}

// --- 5. Install F5-TTS dependencies using uv pip ---
console.log('\n🔧 Installing F5-TTS dependencies using uv...');
try {
  console.log('Running: uv pip install flask flask-cors soundfile numpy vocos');
  execSync(`uv pip install flask flask-cors soundfile numpy vocos`, { stdio: 'inherit' });
  console.log('✅ F5-TTS dependencies installed.');
} catch (error) {
  console.error(`❌ Error installing F5-TTS dependencies with uv: ${error.message}`);
  process.exit(1);
}

// --- 6. Install F5-TTS using uv pip ---
console.log('\n🔧 Installing F5-TTS using uv...');
try {
  const f5TtsDir = 'F5-TTS';
  const setupPyPath = path.join(f5TtsDir, 'setup.py');
  const pyprojectTomlPath = path.join(f5TtsDir, 'pyproject.toml');

  // Updated Check: Ensure the directory exists AND contains either setup.py OR pyproject.toml
  if (!fs.existsSync(f5TtsDir)) {
       console.error(`❌ Error: Directory "${f5TtsDir}" not found.`);
       console.log(`   Make sure the F5-TTS source code is cloned/extracted into the "${f5TtsDir}" directory relative to this script.`);
       process.exit(1);
  } else if (!fs.existsSync(setupPyPath) && !fs.existsSync(pyprojectTomlPath)) {
      // Only fail if NEITHER setup file exists
       console.error(`❌ Error: Neither setup.py nor pyproject.toml found in the "${f5TtsDir}" directory.`);
       console.log(`   The F5-TTS source code seems incomplete or improperly structured.`);
       process.exit(1);
  } else {
      console.log(`✅ Found F5-TTS directory and a setup file (${fs.existsSync(pyprojectTomlPath) ? 'pyproject.toml' : 'setup.py'}).`);
  }

  // The installation command remains the same, uv handles both setup types
  console.log(`Running: uv pip install -e ./${f5TtsDir}`);
  execSync(`uv pip install -e ./${f5TtsDir}`, { stdio: 'inherit' });

  // Verify installation using uv run
  console.log('\n🔍 Verifying F5-TTS installation using uv run...');
  // OLD COMMAND (causes SyntaxError):
  // const verifyF5Cmd = `uv run -- python -c "try: from f5_tts.api import F5TTS; print('F5-TTS imported successfully'); except Exception as e: print(f'Error importing F5-TTS: {e}')"`;

  // NEW COMMAND (multi-line, correct syntax, better error handling):
  const verifyF5Cmd = `uv run -- python -c "import sys\nimport traceback\ntry:\n    from f5_tts.api import F5TTS\n    print('F5-TTS imported successfully')\nexcept Exception as e:\n    print(f'Error importing F5-TTS: {e}')\n    traceback.print_exc()\n    sys.exit(1)"`;

  // The rest of the try block remains the same
  const f5ttsInfo = execSync(verifyF5Cmd).toString().trim();
  console.log(f5ttsInfo); // This will now only contain the success message if it works

  // Check remains the same, but error details would have printed above if it failed
  if (!f5ttsInfo.includes('imported successfully')) {
    // This condition might be less likely to be hit if sys.exit(1) causes execSync to throw first
    console.log('⚠️ F5-TTS installation verification failed (see error details above).');
  } else {
       console.log('✅ F5-TTS installation verified.');
  }
} catch (error) {
  console.error(`❌ Error installing/verifying F5-TTS with uv: ${error.message}`);
  process.exit(1);
}

// --- 7. Create run script for narration service using uv run ---
console.log('\n🔧 Creating run script for narration service (using uv run)...');
try {
  const runScriptContent = `@echo off
echo Running narration service using Python ${PYTHON_VERSION_TARGET} (via uv) and PyTorch CUDA...
echo Ensure 'uv' is in your PATH.

REM uv automatically detects the .${VENV_DIR} environment
REM Run the narration service using uv run
uv run -- python server/narrationApp.py

pause
`;

  fs.writeFileSync('run-narration-service-uv.bat', runScriptContent);
  console.log('✅ Created run-narration-service-uv.bat');

  // Create combined run script
  const combinedRunScriptContent = `@echo off
echo Running the application with narration service (using uv)...

REM Start the narration service in a new window using the uv script
start "Narration Service (uv)" cmd /k "run-narration-service-uv.bat"

REM Wait for the narration service to start (adjust time if needed)
echo Waiting for narration service to start...
timeout /t 5 /nobreak > nul

REM Start the application (assuming Node.js part remains the same)
echo Starting the application...
npm run dev

pause
`;

  fs.writeFileSync('run-app-with-narration-uv.bat', combinedRunScriptContent);
  console.log('✅ Created run-app-with-narration-uv.bat');

} catch (error) {
  console.error(`❌ Error creating run scripts: ${error.message}`);
}

// --- 8. Update package.json ---
console.log('\n🔧 Updating package.json with uv commands...');
try {
  const packageJsonPath = path.join(__dirname, 'package.json');
  let packageJsonContent;
  try {
      packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  } catch (readError) {
      console.error(`❌ Error reading package.json at ${packageJsonPath}: ${readError.message}`);
      console.log('   Skipping package.json update.');
      throw readError; // Re-throw to prevent proceeding without package.json
  }

  const packageJson = JSON.parse(packageJsonContent);

  // Ensure scripts object exists
  if (!packageJson.scripts) {
      packageJson.scripts = {};
  }

  packageJson.scripts['python:start:cuda'] = `uv run -- python server/narrationApp.py`;
  packageJson.scripts['dev:cuda'] = 'concurrently "npm run start" "npm run server:start" "npm run python:start:cuda"';
  // Update install:all if this script is renamed, e.g., setup-narration-uv.js
  packageJson.scripts['install:all:uv'] = 'npm install && node setup-narration-uv.js'; // Adjust script name if needed

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json');
} catch (error) {
  // Error logged in the read/parse block or here if writing fails
  console.error(`❌ Error updating package.json: ${error.message}`);
  // Decide if this is a critical error or not. Usually, it's helpful but not essential for the core setup.
}

console.log('\n✅ Setup using uv completed successfully!');
console.log(`   Virtual environment created at: ./${VENV_DIR}`);
console.log(`   Python ${PYTHON_VERSION_TARGET} should be installed/managed by uv.`);
console.log('\n🚀 To run the application with narration service:');
console.log('   1. Ensure `uv` is in your PATH.');
console.log('   2. Run: run-app-with-narration-uv.bat');
console.log('   OR');
console.log('   3. Run: npm run dev:cuda (which now uses uv internally)');