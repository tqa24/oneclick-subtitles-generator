#!/bin/bash

# --- Configuration ---
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_PATH="$SCRIPT_DIR"
PROJECT_FOLDER_NAME="oneclick-subtitles-generator"

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
            "UNINSTALL") color="\033[35m" ;;  # Magenta
            "COMPLETE") color="\033[32m" ;;   # Green
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
    colored_echo "[ERROR] Uninstallation failed!"
    echo "======================================================"
    colored_echo "[INFO] Common solutions:"
    echo "  - Close this terminal and run the uninstaller again"
    echo "  - Restart your computer and try again"
    echo "  - Check if any applications are currently running"
    echo "  - Ensure you have proper permissions"
    echo "  - Manually remove components using system package manager"
    echo
    echo "======================================================"
    echo
    read -p "Press Enter to return to main menu..."
    show_menu
}

operation_complete() {
    echo
    echo "======================================================"
    colored_echo "[COMPLETE] Uninstallation operation finished!"
    echo "======================================================"
    echo
    colored_echo "[INFO] Recommendations:"
    echo "  - Restart your terminal to ensure PATH changes take effect"
    echo "  - Check your system package manager for any remaining components"
    echo "  - Clear browser cache if you used the web application"
    echo
    read -p "Press Enter to return to main menu..."
    show_menu
}

# Uninstall functions for different components
uninstall_app_only() {
    colored_echo "[?] Checking for application installation..."
    
    if [ -f "package.json" ] && [ -f "server.js" ]; then
        colored_echo "[SETUP] Removing OneClick Subtitles Generator application..."
        
        # Clean node_modules
        if [ -d "node_modules" ]; then
            colored_echo "[SETUP] Removing node_modules..."
            rm -rf node_modules
        fi

        # Clean Python virtual environment
        if [ -d ".venv" ]; then
            colored_echo "[SETUP] Removing Python virtual environment..."
            rm -rf .venv
        fi

        # Clean F5-TTS directory
        if [ -d "F5-TTS" ]; then
            colored_echo "[SETUP] Removing F5-TTS directory..."
            rm -rf F5-TTS
        fi

        # Clean Chatterbox directory
        if [ -d "chatterbox/chatterbox" ]; then
            colored_echo "[SETUP] Removing Chatterbox directory..."
            rm -rf chatterbox/chatterbox
        fi

        # Clean package-lock.json
        if [ -f "package-lock.json" ]; then
            colored_echo "[SETUP] Removing package-lock.json..."
            rm -f package-lock.json
        fi

        # Clean other generated files
        if [ -f "yarn.lock" ]; then
            rm -f yarn.lock
        fi

        colored_echo "[OK] Application components removed successfully."
    else
        colored_echo "[INFO] Application not found in current directory - may already be uninstalled."
    fi
}

uninstall_git() {
    colored_echo "[?] Checking for Git installation..."
    
    if command -v git &> /dev/null; then
        colored_echo "[SETUP] Uninstalling Git..."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew uninstall git >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    colored_echo "[OK] Git uninstalled successfully via Homebrew."
                else
                    colored_echo "[WARN] Could not uninstall Git via Homebrew. It may be a system installation."
                fi
            else
                colored_echo "[WARN] Git appears to be a system installation. Cannot uninstall automatically."
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            if command -v apt &> /dev/null; then
                sudo apt remove --purge -y git >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    colored_echo "[OK] Git uninstalled successfully via apt."
                else
                    colored_echo "[WARN] Could not uninstall Git via apt."
                fi
            elif command -v yum &> /dev/null; then
                sudo yum remove -y git >/dev/null 2>&1
                colored_echo "[OK] Git uninstalled successfully via yum."
            elif command -v dnf &> /dev/null; then
                sudo dnf remove -y git >/dev/null 2>&1
                colored_echo "[OK] Git uninstalled successfully via dnf."
            else
                colored_echo "[WARN] Could not determine package manager to uninstall Git."
            fi
        fi
    else
        colored_echo "[INFO] Git not found - may already be uninstalled."
    fi
}

