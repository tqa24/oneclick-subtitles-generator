// Test script for the audio file controller

try {
  const controller = require('./controllers/narration/audioFileController');
  console.log('Successfully loaded the controller:', Object.keys(controller));
} catch (error) {
  console.error('Error loading controller:', error);
}
