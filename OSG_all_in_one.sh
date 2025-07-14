#!/bin/bash

# --- Configuration ---
# This script assumes it's running from within the cloned repository
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_PATH="$SCRIPT_DIR"
GIT_REPO_URL="https://github.com/nganlinh4/oneclick-subtitles-generator.git"

# --- Functions ---
error_occurred() {
    echo
    echo "********** An error occurred. Please review the messages above. **********"
    echo "Please close and reopen the terminal and run the script again if there are errors,"
    echo "as system PATH for package managers and tools may need to be refreshed."
    echo
    read -p "Press Enter to return to main menu..."
    show_menu
}

refresh_env() {
    # Refresh environment variables (similar to REFRESHENV in Windows)
    echo "Refreshing environment variables..."

    # Source common profile files to pick up new PATH entries
    if [ -f ~/.bashrc ]; then
        source ~/.bashrc 2>/dev/null || true
    fi
    if [ -f ~/.bash_profile ]; then
        source ~/.bash_profile 2>/dev/null || true
    fi
    if [ -f ~/.profile ]; then
        source ~/.profile 2>/dev/null || true
    fi

    # For macOS, also source Homebrew environment
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if [[ -f /opt/homebrew/bin/brew ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
        elif [[ -f /usr/local/bin/brew ]]; then
            eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true
        fi
    fi

    # Add cargo/uv to PATH if it exists
    if [[ -d "$HOME/.cargo/bin" ]]; then
        export PATH="$HOME/.cargo/bin:$PATH"
    fi
}

install_prerequisites() {
    echo "--- Installing prerequisites ---"
    
    # Check OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo "Detected macOS"
        
        # Check if Homebrew is installed
        if ! command -v brew &> /dev/null; then
            echo "Homebrew not found. Installing..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            
            # Add Homebrew to PATH for current session
            if [[ -f /opt/homebrew/bin/brew ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f /usr/local/bin/brew ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
        else
            echo "Homebrew already installed."
        fi
        
        # Install Git
        if ! command -v git &> /dev/null; then
            echo "Git not found. Installing..."
            brew install git
            refresh_env
        else
            echo "Git already installed."
        fi

        # Install Node.js
        if ! command -v node &> /dev/null; then
            echo "Node.js not found. Installing..."
            brew install node
            refresh_env
        else
            echo "Node.js already installed."
        fi

        # Install FFmpeg
        if ! command -v ffmpeg &> /dev/null; then
            echo "FFmpeg not found. Installing..."
            brew install ffmpeg
            refresh_env
        else
            echo "FFmpeg already installed."
        fi
        
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Linux
        echo "Detected Linux"
        
        # Update package lists
        sudo apt update
        
        # Install Git
        if ! command -v git &> /dev/null; then
            echo "Git not found. Installing..."
            sudo apt install -y git
            refresh_env
        else
            echo "Git already installed."
        fi

        # Install Node.js
        if ! command -v node &> /dev/null; then
            echo "Node.js not found. Installing..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt install -y nodejs
            refresh_env
        else
            echo "Node.js already installed."
        fi

        # Install FFmpeg
        if ! command -v ffmpeg &> /dev/null; then
            echo "FFmpeg not found. Installing..."
            sudo apt install -y ffmpeg
            refresh_env
        else
            echo "FFmpeg already installed."
        fi
    else
        echo "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Install uv (cross-platform)
    if ! command -v uv &> /dev/null; then
        echo "uv not found. Installing..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        refresh_env
        # Add uv to PATH for current session
        if [[ -d "$HOME/.cargo/bin" ]]; then
            export PATH="$HOME/.cargo/bin:$PATH"
        fi
    else
        echo "uv already installed."
    fi

    echo "--- Prerequisites installation/check completed ---"
    echo
}

# Function to detect GPU type and install appropriate PyTorch
detect_gpu_type() {
    echo "Detecting GPU type..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS detected with Apple Silicon/Intel GPU"
        GPU_TYPE="apple"
        return 0
    fi
    
    # For Linux and Windows, check for NVIDIA GPU first
    if command -v nvidia-smi &> /dev/null; then
        echo "NVIDIA GPU detected"
        GPU_TYPE="nvidia"
        return 0
    fi
    
    # Check for AMD GPU on Linux
    if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v rocminfo &> /dev/null; then
        echo "AMD GPU with ROCm detected"
        GPU_TYPE="amd"
        return 0
    fi
    
    # Check for Intel GPU
    if command -v sycl-ls &> /dev/null || command -v intel_gpu_top &> /dev/null; then
        echo "Intel GPU detected"
        GPU_TYPE="intel"
        return 0
    fi
    
    # Fallback to CPU
    echo "No supported GPU detected or GPU drivers not installed."
    echo "Will use CPU for processing (TTS generation will be slow)"
    GPU_TYPE="cpu"
    return 0
}

clean_install() {
    echo "Cleaning up previous installations..."

    # Clean node_modules
    if [ -d "node_modules" ]; then
        echo "Removing node_modules..."
        rm -rf node_modules
    fi

    # Clean Python virtual environment
    if [ -d ".venv" ]; then
        echo "Removing Python virtual environment..."
        rm -rf .venv
    fi

    # Clean F5-TTS directory
    if [ -d "F5-TTS" ]; then
        echo "Removing F5-TTS directory..."
        rm -rf F5-TTS
    fi

    # Clean package-lock.json
    if [ -f "package-lock.json" ]; then
        echo "Removing package-lock.json..."
        rm -f package-lock.json
    fi

    echo "Clean up completed."
    return 0
}

# --- Validation Functions ---
check_repo_structure() {
    if [ ! -f "package.json" ]; then
        echo "ERROR: package.json not found. Make sure you're running this script from the repository root."
        echo "Expected structure:"
        echo "  oneclick-subtitles-generator/"
        echo "  ├── package.json"
        echo "  ├── OSG_all_in_one.sh  (this script)"
        echo "  └── ..."
        return 1
    fi

    if [ ! -f "server.js" ]; then
        echo "ERROR: server.js not found. This doesn't appear to be the correct repository."
        return 1
    fi

    return 0
}

# --- Main Menu ---
show_menu() {
    clear
    echo "======================================================="
    echo "  OneClick Subtitles Generator - Setup & Manager"
    echo "======================================================="
    echo "Current directory: $(pwd)"
    echo "======================================================="
    echo "SETUP & INSTALLATION:"
    echo "  1. Install with Narration Features (Clean Install)"
    echo "  2. Install without Narration Features (Clean Install)"
    echo "  3. Update Application (git pull + dependencies)"
    echo
    echo "RUN APPLICATION:"
    echo "  4. Run Application (npm run dev)"
    echo "  5. Run Application with Narration (npm run dev:cuda)"
    echo
    echo "MAINTENANCE:"
    echo "  6. Clean Install Dependencies Only"
    echo "  7. Reset Application (Clean all generated files)"
    echo
    echo "UNINSTALL:"
    echo "  8. Uninstall Application"
    echo
    echo "  9. Exit"
    echo "======================================================="
    echo

    read -p "Enter your choice (1-9): " choice

    case $choice in
        1) install_with_narration ;;
        2) install_without_narration ;;
        3) update_app ;;
        4) run_app ;;
        5) run_app_cuda ;;
        6) clean_dependencies ;;
        7) reset_app ;;
        8) uninstall_app ;;
        9) exit 0 ;;
        *)
            echo "Invalid choice. Please try again."
            sleep 2
            show_menu
            ;;
    esac
}