uninstall_nodejs() {
    colored_echo "[?] Checking for Node.js installation..."
    
    if command -v node &> /dev/null; then
        colored_echo "[SETUP] Uninstalling Node.js..."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew uninstall node >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    colored_echo "[OK] Node.js uninstalled successfully via Homebrew."
                else
                    colored_echo "[WARN] Could not uninstall Node.js via Homebrew."
                fi
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            if command -v apt &> /dev/null; then
                sudo apt remove --purge -y nodejs npm >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    colored_echo "[OK] Node.js uninstalled successfully via apt."
                else
                    colored_echo "[WARN] Could not uninstall Node.js via apt."
                fi
            elif command -v yum &> /dev/null; then
                sudo yum remove -y nodejs npm >/dev/null 2>&1
                colored_echo "[OK] Node.js uninstalled successfully via yum."
            elif command -v dnf &> /dev/null; then
                sudo dnf remove -y nodejs npm >/dev/null 2>&1
                colored_echo "[OK] Node.js uninstalled successfully via dnf."
            fi
        fi
        
        # Remove global npm packages directory
        if [ -d "$HOME/.npm" ]; then
            colored_echo "[SETUP] Removing global npm packages..."
            rm -rf "$HOME/.npm"
        fi
        
        # Remove node_modules cache
        if [ -d "$HOME/.cache/npm" ]; then
            rm -rf "$HOME/.cache/npm"
        fi
        
    else
        colored_echo "[INFO] Node.js not found - may already be uninstalled."
    fi
}

uninstall_ffmpeg() {
    colored_echo "[?] Checking for FFmpeg installation..."
    
    if command -v ffmpeg &> /dev/null; then
        colored_echo "[SETUP] Uninstalling FFmpeg..."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew uninstall ffmpeg >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    colored_echo "[OK] FFmpeg uninstalled successfully via Homebrew."
                else
                    colored_echo "[WARN] Could not uninstall FFmpeg via Homebrew."
                fi
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            if command -v apt &> /dev/null; then
                sudo apt remove --purge -y ffmpeg >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    colored_echo "[OK] FFmpeg uninstalled successfully via apt."
                else
                    colored_echo "[WARN] Could not uninstall FFmpeg via apt."
                fi
            elif command -v yum &> /dev/null; then
                sudo yum remove -y ffmpeg >/dev/null 2>&1
                colored_echo "[OK] FFmpeg uninstalled successfully via yum."
            elif command -v dnf &> /dev/null; then
                sudo dnf remove -y ffmpeg >/dev/null 2>&1
                colored_echo "[OK] FFmpeg uninstalled successfully via dnf."
            fi
        fi
    else
        colored_echo "[INFO] FFmpeg not found - may already be uninstalled."
    fi
}

uninstall_uv() {
    colored_echo "[?] Checking for uv installation..."
    
    if command -v uv &> /dev/null; then
        colored_echo "[SETUP] Uninstalling uv Python package manager..."
        
        # Remove uv binary
        if [ -f "$HOME/.cargo/bin/uv" ]; then
            rm -f "$HOME/.cargo/bin/uv"
        fi
        
        if [ -f "$HOME/.local/bin/uv" ]; then
            rm -f "$HOME/.local/bin/uv"
        fi
        
        # Remove uv cache and data directories
        if [ -d "$HOME/.cache/uv" ]; then
            rm -rf "$HOME/.cache/uv"
        fi
        
        if [ -d "$HOME/.local/share/uv" ]; then
            rm -rf "$HOME/.local/share/uv"
        fi
        
        colored_echo "[OK] uv uninstalled successfully."
        colored_echo "[INFO] You may need to restart your terminal for PATH changes to take effect."
    else
        colored_echo "[INFO] uv not found - may already be uninstalled."
    fi
}

uninstall_homebrew() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        colored_echo "[?] Checking for Homebrew installation..."

        if command -v brew &> /dev/null; then
            colored_echo "[SETUP] Uninstalling Homebrew package manager..."
            colored_echo "[WARN] This will remove Homebrew and all packages installed through it!"

            # Official Homebrew uninstall script
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)" >/dev/null 2>&1

            if [ $? -eq 0 ]; then
                colored_echo "[OK] Homebrew uninstalled successfully."
            else
                colored_echo "[WARN] Homebrew uninstallation may have had issues."
            fi

            # Clean up remaining directories
            if [ -d "/opt/homebrew" ]; then
                sudo rm -rf /opt/homebrew >/dev/null 2>&1
            fi

            if [ -d "/usr/local/Homebrew" ]; then
                sudo rm -rf /usr/local/Homebrew >/dev/null 2>&1
            fi

            colored_echo "[INFO] You may need to restart your terminal for PATH changes to take effect."
        else
            colored_echo "[INFO] Homebrew not found - may already be uninstalled."
        fi
    else
        colored_echo "[INFO] Homebrew is only available on macOS."
    fi
}

