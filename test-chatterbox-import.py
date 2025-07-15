#!/usr/bin/env python3
"""
Test script to verify that chatterbox modules can be imported correctly
This helps debug import path issues before starting the full service
"""

import sys
import os
from pathlib import Path

print("🧪 Testing Chatterbox module imports...")
print("─" * 50)

# Print Python and environment info
print(f"🐍 Python executable: {sys.executable}")
print(f"📁 Current working directory: {os.getcwd()}")
print(f"📦 Python path:")
for path in sys.path:
    print(f"   - {path}")
print()

# Test basic imports
try:
    print("🔍 Testing basic imports...")
    import torch
    print(f"✅ PyTorch: {torch.__version__}")
    
    import fastapi
    print(f"✅ FastAPI: {fastapi.__version__}")
    
    import uvicorn
    print(f"✅ Uvicorn: {uvicorn.__version__}")
    
except ImportError as e:
    print(f"❌ Basic import failed: {e}")
    sys.exit(1)

print()

# Test chatterbox imports
try:
    print("🔍 Testing chatterbox imports...")
    
    # Try to import the main chatterbox modules
    from chatterbox.tts import ChatterboxTTS
    print("✅ Successfully imported ChatterboxTTS")
    
    from chatterbox.vc import ChatterboxVC
    print("✅ Successfully imported ChatterboxVC")
    
    # Try to create instances (this will test if dependencies are properly installed)
    print("\n🔍 Testing chatterbox initialization...")
    
    # Note: We don't actually initialize because it requires models
    # but we can check if the classes are properly defined
    print(f"✅ ChatterboxTTS class: {ChatterboxTTS}")
    print(f"✅ ChatterboxVC class: {ChatterboxVC}")
    
    print("\n✅ All chatterbox imports successful!")
    
except ImportError as e:
    print(f"❌ Chatterbox import failed: {e}")
    print("\n🔍 Debugging information:")
    
    # Check if chatterbox package is installed
    try:
        import pkg_resources
        installed_packages = [d.project_name for d in pkg_resources.working_set]
        chatterbox_packages = [pkg for pkg in installed_packages if 'chatterbox' in pkg.lower()]
        print(f"📦 Chatterbox-related packages found: {chatterbox_packages}")
    except:
        print("📦 Could not check installed packages")
    
    # Check if the chatterbox directory exists
    chatterbox_dir = Path("chatterbox/chatterbox")
    if chatterbox_dir.exists():
        print(f"📁 Chatterbox directory exists: {chatterbox_dir.absolute()}")
        src_dir = chatterbox_dir / "src"
        if src_dir.exists():
            print(f"📁 Source directory exists: {src_dir.absolute()}")
            chatterbox_src = src_dir / "chatterbox"
            if chatterbox_src.exists():
                print(f"📁 Chatterbox source exists: {chatterbox_src.absolute()}")
                files = list(chatterbox_src.glob("*.py"))
                print(f"📄 Python files found: {[f.name for f in files]}")
            else:
                print(f"❌ Chatterbox source directory not found: {chatterbox_src.absolute()}")
        else:
            print(f"❌ Source directory not found: {src_dir.absolute()}")
    else:
        print(f"❌ Chatterbox directory not found: {chatterbox_dir.absolute()}")
    
    print("\n💡 Possible solutions:")
    print("   1. Run the setup script: npm run setup:narration")
    print("   2. Check if the virtual environment is activated")
    print("   3. Verify chatterbox package installation: uv pip list | grep chatterbox")
    
    sys.exit(1)

except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n🎉 All tests passed! Chatterbox should be able to start successfully.")
