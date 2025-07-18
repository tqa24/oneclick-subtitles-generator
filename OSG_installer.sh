#!/bin/bash

# --- Configuration ---
# This script assumes it's running from within the cloned repository
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_PATH="$SCRIPT_DIR"
GIT_REPO_URL="https://github.com/nganlinh4/oneclick-subtitles-generator.git"

# --- Functions ---
# Colored echo function for better visual output
colored_echo() {
    local message="$1"

    # Extract bracket content and text
    if [[ $message =~ ^\[([^\]]+)\]\ (.*)$ ]]; then
        local bracket_content="${BASH_REMATCH[1]}"
        local text="${BASH_REMATCH[2]}"

        # Define colors
        local color=""
        case "$bracket_content" in
            "SETUP") color="\033[36m" ;;  # Cyan
            "OK") color="\033[32m" ;;     # Green
            "ERROR") color="\033[31m" ;;  # Red
            "WARN") color="\033[33m" ;;   # Yellow
            "INFO") color="\033[34m" ;;   # Blue
            "?") color="\033[33m" ;;      # Yellow
            "START") color="\033[35m" ;;  # Magenta
            *) color="\033[37m" ;;        # White
        esac

        # Print with colored brackets and white text
        echo -e "${color}[${bracket_content}]\033[0m ${text}"
    else
        # If no brackets found, just print normally
        echo "$message"
    fi
}

error_occurred() {
    echo
    echo "======================================================"
    colored_echo "[ERROR] Installation failed!"
    echo "======================================================"
    colored_echo "[INFO] Common solutions:"
    echo "  - Close this terminal and run the installer again"
    echo "  - Restart your computer and try again"
    echo "  - Check your internet connection"
    echo "  - Ensure you have proper permissions"
    echo
    colored_echo "[INFO] System PATH may need to be refreshed for new tools."
    echo "======================================================"
    echo
    read -p "Press Enter to return to main menu..."
    show_menu
}

