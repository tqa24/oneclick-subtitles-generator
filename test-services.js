#!/usr/bin/env node
/**
 * Test script to verify that both F5-TTS and Chatterbox services start correctly
 * This script can be used to debug startup issues without running the full application
 */

const { startNarrationService, NARRATION_PORT, CHATTERBOX_PORT } = require('./server/startNarrationService');

console.log('🧪 Testing narration services startup...');
console.log(`📍 Expected F5-TTS port: ${NARRATION_PORT}`);
console.log(`📍 Expected Chatterbox port: ${CHATTERBOX_PORT}`);
console.log('─'.repeat(50));

// Set environment variable to simulate dev:cuda mode
process.env.START_PYTHON_SERVER = 'true';

try {
  const processes = startNarrationService();
  
  if (processes) {
    console.log('✅ Services started successfully!');
    console.log(`📊 F5-TTS process: ${processes.narrationProcess ? 'Running' : 'Failed'}`);
    console.log(`📊 Chatterbox process: ${processes.chatterboxProcess ? 'Running' : 'Failed'}`);
    
    // Wait a bit for services to initialize
    setTimeout(() => {
      console.log('\n🔍 Testing service endpoints...');
      
      // Test F5-TTS health
      fetch(`http://localhost:${NARRATION_PORT}/health`)
        .then(response => response.json())
        .then(data => console.log('✅ F5-TTS health check passed:', data))
        .catch(error => console.log('❌ F5-TTS health check failed:', error.message));
      
      // Test Chatterbox health
      fetch(`http://localhost:${CHATTERBOX_PORT}/health`)
        .then(response => response.json())
        .then(data => console.log('✅ Chatterbox health check passed:', data))
        .catch(error => console.log('❌ Chatterbox health check failed:', error.message));
        
    }, 5000);
    
    // Handle cleanup on exit
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping test services...');
      
      if (processes.narrationProcess) {
        processes.narrationProcess.kill();
      }
      
      if (processes.chatterboxProcess) {
        processes.chatterboxProcess.kill();
      }
      
      console.log('✅ Test completed');
      process.exit(0);
    });
    
    console.log('\n💡 Press Ctrl+C to stop the test services');
    
  } else {
    console.log('❌ Failed to start services');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error during startup test:', error);
  process.exit(1);
}
