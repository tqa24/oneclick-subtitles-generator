#!/usr/bin/env python3
"""
Debug script to analyze the reference audio files and understand why Chatterbox is failing
"""

import os
import sys
import librosa
import numpy as np
import soundfile as sf
import tempfile

def analyze_audio_file(file_path):
    """Analyze an audio file for Chatterbox compatibility"""
    print(f"\n🔍 Analyzing: {os.path.basename(file_path)}")
    print(f"   Full path: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"❌ File does not exist!")
        return False
    
    try:
        # Load audio file
        audio_data, sample_rate = librosa.load(file_path, sr=None)
        
        print(f"📊 Basic Properties:")
        print(f"   Sample rate: {sample_rate} Hz")
        print(f"   Duration: {len(audio_data) / sample_rate:.2f} seconds")
        print(f"   Samples: {len(audio_data)}")
        print(f"   File size: {os.path.getsize(file_path)} bytes")
        print(f"   Min value: {np.min(audio_data):.4f}")
        print(f"   Max value: {np.max(audio_data):.4f}")
        print(f"   RMS: {np.sqrt(np.mean(audio_data**2)):.4f}")
        
        # Check for common issues
        issues = []
        
        # Duration check
        duration = len(audio_data) / sample_rate
        if duration < 0.5:
            issues.append(f"Too short ({duration:.2f}s < 0.5s)")
        elif duration > 30:
            issues.append(f"Too long ({duration:.2f}s > 30s)")
        
        # Sample rate check
        if sample_rate != 22050:
            issues.append(f"Wrong sample rate ({sample_rate} Hz != 22050 Hz)")
        
        # Amplitude check
        max_amp = np.max(np.abs(audio_data))
        if max_amp < 0.01:
            issues.append(f"Too quiet (max amplitude: {max_amp:.4f})")
        elif max_amp > 0.99:
            issues.append(f"Clipped (max amplitude: {max_amp:.4f})")
        
        # Silence check
        if np.all(np.abs(audio_data) < 0.001):
            issues.append("Audio appears to be silent")
        
        # NaN/Inf check
        if np.any(np.isnan(audio_data)):
            issues.append("Contains NaN values")
        if np.any(np.isinf(audio_data)):
            issues.append("Contains infinite values")
        
        if issues:
            print(f"⚠️  Issues found:")
            for issue in issues:
                print(f"     - {issue}")
        else:
            print(f"✅ No obvious issues detected")
        
        # Create a resampled version for testing
        if sample_rate != 22050:
            print(f"🔄 Creating 22050 Hz version for testing...")
            resampled_audio = librosa.resample(audio_data, orig_sr=sample_rate, target_sr=22050)
            
            # Save resampled version
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            resampled_path = f"{base_name}_22050hz.wav"
            sf.write(resampled_path, resampled_audio, 22050)
            print(f"   Saved resampled version: {resampled_path}")
            
            # Analyze resampled version
            print(f"📊 Resampled Properties:")
            print(f"   Duration: {len(resampled_audio) / 22050:.2f} seconds")
            print(f"   Samples: {len(resampled_audio)}")
            print(f"   RMS: {np.sqrt(np.mean(resampled_audio**2)):.4f}")
            
            return resampled_path
        
        return file_path
        
    except Exception as e:
        print(f"❌ Error analyzing file: {e}")
        return False

def test_chatterbox_with_file(file_path):
    """Test if Chatterbox can process this file"""
    print(f"\n🧪 Testing Chatterbox processing with: {os.path.basename(file_path)}")
    
    try:
        # Import Chatterbox
        from chatterbox.tts import ChatterboxTTS
        
        print("📥 Loading Chatterbox TTS model...")
        device = "cuda" if __name__ == "__main__" else "cpu"  # Use CPU for safety in debug
        tts_model = ChatterboxTTS.from_pretrained(device)
        
        if tts_model.conds is None:
            print("⚠️  No default conditionals loaded")
        else:
            print("✅ Default conditionals loaded")
        
        print("🎯 Testing reference audio processing...")
        
        # Try to prepare conditionals with this file
        try:
            tts_model.prepare_conditionals(file_path, exaggeration=0.5)
            print("✅ Reference audio processed successfully!")
            
            # Try a simple generation
            print("🎤 Testing speech generation...")
            wav = tts_model.generate(
                text="This is a test.",
                audio_prompt_path=file_path,
                exaggeration=0.5,
                cfg_weight=0.5,
                temperature=0.8
            )
            print(f"✅ Speech generation successful! Output shape: {wav.shape}")
            
            # Save test output
            output_path = f"test_output_{os.path.splitext(os.path.basename(file_path))[0]}.wav"
            sf.write(output_path, wav.cpu().numpy(), tts_model.sr)
            print(f"💾 Test output saved: {output_path}")
            
            return True
            
        except Exception as e:
            print(f"❌ Reference audio processing failed: {e}")
            print(f"   Error type: {type(e).__name__}")
            
            # Check if it's the specific mel length error
            if "Reference mel length is not equal to 2 * reference token length" in str(e):
                print("🎯 This is the exact error we're trying to fix!")
                print("   The reference audio is causing mel/token length mismatch")
            
            return False
            
    except Exception as e:
        print(f"❌ Chatterbox test failed: {e}")
        return False

def main():
    """Main debug function"""
    print("🔧 Debug: Reference Audio Issue Analysis")
    print("=" * 60)
    
    # Find reference audio files
    ref_dir = "narration/reference"
    if not os.path.exists(ref_dir):
        print(f"❌ Reference directory not found: {ref_dir}")
        return
    
    wav_files = [f for f in os.listdir(ref_dir) if f.endswith('.wav')]
    if not wav_files:
        print(f"❌ No .wav files found in {ref_dir}")
        return
    
    print(f"📁 Found {len(wav_files)} reference audio files:")
    for f in wav_files:
        print(f"   - {f}")
    
    # Analyze each file
    processed_files = []
    for wav_file in wav_files:
        file_path = os.path.join(ref_dir, wav_file)
        result = analyze_audio_file(file_path)
        if result:
            processed_files.append(result)
    
    # Test with Chatterbox if we have processed files
    if processed_files:
        print(f"\n🧪 Testing with Chatterbox...")
        for file_path in processed_files[:1]:  # Test only the first one to save time
            success = test_chatterbox_with_file(file_path)
            if success:
                print(f"✅ File works with Chatterbox: {os.path.basename(file_path)}")
                break
            else:
                print(f"❌ File fails with Chatterbox: {os.path.basename(file_path)}")
    
    print(f"\n📋 Summary:")
    print(f"   - Analyzed {len(wav_files)} reference audio files")
    print(f"   - Processed {len(processed_files)} files successfully")
    print(f"   - Check the output above for specific issues and solutions")

if __name__ == "__main__":
    main()
