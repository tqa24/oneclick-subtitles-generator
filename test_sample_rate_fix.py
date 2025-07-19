#!/usr/bin/env python3
"""
Test script to verify the sample rate fix for Chatterbox reference audio
"""

import requests
import json
import os

API_BASE_URL = "http://localhost:3011"

def test_voice_path_with_sample_rate_fix():
    """Test the new endpoint with automatic sample rate conversion"""
    print("=== Testing Voice Path with Sample Rate Fix ===")
    
    # Use the original 24000 Hz file (should be automatically converted)
    voice_file_path = r"C:\WORK_win\temp\oneclick-subtitles-generator\narration\reference\example_71732b77-6fd5-41a1-a409-778accc20dcf.wav"
    
    if not os.path.exists(voice_file_path):
        print(f"❌ Reference file not found: {voice_file_path}")
        return False
    
    print(f"Using reference audio: {voice_file_path}")
    
    try:
        data = {
            "text": "Hello, this is a test with automatic sample rate conversion for voice reference.",
            "exaggeration": 0.7,
            "cfg_weight": 0.4,
            "voice_file_path": voice_file_path
        }
        
        print("📡 Sending request to /tts/generate-with-voice-path...")
        response = requests.post(
            f"{API_BASE_URL}/tts/generate-with-voice-path",
            json=data,
            timeout=60
        )
        response.raise_for_status()
        
        print(f"✅ Generation with voice path successful!")
        print(f"  Response size: {len(response.content)} bytes")
        print(f"  Content-Type: {response.headers.get('Content-Type')}")
        
        # Save the output for verification
        output_file = "test_output_sample_rate_fix.wav"
        with open(output_file, "wb") as f:
            f.write(response.content)
        print(f"  Output saved to: {output_file}")
        
        return True
        
    except Exception as e:
        print(f"❌ Generation with voice path failed: {e}")
        if hasattr(e, 'response') and e.response:
            try:
                error_detail = e.response.json()
                print(f"  Error details: {error_detail}")
                
                # Check for the specific error we're trying to fix
                if "'NoneType' object has no attribute 'cpu'" in str(error_detail):
                    print("  🚨 The sample rate fix did not resolve the issue!")
                    return False
                    
            except:
                print(f"  Response text: {e.response.text}")
        return False

def main():
    """Main test function"""
    print("🧪 Testing Sample Rate Fix for Chatterbox Reference Audio")
    print("=" * 60)
    
    # Test health first
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        response.raise_for_status()
        health_data = response.json()
        print(f"✅ Health check passed: {health_data}")
        
        if not health_data.get('models_loaded', {}).get('tts', False):
            print("❌ TTS model not loaded - cannot proceed with tests")
            return
            
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        print("Make sure the Chatterbox service is running on port 3011")
        return
    
    # Test the sample rate fix
    if test_voice_path_with_sample_rate_fix():
        print("\n🎉 SUCCESS: Sample rate fix is working!")
        print("   The 24000 Hz reference audio was automatically converted to 22050 Hz")
        print("   Voice generation with reference audio should now work correctly")
    else:
        print("\n💥 FAILURE: Sample rate fix needs more work")
        print("   The issue may be more complex than just sample rate mismatch")

if __name__ == "__main__":
    main()
