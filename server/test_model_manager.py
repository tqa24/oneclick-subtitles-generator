"""
Test script to verify the model_manager package works correctly.
"""
import sys
import os

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Try to import from model_manager
try:
    from model_manager import (
        get_models, get_active_model, set_active_model, add_model, delete_model,
        download_model_from_hf, download_model_from_url, parse_hf_url,
        get_download_status, update_download_status, remove_download_status,
        update_model_info, is_model_using_symlinks, initialize_registry, cancel_download
    )
    print("Successfully imported all functions from model_manager package!")
    
    # Test a basic function
    models = get_models()
    print(f"Found {len(models.get('models', []))} models in the registry.")
    print(f"Active model: {models.get('active_model')}")
    
except ImportError as e:
    print(f"Error importing from model_manager package: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error testing model_manager package: {e}")
    sys.exit(1)

print("All tests passed successfully!")
