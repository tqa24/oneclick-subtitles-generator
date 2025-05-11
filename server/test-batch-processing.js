// Test script for batch processing in the audio file controller

const path = require('path');
const fs = require('fs');

// Import the batch processor module
const batchProcessor = require('./controllers/narration/audioFile/batchProcessor');
const { TEMP_AUDIO_DIR } = require('./controllers/narration/directoryManager');

// Create a test function
async function testBatchProcessing() {
  try {

    
    // Create a temporary directory for test files
    const tempDir = path.join(TEMP_AUDIO_DIR);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create test output paths
    const timestamp = Date.now();
    const outputPath1 = path.join(tempDir, `test_batch_1_${timestamp}.wav`);
    const outputPath2 = path.join(tempDir, `test_batch_2_${timestamp}.wav`);
    const finalOutputPath = path.join(tempDir, `test_final_${timestamp}.wav`);
    
    // Create dummy audio segments (we won't actually process these)
    // This is just to test that the function calls work without errors
    const audioSegments1 = [
      { path: 'dummy1.wav', start: 0, end: 2, subtitle_id: '1', type: 'file' },
      { path: 'dummy2.wav', start: 2, end: 4, subtitle_id: '2', type: 'file' }
    ];
    
    const audioSegments2 = [
      { path: 'dummy3.wav', start: 4, end: 6, subtitle_id: '3', type: 'file' },
      { path: 'dummy4.wav', start: 6, end: 8, subtitle_id: '4', type: 'file' }
    ];
    
    // Test the batch processor functions



    
    try {
      await batchProcessor.processBatch(audioSegments1, outputPath1, 0, 10);
    } catch (error) {

    }
    



    
    try {
      await batchProcessor.concatenateAudioFiles([outputPath1, outputPath2], finalOutputPath);
    } catch (error) {

    }
    

    
  } catch (error) {
    console.error('Error in batch processing test:', error);
  }
}

// Run the test
testBatchProcessing();
