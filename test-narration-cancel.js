/**
 * Test script to verify Edge TTS and gTTS narration cancellation functionality
 */

const fetch = global.fetch || require('node-fetch');

const SERVER_URL = 'http://localhost:3031';

// Test subtitles
const TEST_SUBTITLES = [
  { id: 1, text: "Hello world", start: 0, end: 1000 },
  { id: 2, text: "This is a test", start: 1000, end: 2000 },
  { id: 3, text: "Cancellation should work", start: 2000, end: 3000 },
  { id: 4, text: "Even for longer text that takes more time to process", start: 3000, end: 4000 },
  { id: 5, text: "This is the final subtitle", start: 4000, end: 5000 }
];

async function testNarrationCancellation(method) {
  console.log(`🧪 Testing ${method.toUpperCase()} narration cancellation...\n`);

  try {
    // Start narration generation
    console.log('1. Starting narration generation...');
    const response = await fetch(`${SERVER_URL}/api/narration/${method}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subtitles: TEST_SUBTITLES,
        settings: method === 'edge-tts' ? {
          voice: 'en-US-AriaNeural',
          rate: '+0%',
          volume: '+0%',
          pitch: '+0Hz'
        } : {
          lang: 'en',
          tld: 'com',
          slow: false
        }
      }),
    });

    if (!response.ok) {
      console.log('❌ Failed to start narration:', await response.text());
      return;
    }

    console.log('✅ Narration started successfully');

    // Read the stream and cancel after receiving progress for 2 subtitles
    let progressCount = 0;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    console.log('2. Reading progress and will cancel after 2 subtitles...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log(`   Received: ${data.status} - ${data.current || 0}/${data.total || 0}`);

            if (data.status === 'progress') {
              progressCount++;
              if (progressCount >= 2) {
                console.log('3. Cancelling narration after receiving 2 progress updates...');
                reader.cancel(); // Cancel the stream
                console.log('✅ Stream cancelled on client side');

                // Wait a moment to see if server stops
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log('ℹ️  If server properly handles cancellation, it should stop processing remaining subtitles');
                return;
              }
            } else if (data.status === 'completed') {
              console.log('❌ Server completed all processing despite cancellation');
              return;
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', parseError);
          }
        }
      }
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('✅ Client-side cancellation successful (AbortError caught)');
    } else {
      console.error('❌ Test failed with error:', error.message);
    }
  }

  console.log(`\n🏁 ${method.toUpperCase()} cancellation test completed!`);
}

async function runTests() {
  console.log('Testing narration cancellation for Edge TTS and gTTS...\n');

  // Test Edge TTS
  await testNarrationCancellation('edge-tts');
  console.log('\n' + '='.repeat(50) + '\n');

  // Test gTTS
  await testNarrationCancellation('gtts');

  console.log('\n🎯 All tests completed!');
  console.log('Check server logs for "Client disconnected" messages to verify server-side cancellation.');
}

if (require.main === module) {
  runTests();
}

module.exports = { testNarrationCancellation, runTests };