install_with_narration() {
    echo "*** Option 1: Install with Narration Features (Clean Install) ***"
    echo "*** (Note: Requires more storage space and GPU for optimal performance) ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    install_prerequisites
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install prerequisites."
        error_occurred
        return
    fi

    # Detect GPU type
    detect_gpu_type

    clean_install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clean install."
        error_occurred
        return
    fi
    
    # Fix the start script in package.json to be cross-platform
    echo "Updating package.json for cross-platform compatibility..."
    # Update the start script on Mac/Linux
    sed -i.bak 's/"start": "set PORT=3008 && react-scripts start"/"start": "cross-env PORT=3008 react-scripts start"/' package.json
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to update package.json. The application might not work correctly."
    else
        echo "Successfully updated package.json for cross-platform compatibility."
    fi

    echo "Installing dependencies (using npm run install:all)..."
    npm run install:all
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed during 'npm run install:all'. Check messages above."
        error_occurred
        return
    fi

    echo "Installing yt-dlp for YouTube video downloads..."
    npm run install:yt-dlp
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to install yt-dlp. YouTube downloads might have issues."
        echo "You can try installing it manually later with 'npm run install:yt-dlp'."
    fi

    echo "Installation completed. Starting application with GPU acceleration..."
    if [[ "$GPU_TYPE" == "nvidia" ]]; then
        echo "NVIDIA GPU detected, using CUDA acceleration."
    elif [[ "$GPU_TYPE" == "apple" ]]; then
        echo "Apple Silicon/Intel GPU detected, using Metal acceleration."
    elif [[ "$GPU_TYPE" == "amd" ]]; then
        echo "AMD GPU detected, using ROCm acceleration."
    elif [[ "$GPU_TYPE" == "intel" ]]; then
        echo "Intel GPU detected, using XPU acceleration."
    else
        echo "WARNING: No supported GPU detected. TTS generation will be slow."
    fi

    echo "Press Ctrl+C in this window to stop the application later."
    npm run dev:cuda

    show_menu
}