refresh_env() {
    # Refresh environment variables (similar to REFRESHENV in Windows)
    colored_echo "[SETUP] Refreshing environment variables..."

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
    echo
    echo "--- Checking System Requirements ---"

    # Check OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        colored_echo "[INFO] Detected macOS"

        # Check if Homebrew is installed
        if ! command -v brew &> /dev/null; then
            colored_echo "[SETUP] Installing Homebrew package manager..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

            # Add Homebrew to PATH for current session
            if [[ -f /opt/homebrew/bin/brew ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f /usr/local/bin/brew ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
            colored_echo "[OK] Homebrew installed successfully."
        else
            colored_echo "[OK] Homebrew already installed."
        fi

        # Install Git
        if ! command -v git &> /dev/null; then
            colored_echo "[SETUP] Installing Git version control..."
            brew install git >/dev/null 2>&1
            refresh_env
            colored_echo "[OK] Git installed successfully."
        else
            colored_echo "[OK] Git already installed."
        fi

        # Install Node.js
        if ! command -v node &> /dev/null; then
            colored_echo "[SETUP] Installing Node.js runtime..."
            brew install node >/dev/null 2>&1
            refresh_env
            colored_echo "[OK] Node.js installed successfully."
        else
            colored_echo "[OK] Node.js already installed."
        fi

        # Install FFmpeg
        if ! command -v ffmpeg &> /dev/null; then
            colored_echo "[SETUP] Installing FFmpeg media processor..."
            brew install ffmpeg >/dev/null 2>&1
            refresh_env
            colored_echo "[OK] FFmpeg installed successfully."
        else
            colored_echo "[OK] FFmpeg already installed."
        fi
        
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Linux
        colored_echo "[INFO] Detected Linux"

        # Update package lists
        colored_echo "[SETUP] Updating package lists..."
        sudo apt update >/dev/null 2>&1

        # Install Git
        if ! command -v git &> /dev/null; then
            colored_echo "[SETUP] Installing Git version control..."
            sudo apt install -y git >/dev/null 2>&1
            refresh_env
            colored_echo "[OK] Git installed successfully."
        else
            colored_echo "[OK] Git already installed."
        fi

        # Install Node.js
        if ! command -v node &> /dev/null; then
            colored_echo "[SETUP] Installing Node.js runtime..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - >/dev/null 2>&1
            sudo apt install -y nodejs >/dev/null 2>&1
            refresh_env
            colored_echo "[OK] Node.js installed successfully."
        else
            colored_echo "[OK] Node.js already installed."
        fi

        # Install FFmpeg
        if ! command -v ffmpeg &> /dev/null; then
            colored_echo "[SETUP] Installing FFmpeg media processor..."
            sudo apt install -y ffmpeg >/dev/null 2>&1
            refresh_env
            colored_echo "[OK] FFmpeg installed successfully."
        else
            colored_echo "[OK] FFmpeg already installed."
        fi
    else
        colored_echo "[ERROR] Unsupported operating system: $OSTYPE"
        exit 1
    fi

    # Install uv (cross-platform)
    if ! command -v uv &> /dev/null; then
        colored_echo "[SETUP] Installing uv Python package manager..."
        curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1
        refresh_env
        # Add uv to PATH for current session
        if [[ -d "$HOME/.cargo/bin" ]]; then
            export PATH="$HOME/.cargo/bin:$PATH"
        fi
        colored_echo "[OK] uv installed successfully."
    else
        colored_echo "[OK] uv already installed."
    fi

    echo
    colored_echo "[OK] System requirements check completed."
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

    # Clean Chatterbox directory
    if [ -d "chatterbox/chatterbox" ]; then
        echo "Removing Chatterbox directory..."
        rm -rf chatterbox/chatterbox
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
        echo "  ├── OSG_installer.sh  (this script)"
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
    echo
    # Display the original Unicode ASCII logo with smooth blue gradient (left-to-right diagonal)
    echo -e "\033[96m░██████╗░\033[94m░███████╗░\033[34m░██████╗░\033[0m"
    echo -e "\033[94m██╔═══██╗░\033[34m██╔════╝░\033[90m██╔════╝░\033[0m"
    echo -e "\033[34m██║░░░██║░\033[90m███████╗░\033[37m██║░░███╗\033[0m"
    echo -e "\033[90m██║░░░██║░\033[37m╚════██║░\033[97m██║░░░██║\033[0m"
    echo -e "\033[37m╚██████╔╝░\033[97m███████║░\033[97m╚██████╔╝\033[0m"
    echo -e "\033[97m░╚═════╝░░\033[97m╚══════╝░\033[97m░╚═════╝░\033[0m"
    echo
    echo "======================================================="
    echo "  OneClick Subtitles Generator - Setup & Manager"
    echo "======================================================="
    echo "Vi tri (Location): $(pwd)"
    echo "Thu muc Du an (Project Folder): $PROJECT_FOLDER_NAME"
    echo "======================================================="
    echo "SETUP & INSTALLATION:"
    echo "  1. Cai dat (Thuyet minh thong thuong + Long tieng nhan ban giong noi) (Install with Gemini + F5-TTS + Chatterbox Narration)"
    echo "  2. Cai dat (Thuyet minh thong thuong) (Install with Gemini Narration)"
    echo "  3. Cap nhat Ung dung (Update)"
    echo
    echo "RUN APPLICATION:"
    echo "  4. Chay Ung dung (Run App)"
    echo "  5. Chay Ung dung voi Nhan ban giong noi (Run App with F5-TTS + Chatterbox Narration)"
    echo
    echo "UNINSTALL:"
    echo "  6. Go cai dat Ung dung (Uninstall)"
    echo
    echo "  7. Thoat (Exit)"
    echo "======================================================="
    echo

    read -p "Enter your choice (1-7): " choice

    case $choice in
        1) install_with_narration ;;
        2) install_without_narration ;;
        3) update_app ;;
        4) run_app ;;
        5) run_app_cuda ;;
        6) uninstall_app ;;
        7) exit 0 ;;
        *)
            echo "Invalid choice. Please try again."
            sleep 2
            show_menu
            ;;
    esac
}

