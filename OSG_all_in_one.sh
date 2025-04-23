#!/bin/bash

# --- Configuration ---
PROJECT_FOLDER_NAME="oneclick-subtitles-generator"
GIT_REPO_URL="https://github.com/nganlinh4/oneclick-subtitles-generator.git"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_PATH="$SCRIPT_DIR/$PROJECT_FOLDER_NAME"

# --- Functions ---
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
        else
            echo "Git already installed."
        fi
        
        # Install Node.js
        if ! command -v node &> /dev/null; then
            echo "Node.js not found. Installing..."
            brew install node
        else
            echo "Node.js already installed."
        fi
        
        # Install FFmpeg
        if ! command -v ffmpeg &> /dev/null; then
            echo "FFmpeg not found. Installing..."
            brew install ffmpeg
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
        else
            echo "Git already installed."
        fi
        
        # Install Node.js
        if ! command -v node &> /dev/null; then
            echo "Node.js not found. Installing..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt install -y nodejs
        else
            echo "Node.js already installed."
        fi
        
        # Install FFmpeg
        if ! command -v ffmpeg &> /dev/null; then
            echo "FFmpeg not found. Installing..."
            sudo apt install -y ffmpeg
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
        # Add uv to PATH for current session
        if [[ -d "$HOME/.cargo/bin" ]]; then
            export PATH="$HOME/.cargo/bin:$PATH"
        fi
    else
        echo "uv already installed."
    fi
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
    local project_path="$1"
    
    if [ -d "$project_path" ]; then
        echo "Removing existing project directory: $project_path"
        rm -rf "$project_path"
        if [ $? -ne 0 ]; then
            echo "ERROR: Failed to remove existing project directory."
            return 1
        fi
    fi
    
    return 0
}

# --- Main Menu ---
show_menu() {
    clear
    echo "======================================================="
    echo "  Quản Lý Trình Tạo Phụ Đề OneClick"
    echo "======================================================="
    echo "CÀI ĐẶT:"
    echo "  1. Cài đặt với Tính năng Tường thuật (Cài đặt sạch)"
    echo "  2. Cài đặt không có Tính năng Tường thuật (Cài đặt sạch)"
    echo "  3. Cập nhật Ứng dụng"
    echo
    echo "CHẠY ỨNG DỤNG:"
    echo "  4. Chạy Ứng dụng (npm run dev)"
    echo "  5. Chạy Ứng dụng với Tường thuật (npm run dev:cuda)"
    echo
    echo "GỠ CÀI ĐẶT:"
    echo "  6. Gỡ cài đặt Ứng dụng (Xóa thư mục dự án)"
    echo
    echo "  7. Thoát"
    echo "======================================================="
    echo
    
    read -p "Nhập lựa chọn của bạn (1-7): " choice
    
    case $choice in
        1) install_with_narration ;;
        2) install_without_narration ;;
        3) update_app ;;
        4) run_app ;;
        5) run_app_cuda ;;
        6) uninstall_app ;;
        7) exit 0 ;;
        *) 
            echo "Lựa chọn không hợp lệ. Vui lòng thử lại."
            sleep 2
            show_menu
            ;;
    esac
}

install_with_narration() {
    echo "*** Tùy chọn 1: Cài đặt với Tính năng Tường thuật (Cài đặt sạch) ***"
    echo "*** (Lưu ý: Có thể tốn nhiều dung lượng lưu trữ hơn) ***"
    
    install_prerequisites
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install prerequisites."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    # Detect GPU type
    detect_gpu_type
    
    clean_install "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clean install."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Cloning repository from $GIT_REPO_URL..."
    git clone $GIT_REPO_URL "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clone repository."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Changing directory to $PROJECT_PATH"
    cd "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to change directory to project folder."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    # Fix the start script in package.json to be cross-platform
    echo "Updating package.json for cross-platform compatibility..."
    if [[ "$OSTYPE" != "darwin"* && "$OSTYPE" != "linux-gnu"* ]]; then
        # Skip on Windows
        echo "Skipping package.json update on Windows."
    else
        # Update the start script on Mac/Linux
        sed -i.bak 's/"start": "set PORT=3008 && react-scripts start"/"start": "cross-env PORT=3008 react-scripts start"/' package.json
        if [ $? -ne 0 ]; then
            echo "WARNING: Failed to update package.json. The application might not work correctly."
        else
            echo "Successfully updated package.json for cross-platform compatibility."
        fi
    fi
    
    echo "Installing dependencies (using npm run install:all)..."
    npm run install:all
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed during 'npm run install:all'. Check messages above."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Cài đặt hoàn tất. Đang khởi chạy ứng dụng với CUDA..."
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
    
    echo "Nhấn Ctrl+C trong cửa sổ này để dừng ứng dụng sau."
    npm run dev:cuda
    
    cd "$SCRIPT_DIR"
    show_menu
}

