/**
 * Test script to verify ffmpeg/ffprobe path resolution
 */

const { getDiagnosticInfo, getFfmpegPath, getFfprobePath } = require('./server/services/shared/ffmpegUtils');

async function testFfmpegFix() {
  console.log('🔍 Testing FFmpeg path resolution...\n');
  
  try {
    const diagnostics = await getDiagnosticInfo();
    
    console.log('📊 Diagnostic Information:');
    console.log('==========================');
    console.log(`Platform: ${diagnostics.platform}`);
    console.log(`FFmpeg Path: ${diagnostics.ffmpegPath}`);
    console.log(`FFprobe Path: ${diagnostics.ffprobePath}`);
    console.log(`FFmpeg Available: ${diagnostics.ffmpegAvailable ? '✅' : '❌'}`);
    console.log(`FFprobe Available: ${diagnostics.ffprobeAvailable ? '✅' : '❌'}`);
    console.log(`PATH Environment: ${diagnostics.pathEnv?.substring(0, 200)}...`);
    
    if (diagnostics.ffmpegAvailable && diagnostics.ffprobeAvailable) {
      console.log('\n🎉 SUCCESS: Both FFmpeg and FFprobe are available!');
      console.log('The fix should resolve the ENOENT errors in VSCode.');
    } else {
      console.log('\n⚠️  WARNING: FFmpeg/FFprobe not found or not working.');
      console.log('Please ensure FFmpeg is installed and accessible.');
      
      if (process.platform === 'win32') {
        console.log('\nFor Windows, try:');
        console.log('1. Install via Chocolatey: choco install ffmpeg');
        console.log('2. Download from https://ffmpeg.org/download.html');
        console.log('3. Add FFmpeg to your system PATH');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing FFmpeg fix:', error.message);
  }
}

// Run the test
testFfmpegFix();