# --- Main Menu ---
show_menu() {
    clear
    echo
    # Display the new Unicode ASCII logo with red gradient (warning colors)
    echo -e "     \033[38;2;255;200;200m███████████╗\033[38;2;255;180;180m░░░░\033[38;2;255;160;160m███████████╗\033[38;2;255;140;140m░░░░\033[38;2;255;120;120m███████████╗\033[0m"
    echo -e "  \033[38;2;255;190;190m█████████████████╗\033[38;2;255;170;170m░░\033[38;2;255;150;150m█████████████╗\033[38;2;255;130;130m░░\033[38;2;255;110;110m████████████╗\033[0m"
    echo -e " \033[38;2;255;180;180m████╔══════════████╗\033[38;2;255;160;160m░░\033[38;2;255;140;140m██╔═════════╝\033[38;2;255;120;120m░░░\033[38;2;255;100;100m██╔════════╝\033[38;2;255;80;80m░\033[0m"
    echo
    echo -e "\033[91m======================================================\033[0m"
    echo -e "\033[97m\033[41mGo Cai Dat Toan Bo OneClick Subtitles Generator\033[0m"
    echo -e "\033[90mVi tri (Location): $(pwd)\033[0m"
    echo -e "\033[90mThu muc Du an (Project Folder): $PROJECT_FOLDER_NAME\033[0m"
    echo -e "\033[91m======================================================\033[0m"
    echo -e "\033[93mCANH BAO: Cac tuy chon nay se go cai dat cac cong cu khoi he thong!\033[0m"
    echo
    echo -e "\033[91m\033[40mGO CAI DAT UNG DUNG:\033[0m"
    echo -e "\033[97m  1. Go cai dat chi Ung dung (Uninstall App Only)\033[0m"
    echo -e "\033[96m     (Chi xoa thu muc du an, giu lai cac cong cu he thong)\033[0m"
    echo
    echo -e "\033[31m\033[40mGO CAI DAT TOAN BO:\033[0m"
    echo -e "\033[97m  2. Go cai dat Tat ca (Uninstall Everything)\033[0m"
    echo -e "\033[93m     (Xoa ung dung + Git + Node.js + FFmpeg + uv + Package Manager)\033[0m"
    echo -e "\033[97m  3. Go cai dat chi cac Cong cu (Uninstall Tools Only)\033[0m"
    echo -e "\033[93m     (Chi xoa Git + Node.js + FFmpeg + uv + Package Manager, giu lai ung dung)\033[0m"
    echo
    echo -e "\033[95m\033[40mGO CAI DAT RIENG LE:\033[0m"
    echo -e "\033[97m  4. Go cai dat Git\033[0m"
    echo -e "\033[97m  5. Go cai dat Node.js\033[0m"
    echo -e "\033[97m  6. Go cai dat FFmpeg\033[0m"
    echo -e "\033[97m  7. Go cai dat uv Python Package Manager\033[0m"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "\033[97m  8. Go cai dat Homebrew\033[0m"
    fi
    echo
    echo -e "\033[90m  9. Thoat (Exit)\033[0m"
    echo -e "\033[91m======================================================\033[0m"
    echo

    echo -ne "\033[93mNhap lua chon cua ban (1-9): \033[0m"
    read choice

    case $choice in
        1) uninstall_app_only_menu ;;
        2) uninstall_everything_menu ;;
        3) uninstall_tools_only_menu ;;
        4) uninstall_git_menu ;;
        5) uninstall_nodejs_menu ;;
        6) uninstall_ffmpeg_menu ;;
        7) uninstall_uv_menu ;;
        8)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                uninstall_homebrew_menu
            else
                echo -e "\033[91m[ERROR] Lua chon khong hop le. Vui long thu lai.\033[0m"
                sleep 2
                show_menu
            fi
            ;;
        9) exit 0 ;;
        *)
            echo -e "\033[91m[ERROR] Lua chon khong hop le. Vui long thu lai.\033[0m"
            sleep 2
            show_menu
            ;;
    esac
}

# Menu functions
uninstall_app_only_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 1: Uninstall App Only"
    echo "======================================================"
    echo

    colored_echo "[WARN] This will permanently delete the application components:"
    echo "  - node_modules directory"
    echo "  - Python virtual environment (.venv)"
    echo "  - F5-TTS directory"
    echo "  - Chatterbox directory"
    echo "  - Package lock files"
    echo
    read -p "Ban co chac chan muon xoa cac thanh phan ung dung? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        colored_echo "[INFO] Operation cancelled."
        show_menu
        return
    fi

    uninstall_app_only
    operation_complete
}