install_without_narration() {
    echo "*** Tùy chọn 2: Cài đặt không có Tính năng Tường thuật (Cài đặt sạch) ***"
    
    install_prerequisites
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install prerequisites."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    clean_install "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clean install."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Cloning repository from $GIT_REPO_URL..."
    git clone $GIT_REPO_URL "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to clone repository."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Changing directory to $PROJECT_PATH"
    cd "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to change directory to project folder."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    # Fix the start script in package.json to be cross-platform
    echo "Updating package.json for cross-platform compatibility..."
    if [[ "$OSTYPE" != "darwin"* && "$OSTYPE" != "linux-gnu"* ]]; then
        # Skip on Windows
        echo "Skipping package.json update on Windows."
    else
        # Update the start script on Mac/Linux
        sed -i.bak 's/"start": "set PORT=3008 && react-scripts start"/"start": "cross-env PORT=3008 react-scripts start"/' package.json
        if [ $? -ne 0 ]; then
            echo "WARNING: Failed to update package.json. The application might not work correctly."
        else
            echo "Successfully updated package.json for cross-platform compatibility."
        fi
    fi
    
    echo "Installing dependencies (using npm install)..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed during 'npm install'. Check messages above."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Cài đặt hoàn tất. Đang khởi chạy ứng dụng..."
    echo "Nhấn Ctrl+C trong cửa sổ này để dừng ứng dụng sau."
    npm run dev
    
    cd "$SCRIPT_DIR"
    show_menu
}

update_app() {
    echo "*** Tùy chọn 3: Cập nhật Ứng dụng ***"
    
    if [ ! -d "$PROJECT_PATH/.git" ]; then
        echo "LỖI: Thư mục dự án $PROJECT_PATH không tìm thấy hoặc không phải là kho git."
        echo "Vui lòng sử dụng một trong các tùy chọn Cài đặt trước."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Changing directory to $PROJECT_PATH"
    cd "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to change directory to project folder."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Pulling latest changes from repository..."
    git pull
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to pull updates using 'git pull'. Check messages above."
        cd "$SCRIPT_DIR"
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Kiểm tra cập nhật hoàn tất."
    cd "$SCRIPT_DIR"
    
    echo
    read -p "Chạy 'npm install' ngay bây giờ trong trường hợp các phụ thuộc đã thay đổi? (c/k): " install_deps
    if [ "$install_deps" = "c" ]; then
        echo "Changing directory to $PROJECT_PATH"
        cd "$PROJECT_PATH"
        if [ $? -ne 0 ]; then
            echo "ERROR: Failed to change directory to project folder for npm install."
            read -p "Press Enter to continue..."
            show_menu
            return
        fi
        
        echo "Running 'npm install'..."
        npm install
        if [ $? -ne 0 ]; then
            echo "WARNING: 'npm install' encountered errors. Check messages above."
        else
            echo "'npm install' completed."
        fi
        
        cd "$SCRIPT_DIR"
    fi
    
    read -p "Press Enter to continue..."
    show_menu
}

run_app() {
    echo "*** Tùy chọn 4: Chạy Ứng dụng ***"
    
    if [ ! -f "$PROJECT_PATH/package.json" ]; then
        echo "LỖI: Thư mục dự án $PROJECT_PATH hoặc package.json không tìm thấy."
        echo "Vui lòng sử dụng một trong các tùy chọn Cài đặt trước."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Changing directory to $PROJECT_PATH"
    cd "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to change directory to project folder."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Đang khởi chạy ứng dụng (using npm run dev)..."
    echo "Nhấn Ctrl+C trong cửa sổ này để dừng ứng dụng sau."
    npm run dev
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to start application using 'npm run dev'. Check messages above."
        cd "$SCRIPT_DIR"
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    cd "$SCRIPT_DIR"
    show_menu
}

run_app_cuda() {
    echo "*** Tùy chọn 5: Chạy Ứng dụng với Tường thuật (CUDA) ***"
    
    if [ ! -f "$PROJECT_PATH/package.json" ]; then
        echo "LỖI: Thư mục dự án $PROJECT_PATH hoặc package.json không tìm thấy."
        echo "Vui lòng sử dụng một trong các tùy chọn Cài đặt trước."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    # Detect GPU type
    detect_gpu_type
    
    echo "Changing directory to $PROJECT_PATH"
    cd "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to change directory to project folder."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Đang khởi chạy ứng dụng với GPU acceleration (using npm run dev:cuda)..."
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
    
    echo "Nhấn Ctrl+C trong cửa sổ này để dừng ứng dụng sau."
    npm run dev:cuda
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to start application using 'npm run dev:cuda'. Check messages above."
        cd "$SCRIPT_DIR"
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    cd "$SCRIPT_DIR"
    show_menu
}

uninstall_app() {
    echo "*** Tùy chọn 6: Gỡ cài đặt Ứng dụng ***"
    
    if [ ! -d "$PROJECT_PATH" ]; then
        echo "Thư mục dự án không tồn tại: $PROJECT_PATH"
        echo "Không có gì để gỡ cài đặt."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    read -p "Bạn có chắc chắn muốn xóa thư mục dự án? (c/k): " confirm
    if [ "$confirm" != "c" ]; then
        echo "Gỡ cài đặt đã bị hủy."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Xóa thư mục dự án: $PROJECT_PATH"
    rm -rf "$PROJECT_PATH"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to remove project directory."
        read -p "Press Enter to continue..."
        show_menu
        return
    fi
    
    echo "Gỡ cài đặt hoàn tất. Thư mục dự án đã được xóa."
    read -p "Press Enter to continue..."
    show_menu
}

# --- Start the script ---
# Make script executable
chmod +x "$0"

# Show the menu
show_menu
