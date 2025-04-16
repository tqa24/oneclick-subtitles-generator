import os
import sys
import subprocess
import platform

def install_pytorch_cuda():
    print("Installing PyTorch with CUDA support...")
    
    # Determine the OS
    os_name = platform.system()
    print(f"Operating System: {os_name}")
    
    # Determine the CUDA version
    try:
        # Try to get CUDA version from nvcc
        result = subprocess.run(['nvcc', '--version'], capture_output=True, text=True)
        cuda_version = None
        
        if result.returncode == 0:
            for line in result.stdout.split('\n'):
                if 'release' in line and 'V' in line:
                    # Extract version like 11.7 from "release 11.7, V11.7.99"
                    parts = line.split('release ')[1].split(',')[0].strip()
                    cuda_version = parts
                    break
        
        if cuda_version:
            print(f"Detected CUDA version: {cuda_version}")
        else:
            print("Could not detect CUDA version from nvcc")
            
            # Try to get CUDA version from nvidia-smi
            result = subprocess.run(['nvidia-smi'], capture_output=True, text=True)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'CUDA Version:' in line:
                        cuda_version = line.split('CUDA Version:')[1].strip()
                        print(f"Detected CUDA version from nvidia-smi: {cuda_version}")
                        break
    
    except Exception as e:
        print(f"Error detecting CUDA version: {e}")
        cuda_version = None
    
    # If we couldn't detect CUDA version, ask the user
    if not cuda_version:
        print("Could not automatically detect CUDA version.")
        print("Common CUDA versions are: 11.8, 12.1")
        cuda_version = input("Please enter your CUDA version (e.g., 11.8): ")
    
    # Determine the PyTorch installation command based on CUDA version
    if cuda_version.startswith('11'):
        # For CUDA 11.x
        cmd = [
            sys.executable, '-m', 'pip', 'install', 
            'torch', 'torchvision', 'torchaudio', 
            '--index-url', 'https://download.pytorch.org/whl/cu118'
        ]
    elif cuda_version.startswith('12'):
        # For CUDA 12.x
        cmd = [
            sys.executable, '-m', 'pip', 'install', 
            'torch', 'torchvision', 'torchaudio'
        ]
    else:
        print(f"Unsupported CUDA version: {cuda_version}")
        print("Please install PyTorch manually following instructions at https://pytorch.org/get-started/locally/")
        return False
    
    print(f"Running command: {' '.join(cmd)}")
    
    # Run the installation command
    try:
        subprocess.run(cmd, check=True)
        print("PyTorch with CUDA support installed successfully!")
        
        # Verify the installation
        import torch
        print(f"PyTorch version: {torch.__version__}")
        print(f"CUDA available: {torch.cuda.is_available()}")
        
        if torch.cuda.is_available():
            print(f"CUDA device count: {torch.cuda.device_count()}")
            print(f"CUDA device name: {torch.cuda.get_device_name(0)}")
            return True
        else:
            print("CUDA is still not available after installation.")
            return False
    
    except Exception as e:
        print(f"Error installing PyTorch: {e}")
        return False

if __name__ == "__main__":
    success = install_pytorch_cuda()
    sys.exit(0 if success else 1)
