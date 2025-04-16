#!/bin/bash

echo "==================================="
echo "F5-TTS Setup and Run Script"
echo "==================================="
echo

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "ERROR: uv is not installed."
    echo "Please install uv first:"
    echo "https://github.com/astral-sh/uv"
    echo
    echo "You can install it with:"
    echo "curl -sSf https://astral.sh/uv/install.sh | bash"
    exit 1
fi

echo "uv is installed. Proceeding with setup..."
echo

# Create Python virtual environment
echo "Creating Python virtual environment..."
uv venv .venv
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create Python virtual environment."
    exit 1
fi
echo "Virtual environment created successfully."
echo

# Install F5-TTS
echo "Installing F5-TTS..."
uv pip install -e F5-TTS
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install F5-TTS."
    exit 1
fi
echo "F5-TTS installed successfully."
echo

# Install Python dependencies
echo "Installing Python dependencies..."
uv pip install flask flask-cors soundfile numpy torch torchaudio vocos
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install Python dependencies."
    exit 1
fi
echo "Python dependencies installed successfully."
echo

# Create narration directories
echo "Creating narration directories..."
mkdir -p narration/reference narration/output
echo "Narration directories created successfully."
echo

echo "==================================="
echo "Setup completed successfully!"
echo "==================================="
echo
echo "Starting the application..."
echo

# Start the application
npm run dev
