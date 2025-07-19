#!/usr/bin/env python3

print("Testing Chatterbox installation...")

try:
    import torch
    print(f"✅ PyTorch version: {torch.__version__}")
    print(f"✅ CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"✅ CUDA version: {torch.version.cuda}")
        print(f"✅ GPU device: {torch.cuda.get_device_name(0)}")
    else:
        print("❌ CUDA not available")
except Exception as e:
    print(f"❌ PyTorch import failed: {e}")

print("\n" + "="*50)

try:
    import chatterbox
    print("✅ Chatterbox package imported successfully")
    
    try:
        from chatterbox.tts import ChatterboxTTS
        print("✅ ChatterboxTTS class imported successfully")
        
        # Test device detection
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"✅ Using device: {device}")
        
        # Try to create a model instance (this might fail if models aren't downloaded)
        try:
            print("🔄 Attempting to create ChatterboxTTS instance...")
            model = ChatterboxTTS.from_pretrained(device=device)
            print("✅ ChatterboxTTS model created successfully!")
        except Exception as model_e:
            print(f"⚠️  ChatterboxTTS model creation failed: {model_e}")
            print("   This might be due to missing model files, but the import works.")
            
    except Exception as tts_e:
        print(f"❌ ChatterboxTTS import failed: {tts_e}")
        
except Exception as e:
    print(f"❌ Chatterbox import failed: {e}")
    print("   This suggests Chatterbox is not properly installed.")

print("\n" + "="*50)

# Check if the conditionals file exists
import os
conds_path = "models/chatterbox_weights/conds.pt"
if os.path.exists(conds_path):
    print(f"✅ Conditionals file found: {conds_path}")
else:
    print(f"❌ Conditionals file missing: {conds_path}")
    print("   This could cause the 'NoneType' error you're seeing.")

print("\nTest completed.")
