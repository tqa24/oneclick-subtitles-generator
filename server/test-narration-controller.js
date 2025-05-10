// Test script for the narration controller

try {
  const narrationController = require('./controllers/narration');
  console.log('Successfully loaded the narration controller with functions:');
  
  // Group functions by category
  const functionsByCategory = {
    'Directory Management': [
      'VIDEOS_DIR', 'SUBTITLES_DIR', 'NARRATION_DIR', 'REFERENCE_AUDIO_DIR', 
      'OUTPUT_AUDIO_DIR', 'TEMP_AUDIO_DIR', 'ensureDirectoriesExist'
    ],
    'Audio File Handling': [
      'serveAudioFile', 'downloadAlignedAudio', 'downloadAllAudio', 'enhanceF5TTSNarrations'
    ],
    'Reference Audio': [
      'uploadReferenceAudio', 'deleteReferenceAudio', 'listReferenceAudio'
    ],
    'Narration Generation': [
      'generateNarration', 'cancelNarrationGeneration'
    ],
    'Gemini Audio': [
      'generateGeminiNarration'
    ]
  };
  
  // Check which functions are available in each category
  for (const [category, expectedFunctions] of Object.entries(functionsByCategory)) {
    console.log(`\n${category}:`);
    for (const funcName of expectedFunctions) {
      const available = funcName in narrationController;
      console.log(`  - ${funcName}: ${available ? 'Available' : 'Not available'}`);
    }
  }
  
  // Check if our new batch processing functions are accessible through the controller
  console.log('\nChecking if batch processing functions are accessible:');
  
  // These should not be directly exposed in the controller
  const batchFunctions = ['processBatch', 'concatenateAudioFiles'];
  for (const funcName of batchFunctions) {
    const available = funcName in narrationController;
    console.log(`  - ${funcName}: ${available ? 'Directly exposed (not expected)' : 'Not directly exposed (expected)'}`);
  }
  
  console.log('\nTest completed successfully!');
} catch (error) {
  console.error('Error loading narration controller:', error);
}
