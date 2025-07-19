#!/usr/bin/env python3
"""
Test script for Chatterbox API with reference audio.
Tests both basic TTS and TTS with reference voice.
"""

import requests
import os
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:3011"
REFERENCE_AUDIO = "test_reference_audio.wav"
TEST_TEXT = "Hello! This is a test of the Chatterbox TTS API using a reference voice. The voice should sound similar to the reference audio provided."

def test_health():
    """Test API health endpoint."""
    print("Testing API health...")
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        response.raise_for_status()
        health_data = response.json()
        print(f"✓ API is healthy: {health_data}")
        return True
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False



def test_tts_generation():
    """Test TTS generation with reference audio file (required)."""
    print(f"\nTesting TTS generation with reference audio: {REFERENCE_AUDIO}")

    # Check if reference file exists
    if not Path(REFERENCE_AUDIO).exists():
        print(f"✗ Reference audio file not found: {REFERENCE_AUDIO}")
        return False

    try:
        # Prepare multipart form data
        files = {
            'voice_file': (REFERENCE_AUDIO, open(REFERENCE_AUDIO, 'rb'), 'audio/wav')
        }
        data = {
            'text': TEST_TEXT,
            'exaggeration': '0.7',
            'cfg_weight': '0.4'
        }

        response = requests.post(
            f"{API_BASE_URL}/tts/generate",
            files=files,
            data=data
        )
        response.raise_for_status()

        # Save the output
        output_file = "test_output_generated.wav"
        with open(output_file, "wb") as f:
            f.write(response.content)

        print(f"✓ TTS generation successful! Output saved to: {output_file}")
        print(f"  Response headers: {dict(response.headers)}")

        # Close the file
        files['voice_file'][1].close()
        return True

    except Exception as e:
        print(f"✗ TTS generation failed: {e}")
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("Chatterbox API Test - Reference Audio Required")
    print("=" * 60)

    # Test sequence
    tests = [
        ("Health Check", test_health),
        ("TTS Generation", test_tts_generation)
    ]
    
    results = []
    for test_name, test_func in tests:
        success = test_func()
        results.append((test_name, success))
        
        if not success and test_name == "Health Check":
            print("\n✗ API is not responding. Make sure the API server is running.")
            break
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Results Summary:")
    print("=" * 60)
    
    for test_name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{test_name:20} : {status}")
    
    total_tests = len(results)
    passed_tests = sum(1 for _, success in results if success)
    
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()