uninstall_everything_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 2: Uninstall Everything"
    echo "======================================================"
    echo

    colored_echo "[WARN] This will remove ALL components:"
    echo "  - OneClick Subtitles Generator Application"
    echo "  - Git version control"
    echo "  - Node.js runtime"
    echo "  - FFmpeg media processor"
    echo "  - uv Python package manager"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  - Homebrew package manager"
    fi
    echo
    read -p "Ban co THUC SU chac chan muon go cai dat tat ca? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        colored_echo "[INFO] Operation cancelled."
        show_menu
        return
    fi

    uninstall_app_only
    uninstall_git
    uninstall_nodejs
    uninstall_ffmpeg
    uninstall_uv
    if [[ "$OSTYPE" == "darwin"* ]]; then
        uninstall_homebrew
    fi

    colored_echo "[OK] Complete uninstallation finished!"
    operation_complete
}

uninstall_tools_only_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 3: Uninstall Tools Only"
    echo "======================================================"
    echo

    colored_echo "[WARN] This will remove development tools but keep the application:"
    echo "  - Git version control"
    echo "  - Node.js runtime"
    echo "  - FFmpeg media processor"
    echo "  - uv Python package manager"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  - Homebrew package manager"
    fi
    echo
    read -p "Ban co chac chan muon go cai dat cac cong cu? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        colored_echo "[INFO] Operation cancelled."
        show_menu
        return
    fi

    uninstall_git
    uninstall_nodejs
    uninstall_ffmpeg
    uninstall_uv
    if [[ "$OSTYPE" == "darwin"* ]]; then
        uninstall_homebrew
    fi

    colored_echo "[OK] Development tools uninstalled successfully!"
    operation_complete
}

uninstall_git_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 4: Uninstall Git"
    echo "======================================================"
    echo

    uninstall_git
    operation_complete
}

uninstall_nodejs_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 5: Uninstall Node.js"
    echo "======================================================"
    echo

    uninstall_nodejs
    operation_complete
}

uninstall_ffmpeg_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 6: Uninstall FFmpeg"
    echo "======================================================"
    echo

    uninstall_ffmpeg
    operation_complete
}

uninstall_uv_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 7: Uninstall uv Python Package Manager"
    echo "======================================================"
    echo

    uninstall_uv
    operation_complete
}

uninstall_homebrew_menu() {
    echo
    echo "======================================================"
    colored_echo "[UNINSTALL] Option 8: Uninstall Homebrew"
    echo "======================================================"
    echo

    colored_echo "[WARN] This will remove Homebrew and ALL packages installed through it!"
    read -p "Ban co chac chan muon go cai dat Homebrew? (y/n): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        colored_echo "[INFO] Operation cancelled."
        show_menu
        return
    fi

    uninstall_homebrew
    operation_complete
}

# --- Start the script ---
# Make script executable
chmod +x "$0" 2>/dev/null || true

# Check for sudo privileges (for Linux package removal)
check_sudo_privileges() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        colored_echo "[?] Checking sudo privileges..."
        if ! sudo -n true 2>/dev/null; then
            echo
            echo -e "\033[91m======================================================\033[0m"
            colored_echo "[INFO] This script requires sudo privileges for package removal on Linux."
            colored_echo "[INFO] You will be prompted to enter your password for system package removal."
            colored_echo "[INFO] This is needed to remove: Git, Node.js, FFmpeg, and system dependencies."
            echo -e "\033[91m======================================================\033[0m"
            echo
            colored_echo "[SETUP] Requesting sudo privileges..."
            sudo -v
            if [ $? -ne 0 ]; then
                colored_echo "[ERROR] Sudo privileges required but not granted. Exiting."
                exit 1
            fi
        fi
        colored_echo "[OK] Sudo privileges confirmed."
        echo
    fi
}

# Check sudo privileges
check_sudo_privileges

# Show initial information
echo
colored_echo "[UNINSTALL] OneClick Subtitles Generator - Complete Uninstaller"
echo -e "\033[91m==============================================\033[0m"
echo
colored_echo "[INFO] This script will help you remove OneClick Subtitles Generator"
colored_echo "[INFO] and all its prerequisites from your system."
echo
colored_echo "[WARN] Please read each option carefully before proceeding."
colored_echo "[WARN] Some operations cannot be easily undone."
echo

# Show the menu
show_menu
