#!/bin/bash

# Setup and run script for Mac/Linux
# This script installs dependencies and runs the application

# Determine script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Make script executable
chmod +x "$0"

# Function to detect GPU type
detect_gpu_type() {
    echo "Detecting GPU type..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macOS detected with Apple Silicon/Intel GPU"
        GPU_TYPE="apple"
        return 0
    fi
    
    # For Linux, check for NVIDIA GPU first
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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Installing Node.js..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v brew &> /dev/null; then
            echo "Homebrew not found. Installing..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            
            # Add Homebrew to PATH for current session
            if [[ -f /opt/homebrew/bin/brew ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f /usr/local/bin/brew ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
        fi
        
        brew install node
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Linux
        sudo apt update
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt install -y nodejs
    else
        echo "Unsupported operating system: $OSTYPE"
        exit 1
    fi
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm first."
    echo "For macOS: brew install node (includes npm)"
    echo "For Ubuntu: sudo apt install npm"
    exit 1
fi

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "FFmpeg is not installed. Installing FFmpeg..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install ffmpeg
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Ubuntu/Linux
        sudo apt update
        sudo apt install -y ffmpeg
    else
        echo "Unsupported operating system: $OSTYPE"
        exit 1
    fi
fi

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "uv is not installed. Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # Add uv to PATH for current session
    if [[ -d "$HOME/.cargo/bin" ]]; then
        export PATH="$HOME/.cargo/bin:$PATH"
    fi
fi

# Fix the start script in package.json to be cross-platform
echo "Updating package.json for cross-platform compatibility..."
if [[ -f "package.json" ]]; then
    sed -i.bak 's/"start": "set PORT=3008 && react-scripts start"/"start": "cross-env PORT=3008 react-scripts start"/' package.json
    if [ $? -ne 0 ]; then
        echo "WARNING: Failed to update package.json. The application might not work correctly."
    else
        echo "Successfully updated package.json for cross-platform compatibility."
    fi
fi

# Detect GPU type
detect_gpu_type

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Setup F5-TTS for narration
echo "Setting up F5-TTS for narration..."
node setup-narration.js

# Run the application with GPU acceleration
echo "Starting the application with GPU acceleration..."
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

npm run dev:cuda
