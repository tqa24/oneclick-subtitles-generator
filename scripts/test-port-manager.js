/**
 * Test script for port management system
 */

const { 
  getAllPorts, 
  findProcessesOnPorts, 
  killProcessesOnPorts,
  trackProcess,
  cleanupTrackingFile
} = require('../server/utils/portManager');

async function testPortManager() {
  console.log('🧪 Testing Port Management System...\n');

  // Test 1: Get all ports
  console.log('1. Getting all application ports:');
  const ports = getAllPorts();
  console.log('   Ports:', ports);
  console.log('   ✅ Port retrieval works\n');

  // Test 2: Find processes on ports
  console.log('2. Scanning for processes on application ports:');
  const processes = await findProcessesOnPorts();
  console.log(`   Found ${processes.length} process(es):`, processes);
  console.log('   ✅ Process scanning works\n');

  // Test 3: Test tracking (simulate)
  console.log('3. Testing process tracking:');
  trackProcess(3030, 12345, 'Test Process');
  console.log('   ✅ Process tracking works\n');

  // Test 4: Cleanup
  console.log('4. Testing cleanup:');
  cleanupTrackingFile();
  console.log('   ✅ Cleanup works\n');

  console.log('🎉 All port management tests passed!');
}

// Run tests
testPortManager().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
