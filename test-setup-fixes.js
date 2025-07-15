#!/usr/bin/env node

/**
 * Test script to verify that the setup fixes work correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Chatterbox setup fixes...\n');

// Test 1: Check if Unicode encoding fix works
console.log('1. Testing Unicode encoding fix...');
const apiPyPath = path.join('chatterbox', 'api.py');
if (fs.existsSync(apiPyPath)) {
    const apiContent = fs.readFileSync(apiPyPath, 'utf8');
    
    const hasUnicodeCheckmarks = apiContent.includes('✓') || apiContent.includes('✗');
    const hasAsciiReplacements = apiContent.includes('[SUCCESS]') && apiContent.includes('[ERROR]');
    
    if (hasUnicodeCheckmarks && !hasAsciiReplacements) {
        console.log('   ❌ Unicode checkmarks found, ASCII replacements missing');
        console.log('   This will cause encoding errors on Windows');
    } else if (!hasUnicodeCheckmarks && hasAsciiReplacements) {
        console.log('   ✅ Unicode encoding fix applied correctly');
    } else if (hasUnicodeCheckmarks && hasAsciiReplacements) {
        console.log('   ⚠️ Both Unicode and ASCII versions found - partial fix');
    } else {
        console.log('   ⚠️ Neither Unicode nor ASCII versions found - unexpected state');
    }
} else {
    console.log('   ⚠️ chatterbox/api.py not found - skipping test');
}

// Test 2: Check if model_path.json is disabled
console.log('\n2. Testing model_path.json disable fix...');
const modelPathJsonPath = path.join('chatterbox', 'chatterbox', 'model_path.json');
const modelPathDisabledPath = modelPathJsonPath + '.disabled';

if (fs.existsSync(modelPathJsonPath)) {
    console.log('   ❌ model_path.json still exists - will cause model loading issues');
    console.log('   Should be renamed to .disabled to use Hugging Face models');
} else if (fs.existsSync(modelPathDisabledPath)) {
    console.log('   ✅ model_path.json disabled correctly (renamed to .disabled)');
} else {
    console.log('   ✅ model_path.json not found (using default Hugging Face behavior)');
}

// Test 3: Check .pth file path
console.log('\n3. Testing .pth file import path fix...');
const sitePackagesPath = path.join('.venv', 'Lib', 'site-packages');
if (fs.existsSync(sitePackagesPath)) {
    const pthFiles = fs.readdirSync(sitePackagesPath).filter(file => 
        file.startsWith('__editable__.chatterbox') && file.endsWith('.pth')
    );
    
    if (pthFiles.length === 0) {
        console.log('   ⚠️ No chatterbox .pth files found - package may not be installed');
    } else {
        for (const pthFile of pthFiles) {
            const pthPath = path.join(sitePackagesPath, pthFile);
            const pthContent = fs.readFileSync(pthPath, 'utf8').trim();
            const expectedPath = path.resolve('chatterbox', 'chatterbox');
            
            if (pthContent.includes(expectedPath) || pthContent.endsWith('chatterbox\\chatterbox')) {
                console.log(`   ✅ ${pthFile} has correct import path`);
            } else {
                console.log(`   ❌ ${pthFile} has incorrect path: ${pthContent}`);
                console.log(`   Expected path containing: ${expectedPath}`);
            }
        }
    }
} else {
    console.log('   ⚠️ Virtual environment not found - skipping .pth test');
}

// Test 4: Test actual import
console.log('\n4. Testing actual chatterbox import...');
const { execSync } = require('child_process');
try {
    const testCmd = 'uv run --python .venv python -c "from chatterbox.tts import ChatterboxTTS; from chatterbox.vc import ChatterboxVC; print(\'[SUCCESS] Chatterbox imports work correctly\')"';
    const result = execSync(testCmd, { encoding: 'utf8', timeout: 30000 });
    console.log('   [SUCCESS] Chatterbox imports work correctly');
} catch (error) {
    console.log('   ❌ Chatterbox import test failed:');
    console.log(`   ${error.message}`);
    console.log('   This indicates the fixes may not be complete');
}

console.log('\n🏁 Test completed!');
console.log('\nIf any tests failed, run the setup script again or apply fixes manually.');
