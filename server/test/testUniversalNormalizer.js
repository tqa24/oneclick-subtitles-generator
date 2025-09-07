/**
 * Test script for Universal Video Normalizer
 * Tests various problematic video formats from different sources
 */

const { analyzeVideo, normalizeVideo } = require('../services/video/universalVideoNormalizer');
const path = require('path');

// Test videos
const testVideos = [
  {
    name: 'Douyin (HE-AAC, wrong stream order)',
    path: './videos/SX4xNBjbmSs_-.mp4',
    expectedIssues: ['stream_order', 'audio_codec'],
    expectedMethod: 'quick_fix'
  },
  {
    name: 'Uploaded (AV1/Opus)',  
    path: './videos/RE-dLbNOkf4.mp4',
    expectedIssues: ['video_codec', 'audio_codec'],
    expectedMethod: 'full_conversion'
  },
  {
    name: 'Bilibili (HEVC/AAC)',
    path: './videos/site_bilibili_tv_en_video_4796356188444672_bstar_from_bstar_web_homepage_recommend_all.mp4',
    expectedIssues: ['video_codec'],
    expectedMethod: 'full_conversion'
  }
];

async function testVideo(videoInfo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${videoInfo.name}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Analyze the video
    console.log('\n📋 Analyzing video...');
    const analysis = await analyzeVideo(videoInfo.path);
    
    // Display issues found
    if (analysis.issues.length > 0) {
      console.log('\n🔍 Issues found:');
      analysis.issues.forEach(issue => {
        const icon = issue.severity === 'high' ? '🔴' : 
                    issue.severity === 'medium' ? '🟡' : 
                    issue.severity === 'low' ? '🟢' : 'ℹ️';
        console.log(`  ${icon} ${issue.description}`);
      });
    } else {
      console.log('✅ No issues found');
    }
    
    // Display codec information
    console.log('\n📊 Codec Information:');
    console.log(`  Video: ${analysis.videoCodec} ${analysis.videoProfile ? `(${analysis.videoProfile})` : ''}`);
    console.log(`  Audio: ${analysis.audioCodec} ${analysis.audioProfile ? `(${analysis.audioProfile})` : ''}`);
    console.log(`  Resolution: ${analysis.resolution}`);
    console.log(`  Duration: ${Math.round(analysis.duration)} seconds`);
    
    // Check normalization decision
    console.log('\n🔧 Normalization Decision:');
    console.log(`  Needs normalization: ${analysis.needsNormalization ? 'YES' : 'NO'}`);
    if (analysis.needsNormalization) {
      console.log(`  Quick fix suitable: ${analysis.needsQuickFix ? 'YES' : 'NO'}`);
      console.log(`  Full conversion needed: ${analysis.needsFullConversion ? 'YES' : 'NO'}`);
      const expectedMethod = analysis.needsQuickFix && !analysis.needsFullConversion ? 'quick_fix' : 'full_conversion';
      console.log(`  Expected method: ${expectedMethod}`);
    }
    
    // Validate expectations
    if (videoInfo.expectedIssues) {
      console.log('\n✅ Validation:');
      const foundIssueTypes = analysis.issues.map(i => i.type);
      const expectedFound = videoInfo.expectedIssues.every(expected => 
        foundIssueTypes.includes(expected)
      );
      
      if (expectedFound) {
        console.log('  ✅ All expected issues detected');
      } else {
        console.log('  ❌ Not all expected issues detected');
        console.log(`     Expected: ${videoInfo.expectedIssues.join(', ')}`);
        console.log(`     Found: ${foundIssueTypes.join(', ')}`);
      }
    }
    
    return {
      name: videoInfo.name,
      success: true,
      analysis
    };
    
  } catch (error) {
    console.error(`\n❌ Error testing ${videoInfo.name}:`, error.message);
    return {
      name: videoInfo.name,
      success: false,
      error: error.message
    };
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        UNIVERSAL VIDEO NORMALIZER TEST SUITE              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  // Test each video
  for (const video of testVideos) {
    const result = await testVideo(video);
    results.push(result);
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\n✅ Successful: ${successful}/${results.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${results.length}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  // Normalization summary
  console.log('\n📋 Normalization Requirements:');
  results.filter(r => r.success).forEach(r => {
    const needs = r.analysis.needsNormalization;
    const method = r.analysis.needsQuickFix && !r.analysis.needsFullConversion ? 
                  'Quick Fix' : 
                  r.analysis.needsFullConversion ? 'Full Conversion' : 'None';
    console.log(`  ${r.name}: ${needs ? method : 'No normalization needed'}`);
  });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(successful === results.length ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED');
  console.log(`${'='.repeat(60)}`);
}

// Run the tests
runAllTests().catch(console.error);
