/**
 * Test stronger conversion for audio waveform processing compatibility
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');

async function strongerConversion(inputPath, outputPath) {
  console.log('🔧 Applying stronger conversion for waveform compatibility...\n');
  
  const ffmpegCmd = [
    'ffmpeg',
    '-i', `"${inputPath}"`,
    '-y',
    
    // Video settings - standard H.264 baseline for maximum compatibility
    '-c:v', 'libx264',
    '-profile:v', 'baseline',  // Most compatible profile
    '-level', '3.0',           // Compatible level
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', '30',                // Force exactly 30 fps
    
    // Audio settings - maximize waveform processing compatibility
    '-c:a', 'aac',
    '-strict', 'experimental',  // Use FFmpeg's built-in AAC
    '-b:a', '192k',            // Higher bitrate for better quality
    '-ar', '48000',            // 48kHz - more standard for video
    '-ac', '2',                // Stereo
    '-af', 'aformat=channel_layouts=stereo,aresample=48000', // Force audio format
    
    // Container settings
    '-movflags', '+faststart',
    '-fflags', '+genpts',      // Generate presentation timestamps
    '-avoid_negative_ts', 'make_zero',  // Fix timestamp issues
    
    // Metadata cleanup
    '-map_metadata', '-1',     // Remove all metadata
    '-metadata:s:a:0', 'language=eng',  // Set audio language
    '-metadata:s:v:0', 'language=eng',  // Set video language
    
    `"${outputPath}"`
  ].join(' ');
  
  try {
    console.log('Running stronger conversion...');
    console.log('Command:', ffmpegCmd);
    
    const { stdout, stderr } = await execPromise(ffmpegCmd, {
      maxBuffer: 20 * 1024 * 1024
    });
    
    console.log('✅ Conversion completed!');
    
    // Analyze the output
    const analyzeCmd = `ffprobe -v quiet -print_format json -show_streams "${outputPath}"`;
    const { stdout: analysis } = await execPromise(analyzeCmd);
    const data = JSON.parse(analysis);
    
    const videoStream = data.streams.find(s => s.codec_type === 'video');
    const audioStream = data.streams.find(s => s.codec_type === 'audio');
    
    console.log('\n📊 Output file analysis:');
    console.log('Video:', {
      codec: videoStream.codec_name,
      profile: videoStream.profile,
      resolution: `${videoStream.width}x${videoStream.height}`,
      fps: eval(videoStream.r_frame_rate)
    });
    console.log('Audio:', {
      codec: audioStream.codec_name,
      profile: audioStream.profile,
      sampleRate: audioStream.sample_rate,
      channels: audioStream.channels,
      bitrate: Math.round(audioStream.bit_rate / 1000) + ' kb/s'
    });
    
    return true;
  } catch (error) {
    console.error('❌ Conversion failed:', error.message);
    return false;
  }
}

// Test the conversion
const inputVideo = './videos/site_bilibili_tv_en_video_4796356188444672_bstar_from_bstar_web_homepage_recommend_all.mp4';
const outputVideo = './videos/site_bilibili_tv_en_video_4796356188444672_STRONG_CONVERSION.mp4';

console.log('🎬 Testing stronger conversion for waveform compatibility');
console.log('Input:', inputVideo);
console.log('Output:', outputVideo);
console.log('='.repeat(60) + '\n');

strongerConversion(inputVideo, outputVideo)
  .then(success => {
    if (success) {
      console.log('\n✅ Stronger conversion completed!');
      console.log('Try processing this video with your audio waveform tool:');
      console.log(outputVideo);
    } else {
      console.log('\n❌ Conversion failed');
    }
  })
  .catch(console.error);