install_without_narration() {
    echo "*** Option 2: Install without Narration Features (Clean Install) ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    install_prerequisites
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install prerequisites."
        error_occurred
        return
    fi

    clean_install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clean install."
        error_occurred
        return
    fi
    
    # Fix the start script in package.json to be cross-platform
    echo "Updating package.json for cross-platform compatibility..."
    # Update the start script on Mac/Linux
    sed -i.bak 's/"start": "set PORT=3008 && react-scripts start"/"start": "cross-env PORT=3008 react-scripts start"/' package.json
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to update package.json. The application might not work correctly."
    else
        echo "Successfully updated package.json for cross-platform compatibility."
    fi

    echo "Installing dependencies (using npm install)..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed during 'npm install'. Check messages above."
        error_occurred
        return
    fi

    echo "Installing yt-dlp for YouTube video downloads..."
    npm run install:yt-dlp
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to install yt-dlp. YouTube downloads might have issues."
        echo "You can try installing it manually later with 'npm run install:yt-dlp'."
    fi

    echo "Installation completed. Starting application..."
    echo "Press Ctrl+C in this window to stop the application later."
    npm run dev

    show_menu
}

update_app() {
    echo "*** Option 3: Update Application ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    if [ ! -d ".git" ]; then
        echo "ERROR: This directory is not a git repository."
        echo "Please make sure you cloned the repository properly."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    echo "Pulling latest changes from repository..."
    git reset --hard origin/main
    git pull
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to pull updates using 'git pull'. Check messages above."
        error_occurred
        return
    fi

    # Update yt-dlp if it exists
    if [ -d ".venv" ]; then
        echo "Updating yt-dlp..."
        uv pip install --python .venv --upgrade yt-dlp
    fi

    echo "Update check completed."

    echo
    read -p "Run 'npm install' now in case dependencies have changed? (y/n): " install_deps
    if [ "$install_deps" = "y" ] || [ "$install_deps" = "Y" ]; then
        echo "Running 'npm install'..."
        npm install
        if [ $? -ne 0 ]; then
            echo "WARNING: 'npm install' encountered errors. Check messages above."
        else
            echo "'npm install' completed."
        fi
    fi

    read -p "Press Enter to continue..."
    show_menu
}

run_app() {
    echo "*** Option 4: Run Application ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    if [ ! -d "node_modules" ]; then
        echo "ERROR: node_modules not found. Please install dependencies first (option 1, 2, or 6)."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    echo "Starting application (using npm run dev)..."
    echo "Press Ctrl+C in this window to stop the application later."
    npm run dev
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to start application using 'npm run dev'. Check messages above."
        error_occurred
        return
    fi

    show_menu
}

run_app_cuda() {
    echo "*** Option 5: Run Application with Narration ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    if [ ! -d "node_modules" ]; then
        echo "ERROR: node_modules not found. Please install dependencies first (option 1)."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    if [ ! -d ".venv" ] || [ ! -d "F5-TTS" ]; then
        echo "ERROR: Narration features not installed. Please use option 1 to install with narration features."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    # Detect GPU type
    detect_gpu_type

    echo "Starting application with GPU acceleration (using npm run dev:cuda)..."
    if [[ "$GPU_TYPE" == "nvidia" ]]; then
        echo "NVIDIA GPU detected, using CUDA acceleration."
    elif [[ "$GPU_TYPE" == "apple" ]]; then
        echo "Apple Silicon/Intel GPU detected, using Metal acceleration."
    elif [[ "$GPU_TYPE" == "amd" ]]; then
        echo "AMD GPU detected, using ROCm acceleration."
    elif [[ "$GPU_TYPE" == "intel" ]]; then
        echo "Intel GPU detected, using XPU acceleration."
    else
        echo "WARNING: No supported GPU detected. TTS generation will be slow."
    fi

    echo "Press Ctrl+C in this window to stop the application later."
    npm run dev:cuda
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to start application using 'npm run dev:cuda'. Check messages above."
        error_occurred
        return
    fi

    show_menu
}

