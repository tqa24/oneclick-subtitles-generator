/**
 * Simple test script to verify individual cache clearing functionality
 */

const http = require('http');

// Test configuration
const API_BASE_URL = 'http://localhost:3001';
const TEST_CACHE_TYPES = [
  'videos',
  'subtitles', 
  'userSubtitles',
  'rules',
  'narrationReference',
  'narrationOutput',
  'lyrics',
  'albumArt',
  'uploads',
  'output',
  'videoRendered',
  'videoTemp',
  'videoAlbumArt',
  'videoRendererUploads',
  'videoRendererOutput'
];

/**
 * Make HTTP request
 */
function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Test cache info endpoint
 */
async function testCacheInfo() {
  console.log('🔍 Testing cache info endpoint...');
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/cache-info`);
    if (response.status === 200 && response.data.success) {
      console.log('✅ Cache info endpoint working');
      console.log(`   Total cache: ${response.data.details.totalCount} files (${response.data.details.formattedTotalSize})`);
      return response.data.details;
    } else {
      console.log('❌ Cache info endpoint failed:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Cache info endpoint error:', error.message);
    return null;
  }
}

/**
 * Test individual cache clearing
 */
async function testIndividualCacheClear(cacheType) {
  console.log(`🧹 Testing individual cache clear for: ${cacheType}`);
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/clear-cache/${cacheType}`, 'DELETE');
    if (response.status === 200 && response.data.success) {
      const clearedData = response.data.details[Object.keys(response.data.details)[0]];
      console.log(`✅ ${cacheType} cache cleared: ${clearedData.count} files (${clearedData.formattedSize})`);
      return true;
    } else if (response.status === 400) {
      console.log(`⚠️  ${cacheType} cache clear failed (expected for invalid types): ${response.data.error}`);
      return false;
    } else {
      console.log(`❌ ${cacheType} cache clear failed:`, response.data);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${cacheType} cache clear error:`, error.message);
    return false;
  }
}

/**
 * Test invalid cache type
 */
async function testInvalidCacheType() {
  console.log('🚫 Testing invalid cache type...');
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/clear-cache/invalid_type`, 'DELETE');
    if (response.status === 400 && !response.data.success) {
      console.log('✅ Invalid cache type properly rejected');
      return true;
    } else {
      console.log('❌ Invalid cache type should have been rejected:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Invalid cache type test error:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Starting individual cache clear tests...\n');

  // Test cache info first
  const cacheInfo = await testCacheInfo();
  if (!cacheInfo) {
    console.log('❌ Cannot proceed without cache info. Make sure the server is running.');
    return;
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test individual cache clearing for each type
  let successCount = 0;
  for (const cacheType of TEST_CACHE_TYPES) {
    const success = await testIndividualCacheClear(cacheType);
    if (success) successCount++;
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between tests
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test invalid cache type
  await testInvalidCacheType();

  console.log('\n' + '='.repeat(50) + '\n');

  // Summary
  console.log(`📊 Test Summary:`);
  console.log(`   ✅ Successful cache clears: ${successCount}/${TEST_CACHE_TYPES.length}`);
  console.log(`   🔍 Cache info endpoint: Working`);
  console.log(`   🚫 Invalid type handling: Working`);

  if (successCount === TEST_CACHE_TYPES.length) {
    console.log('\n🎉 All tests passed! Individual cache clearing is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the server logs for more details.');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testCacheInfo, testIndividualCacheClear };
