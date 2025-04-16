/**
 * Script to set up the narration service with PyTorch CUDA support using uv.
 * Forcefully removes any existing F5-TTS directory and clones the repository.
 * Automatically attempts to install Python 3.11 via 'uv python install' if not found.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
        // Use fs.rmSync for synchronous removal (requires Node v14.14.0+)
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
let pythonInterpreterIdentifier = null; // Can be a path, alias like 'python3.11', or just the version '3.11' for uv
let triedUvInstall = false;

// First, try to find an existing Python 3.11 interpreter
try {
  // Check if py launcher is available (Windows)
  if (process.platform === 'win32') {
    try {
      const pyVersionsOutput = execSync('py -0p', { encoding: 'utf8' }).trim(); // -0p gives paths
      console.log('   Available Python interpreters (via py launcher):');
      console.log(pyVersionsOutput || '   (None found or py command failed)');
      const lines = pyVersionsOutput.split('\n');
      // Match lines like ' -3.11-64 C:\Python311\python.exe' or ' -3.11    C:\Users\...\python.exe'
      const python311Line = lines.find(line => line.match(new RegExp(`^-${PYTHON_VERSION_TARGET}`)));
      if (python311Line) {
         const match = python311Line.match(/\s*(.+)$/);
         if(match && match[1]) {
            pythonInterpreterIdentifier = match[1].trim();
            // Ensure path is quoted if it contains spaces for later use
            if (pythonInterpreterIdentifier.includes(' ')) {
                pythonInterpreterIdentifier = `"${pythonInterpreterIdentifier}"`;
            }
            console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} interpreter via py: ${pythonInterpreterIdentifier}`);
         }
      }
       // Fallback if path parsing failed but version exists via py -0
      if (!pythonInterpreterIdentifier && execSync('py -0', { encoding: 'utf8' }).includes(`-${PYTHON_VERSION_TARGET}`)) {
         pythonInterpreterIdentifier = `python${PYTHON_VERSION_TARGET}`; // Try alias
         console.log(`✅ Found Python ${PYTHON_VERSION_TARGET} via py launcher (using alias "${pythonInterpreterIdentifier}" for uv).`);
      }
    } catch (error) {
      console.log(`   py launcher check failed or Python ${PYTHON_VERSION_TARGET} not listed.`);
    }
  }

  // Try checking standard pythonX.Y command (Linux/macOS or if py failed)
  const pythonCommand = `python${PYTHON_VERSION_TARGET}`;
  if (!pythonInterpreterIdentifier && commandExists(pythonCommand)) {
     try {
        const pythonVersion = execSync(`${pythonCommand} --version`, { encoding: 'utf8' }).trim();
        console.log(`   Found Python via command: ${pythonVersion}`);
        if (pythonVersion.includes(PYTHON_VERSION_TARGET)) {
            // Get the full path for robustness
            const checkCmd = process.platform === 'win32' ? `where ${pythonCommand}` : `command -v ${pythonCommand}`;
            const fullPath = execSync(checkCmd, { encoding: 'utf8' }).split('\n')[0].trim(); // Take the first result
            if (fullPath) {
                 pythonInterpreterIdentifier = fullPath.includes(' ') ? `"${fullPath}"` : fullPath;
                 console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} via command "${pythonCommand}" at: ${pythonInterpreterIdentifier}`);
            } else {
                 pythonInterpreterIdentifier = pythonCommand; // Fallback to using the command name
                 console.log(`✅ Found existing Python ${PYTHON_VERSION_TARGET} via command "${pythonCommand}" (using alias for uv).`);
            }
        }
     } catch(error) {
         console.log(`   '${pythonCommand}' command exists but execution failed or couldn't get path.`);
         // Fallback: If the command exists, let uv try to find it by alias
         if(commandExists(pythonCommand)){ // double check existence before assuming alias
            pythonInterpreterIdentifier = pythonCommand;
            console.log(`   Assuming uv can find "${pythonCommand}".`);
         }
     }
  }
} catch (error) {
  console.warn(`   Warning during initial Python ${PYTHON_VERSION_TARGET} check: ${error.message}. Will proceed to check uv install.`);
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
     console.log(`✅ Using Python ${PYTHON_VERSION_TARGET} interpreter identifier for uv: ${pythonInterpreterIdentifier}`);
}

// Final check - Should have an interpreter identifier if we reached here
if (!pythonInterpreterIdentifier) {
    // This state should ideally not be reached if the logic above is correct
    console.error(`❌ Could not find or install Python ${PYTHON_VERSION_TARGET}. Cannot proceed.`);
    process.exit(1);
}


// --- 4. Create a virtual environment with uv using the determined Python ---
console.log(`\n🔧 Creating virtual environment with uv at ./${VENV_DIR} using Python "${pythonInterpreterIdentifier}"...`);
try {
  // Use the determined identifier (could be a path, alias like python3.11, or just "3.11")
  // No extra quotes needed around pythonInterpreterIdentifier as execSync handles it,
  // and we added quotes internally if the path had spaces.
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

// --- 5. Install PyTorch with CUDA support using uv pip ---
console.log('\n🔧 Installing PyTorch with CUDA support using uv...');
try {
  const torchCmd = `uv pip install torch==2.1.0 torchvision==0.16.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118`;
  console.log(`Running: ${torchCmd}`);
  // uv automatically uses the .venv environment in the current dir if it exists
  execSync(torchCmd, { stdio: 'inherit' });

  // Verify installation using uv run
  console.log('\n🔍 Verifying PyTorch installation using uv run...');
  const verifyTorchCmd = `uv run -- python -c "import torch; print(f'PyTorch version: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA device count: {torch.cuda.device_count() if torch.cuda.is_available() else 0}'); print(f'CUDA device name: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \\"N/A\\" }')"`;
  const torchInfo = execSync(verifyTorchCmd, { encoding: 'utf8' }).trim(); // Use encoding
  console.log(torchInfo);

  if (!torchInfo.includes('CUDA available: True')) {
    console.warn('⚠️ CUDA is not available according to PyTorch. Ensure NVIDIA drivers and CUDA Toolkit compatible with cu118 are installed.');
     console.warn('   If you do not have an NVIDIA GPU or CUDA installed, this is expected. The application might run on CPU (if supported).');
  } else {
      console.log('✅ PyTorch CUDA check successful.');
  }
} catch (error) {
  console.error(`❌ Error installing/verifying PyTorch with uv: ${error.message}`);
  console.log(`   Command failed: ${error.cmd}`); // Show the exact command that failed
  process.exit(1);
}

// --- 6. Install F5-TTS dependencies using uv pip ---
console.log('\n🔧 Installing F5-TTS dependencies using uv...');
try {
  const depsCmd = `uv pip install flask flask-cors soundfile numpy vocos`;
  console.log(`Running: ${depsCmd}`);
  execSync(depsCmd, { stdio: 'inherit' });
  console.log('✅ F5-TTS dependencies installed.');
} catch (error) {
  console.error(`❌ Error installing F5-TTS dependencies with uv: ${error.message}`);
  console.log(`   Command failed: ${error.cmd}`);
  process.exit(1);
}

// --- 7. Install F5-TTS using uv pip ---
console.log('\n🔧 Installing F5-TTS using uv...');
try {
  // Check if the directory exists (it should have been cloned in step 2)
  if (!fs.existsSync(F5_TTS_DIR)) {
       console.error(`❌ Error: Directory "${F5_TTS_DIR}" not found.`);
       console.log(`   The script attempted to clone it earlier, but it seems to be missing now.`);
       process.exit(1);
   }

  const setupPyPath = path.join(F5_TTS_DIR, 'setup.py');
  const pyprojectTomlPath = path.join(F5_TTS_DIR, 'pyproject.toml');

  // Check if EITHER setup file exists within the directory
  if (!fs.existsSync(setupPyPath) && !fs.existsSync(pyprojectTomlPath)) {
       console.error(`❌ Error: Neither setup.py nor pyproject.toml found in the "${F5_TTS_DIR}" directory.`);
       console.log(`   The F5-TTS source code seems incomplete or improperly structured in the cloned repository.`);
       process.exit(1);
  } else {
      console.log(`✅ Found F5-TTS directory and a setup file (${fs.existsSync(pyprojectTomlPath) ? 'pyproject.toml' : 'setup.py'}).`);
  }

  // The installation command remains the same, uv handles both setup types
  const installF5Cmd = `uv pip install -e ./${F5_TTS_DIR}`;
  console.log(`Running: ${installF5Cmd}`);
  execSync(installF5Cmd, { stdio: 'inherit' });

  // Verify installation using uv run
  console.log('\n🔍 Verifying F5-TTS installation using uv run...');
  // Use multi-line Python command for clarity and better error handling
  const verifyF5PyCode = `
import sys
import traceback
try:
    from f5_tts.api import F5TTS
    print('F5-TTS imported successfully')
    # Optional: Instantiate to catch potential init errors? Might be too slow/complex.
    # f5 = F5TTS()
    # print('F5-TTS instantiated successfully')
except Exception as e:
    print(f'Error importing/using F5-TTS: {e}')
    traceback.print_exc()
    sys.exit(1)
`;
  // Escape double quotes inside the Python code string for the shell command
  const verifyF5Cmd = `uv run -- python -c "${verifyF5PyCode.replace(/"/g, '\\"')}"`;

  execSync(verifyF5Cmd, { stdio: 'inherit', encoding: 'utf8' }); // Use inherit to see output directly, check for non-zero exit code
  console.log('✅ F5-TTS installation verified.'); // If execSync didn't throw, it's likely okay

} catch (error) {
  // execSync throws an error if the command returns a non-zero exit code (like sys.exit(1) in the Python script)
  // or if the command execution fails for other reasons.
  console.error(`❌ Error installing/verifying F5-TTS with uv: ${error.message}`);
  // error.stdout/stderr might contain useful info if stdio wasn't 'inherit'
  console.log(`   Verification command failed. Check the output above for details from Python.`);
  process.exit(1);
}

// --- 8. Create run script for narration service using uv run ---
console.log('\n🔧 Creating run script for narration service (using uv run)...');
try {
  const setupScriptName = path.basename(__filename); // Get the name of this script file
  const runScriptContent = `@echo off
setlocal

echo Running narration service using Python ${PYTHON_VERSION_TARGET} (via uv) and PyTorch CUDA...
echo Activating environment and running server/narrationApp.py with uv...
echo.

REM Ensure the script's directory is the current directory
cd /d "%~dp0"

REM Check if uv is available
uv --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Error: 'uv' command not found in PATH. Please install uv.
    echo See: https://github.com/astral-sh/uv#installation
    goto PauseAndExit
)

REM Check if the venv exists
if not exist "${VENV_DIR}\\Scripts\\python.exe" (
    if not exist "${VENV_DIR}/bin/python" (
      echo Error: Virtual environment '.${VENV_DIR}' not found or incomplete.
      echo Please run the setup script again (e.g., node ${setupScriptName}).
      goto PauseAndExit
    )
)

REM uv automatically detects the .venv environment in the current dir
REM Run the narration service using uv run
echo Starting server...
uv run -- python server/narrationApp.py

echo.
echo Server stopped.
goto End

:PauseAndExit
echo.
pause
exit /b 1

:End
endlocal
pause
`;

  fs.writeFileSync('run-narration-service-uv.bat', runScriptContent);
  console.log('✅ Created run-narration-service-uv.bat');

  // Create combined run script
  const combinedRunScriptContent = `@echo off
setlocal
echo Running the application with narration service (using uv)...

REM Ensure the script's directory is the current directory
cd /d "%~dp0"

REM Check if the narration service run script exists
if not exist "run-narration-service-uv.bat" (
    echo Error: run-narration-service-uv.bat not found.
    echo Please run the setup script again (e.g., node ${setupScriptName}).
    goto PauseAndExit
)

REM Check if npm is available
npm --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Error: 'npm' command not found in PATH. Please install Node.js and npm.
    echo See: https://nodejs.org/
    goto PauseAndExit
)


REM Start the narration service in a new window using the uv script
echo Starting Narration Service (uv)...
start "Narration Service (uv)" cmd /c "run-narration-service-uv.bat"

REM Wait for the narration service to start (adjust time if needed)
echo Waiting a few seconds for narration service to initialize...
timeout /t 5 /nobreak > nul

REM Start the application (assuming Node.js part remains the same)
echo Starting the main application (npm run dev)...
npm run dev

echo.
echo Main application stopped.
goto End

:PauseAndExit
echo.
pause
exit /b 1

:End
endlocal
pause
`;

  fs.writeFileSync('run-app-with-narration-uv.bat', combinedRunScriptContent);
  console.log('✅ Created run-app-with-narration-uv.bat');

} catch (error) {
  console.error(`❌ Error creating run scripts: ${error.message}`);
  // Decide if this is critical enough to exit
  // process.exit(1);
}

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
          // Don't re-throw, allow script to finish but warn user.
      } else {
          console.error(`❌ Error reading package.json at ${packageJsonPath}: ${readError.message}`);
          console.log('   Skipping package.json update.');
          throw readError; // Re-throw for other read errors
      }
  }

  // Proceed only if package.json was read successfully
  if (packageJsonContent) {
      const packageJson = JSON.parse(packageJsonContent);

      // Ensure scripts object exists
      if (!packageJson.scripts) {
          packageJson.scripts = {};
      }

      const setupScriptName = path.basename(__filename); // Get the name of this script file

      packageJson.scripts['python:start:cuda:uv'] = `uv run -- python server/narrationApp.py`;
      packageJson.scripts['dev:cuda:uv'] = `concurrently "npm run start" "npm run server:start" "npm run python:start:cuda:uv"`;
      packageJson.scripts['setup:narration:uv'] = `node ${setupScriptName}`; // Command to run this setup script
      // Optional: Add an alias if preferred
      // packageJson.scripts['install:all:uv'] = 'npm install && npm run setup:narration:uv';

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`✅ Updated package.json with setup command "setup:narration:uv" and run commands.`);
  }
} catch (error) {
  // Error logged in the read/parse block or here if writing fails
  console.error(`❌ Error updating package.json: ${error.message}`);
  // Decide if this is a critical error or not. Usually, it's helpful but not essential for the core setup.
}

console.log('\n✅ Setup using uv completed successfully!');
console.log(`   - Removed any existing "${F5_TTS_DIR}" directory.`);
console.log(`   - Cloned fresh F5-TTS repository into "${F5_TTS_DIR}".`);
console.log(`   - Virtual environment created at: ./${VENV_DIR}`);
console.log(`   - Python ${PYTHON_VERSION_TARGET} should be installed/managed by uv within the venv.`);
console.log(`   - PyTorch (CUDA), F5-TTS, and dependencies installed in the venv.`);
console.log('\n🚀 To run the application with narration service:');
console.log('   1. Ensure `uv` and `npm` are in your PATH.');
console.log('   2. Run the batch file: run-app-with-narration-uv.bat');
console.log('   OR');
console.log('   3. Run the npm script: npm run dev:cuda:uv');
console.log('\n💡 To just run the narration service:');
console.log('   - run-narration-service-uv.bat');
console.log('   - OR npm run python:start:cuda:uv');
console.log('\n🔧 To re-run this setup (will delete F5-TTS and reinstall venv packages):');
console.log(`   - node ${path.basename(__filename)}`);
console.log(`   - OR npm run setup:narration:uv (if package.json was updated)`);