clean_dependencies() {
    echo "*** Option 6: Clean Install Dependencies Only ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    clean_install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clean install."
        error_occurred
        return
    fi

    # Fix the start script in package.json to be cross-platform
    echo "Updating package.json for cross-platform compatibility..."
    sed -i.bak 's/"start": "set PORT=3008 && react-scripts start"/"start": "cross-env PORT=3008 react-scripts start"/' package.json
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to update package.json. The application might not work correctly."
    else
        echo "Successfully updated package.json for cross-platform compatibility."
    fi

    echo "Installing basic dependencies (using npm install)..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed during 'npm install'. Check messages above."
        error_occurred
        return
    fi

    echo "Installing yt-dlp for YouTube video downloads..."
    npm run install:yt-dlp
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to install yt-dlp. YouTube downloads might have issues."
        echo "You can try installing it manually later with 'npm run install:yt-dlp'."
    fi

    echo "Dependencies installation completed."
    read -p "Press Enter to continue..."
    show_menu
}

reset_app() {
    echo "*** Option 7: Reset Application ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    echo "WARNING: This will remove all generated files and dependencies."
    echo "The following will be deleted:"
    echo "  - node_modules/"
    echo "  - .venv/"
    echo "  - F5-TTS/"
    echo "  - package-lock.json"
    echo "  - Any generated output files"
    echo
    read -p "Are you sure you want to continue? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Reset cancelled."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    clean_install

    # Also clean any output directories
    if [ -d "output" ]; then
        echo "Removing output directory..."
        rm -rf output
    fi

    if [ -d "temp" ]; then
        echo "Removing temp directory..."
        rm -rf temp
    fi

    echo "Application reset completed. All generated files have been removed."
    echo "You can now run option 1 or 2 to reinstall."
    read -p "Press Enter to continue..."
    show_menu
}

uninstall_app() {
    echo "*** Option 8: Uninstall Application ***"

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        echo "INFO: Project directory structure not found. Application may not be installed."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    echo "WARNING: This action will permanently delete the project directory and all its contents:"
    echo "$(pwd)"
    echo
    echo "This includes:"
    echo "  - All source code"
    echo "  - All dependencies (node_modules, .venv, F5-TTS)"
    echo "  - All generated files and outputs"
    echo "  - All configuration and settings"
    echo
    read -p "Are you sure you want to continue with uninstallation? (y/n): " confirm_uninstall
    if [ "$confirm_uninstall" != "y" ] && [ "$confirm_uninstall" != "Y" ]; then
        echo "Uninstallation cancelled."
        show_menu
        return
    fi

    echo "Removing project directory: $(pwd)..."

    # Get parent directory before deletion
    PARENT_DIR="$(dirname "$(pwd)")"
    PROJECT_NAME="$(basename "$(pwd)")"

    # Move to parent directory
    cd "$PARENT_DIR"

    # Remove the project directory
    rm -rf "$PROJECT_NAME"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to remove project directory. Check permissions or if files are in use."
        echo "You may need to manually delete: $PARENT_DIR/$PROJECT_NAME"
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    echo "Uninstallation completed. Project directory has been removed."
    echo "The script will now exit as the project no longer exists."
    exit 0
}

# --- Start the script ---
# Make script executable
chmod +x "$0"

# Check for sudo privileges (for Linux package installation)
check_sudo_privileges() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Checking sudo privileges..."
        if ! sudo -n true 2>/dev/null; then
            echo "This script requires sudo privileges for package installation on Linux."
            echo "Please enter your password when prompted."
            sudo -v
            if [ $? -ne 0 ]; then
                echo "ERROR: Sudo privileges required. Exiting."
                exit 1
            fi
        fi
        echo "Sudo privileges confirmed."
        echo
    fi
}

# Check sudo privileges
check_sudo_privileges

# Check if we're in the right directory before showing menu
echo "OneClick Subtitles Generator - Setup & Manager"
echo "=============================================="
echo

# Validate repository structure
if [ ! -f "package.json" ] || [ ! -f "server.js" ]; then
    echo "ERROR: This script must be run from the repository root directory."
    echo
    echo "Expected usage:"
    echo "1. Clone the repository:"
    echo "   git clone https://github.com/nganlinh4/oneclick-subtitles-generator.git"
    echo "2. Navigate to the repository:"
    echo "   cd oneclick-subtitles-generator"
    echo "3. Run this script:"
    echo "   ./OSG_all_in_one.sh"
    echo
    echo "Current directory: $(pwd)"
    echo "Files found: $(ls -la | head -5)"
    exit 1
fi

# Show the menu
show_menu