install_with_narration() {
    echo
    echo "======================================================"
    colored_echo "[SETUP] Option 1: Full Installation with Voice Cloning"
    echo "======================================================"
    echo

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    install_prerequisites
    if [ $? -ne 0 ]; then
        colored_echo "[ERROR] Failed to install prerequisites."
        error_occurred
        return
    fi

    # Detect GPU type
    detect_gpu_type

    clean_install
    if [ $? -ne 0 ]; then
        colored_echo "[ERROR] Failed to clean install."
        error_occurred
        return
    fi

    # Fix the start script in package.json to be cross-platform
    colored_echo "[SETUP] Updating package.json for cross-platform compatibility..."
    # Update the start script on Mac/Linux
    sed -i.bak 's/"start": "set PORT=3008 && react-scripts start"/"start": "cross-env PORT=3008 react-scripts start"/' package.json >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        colored_echo "[WARN] Failed to update package.json. The application might not work correctly."
    else
        colored_echo "[OK] Successfully updated package.json for cross-platform compatibility."
    fi

    colored_echo "[SETUP] Installing all dependencies (this may take several minutes)..."
    npm run install:all
    if [ $? -ne 0 ]; then
        colored_echo "[ERROR] Failed to install dependencies. Check messages above."
        error_occurred
        return
    fi

    colored_echo "[SETUP] Finalizing installation..."
    npm run install:yt-dlp >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        colored_echo "[WARN] YouTube downloader installation had issues."
        colored_echo "[INFO] You can fix this later with 'npm run install:yt-dlp'."
    fi

    echo
    colored_echo "[OK] Installation completed successfully!"
    colored_echo "[START] Launching application with voice cloning features..."
    colored_echo "[INFO] Press Ctrl+C to stop the application."
    echo
    if [[ "$GPU_TYPE" == "nvidia" ]]; then
        echo "[INFO] NVIDIA GPU detected, using CUDA acceleration."
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
    echo
    echo "======================================================"
    colored_echo "[SETUP] Option 2: Standard Installation"
    echo "======================================================"
    echo

    # Check if we're in the right directory
    check_repo_structure
    if [ $? -ne 0 ]; then
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    install_prerequisites
    if [ $? -ne 0 ]; then
        colored_echo "[ERROR] Failed to install prerequisites."
        error_occurred
        return
    fi

    clean_install
    if [ $? -ne 0 ]; then
        colored_echo "[ERROR] Failed to clean install."
        error_occurred
        return
    fi

    colored_echo "[SETUP] Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        colored_echo "[ERROR] Failed to install dependencies. Check messages above."
        error_occurred
        return
    fi

    colored_echo "[SETUP] Finalizing installation..."
    npm run install:yt-dlp >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        colored_echo "[WARN] YouTube downloader installation had issues."
        colored_echo "[INFO] You can fix this later with 'npm run install:yt-dlp'."
    fi

    echo
    colored_echo "[OK] Installation completed successfully!"
    colored_echo "[START] Launching application..."
    colored_echo "[INFO] Press Ctrl+C to stop the application."
    echo
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
    echo "*** Option 5: Run Application with Voice Cloning (F5-TTS + Chatterbox) ***"

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
        echo "ERROR: Voice Cloning features not installed. Please use option 1 to install with narration features."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi

    if [ ! -d "chatterbox/chatterbox" ]; then
        echo "WARNING: Chatterbox not found. Some voice cloning features may not be available."
        echo "Consider reinstalling with option 1 for full functionality."
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





uninstall_app() {
    echo "*** Option 6: Uninstall Application ***"

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
    echo "  - All dependencies (node_modules, .venv, F5-TTS, Chatterbox)"
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
    echo "   ./OSG_installer.sh"
    echo
    echo "Current directory: $(pwd)"
    echo "Files found: $(ls -la | head -5)"
    exit 1
fi

# Initialize git submodules if they haven't been initialized yet
if [ -f ".gitmodules" ]; then
    colored_echo "[SETUP] Initializing git submodules..."
    if git submodule init >/dev/null 2>&1 && git submodule update >/dev/null 2>&1; then
        colored_echo "[OK] Git submodules initialized successfully."
    else
        colored_echo "[WARN] Git submodule initialization failed. This may cause issues with voice cloning features."
        colored_echo "[INFO] You can manually initialize submodules later with: git submodule update --init --recursive"
    fi
fi

# Show the menu
show_menu
