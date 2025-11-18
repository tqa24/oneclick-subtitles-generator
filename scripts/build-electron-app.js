const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Master build script for creating Electron app with bundled dependencies
 * This script orchestrates all the bundling steps in the correct order
 */

const BUILD_DIR = path.join(__dirname, '../electron-dist');
const BUILD_SCRIPTS_DIR = path.join(__dirname, '../scripts');

console.log('🚀 Starting Electron app build process...');
console.log('='.repeat(50));

async function buildElectronApp() {
  try {
    // Step 1: Build React frontend
    console.log('🔨 Step 1: Building React frontend...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ React frontend built successfully');

    // Step 2: Create Python wheelhouse
    console.log('\n🐍 Step 2: Creating Python wheelhouse...');
    const { createWheelhouse } = require('./create-python-wheelhouse');
    await createWheelhouse();
    console.log('✅ Python wheelhouse created successfully');

    // Step 3: Bundle platform-specific binaries
    console.log('\n🔧 Step 3: Bundling platform-specific binaries...');
    const { bundleBinaries } = require('./bundle-binaries');
    await bundleBinaries();
    console.log('✅ Platform binaries bundled successfully');

    // Step 4: Install Electron dependencies
    console.log('\n📦 Step 4: Installing Electron dependencies...');
    execSync('npm install --save-dev electron electron-builder', { stdio: 'inherit' });
    console.log('✅ Electron dependencies installed');

    // Step 5: Build the Electron app
    console.log('\n🏗️  Step 5: Building Electron app...');
    execSync('npm run dist', { stdio: 'inherit' });
    console.log('✅ Electron app built successfully');

    // Step 6: Create portable version (Windows)
    if (process.platform === 'win32') {
      console.log('\n🖥️  Step 6: Creating portable Windows version...');
      execSync('npm run dist:win', { stdio: 'inherit' });
      console.log('✅ Portable Windows version created');
    }

    // Step 7: Verify build output
    console.log('\n✅ Step 7: Verifying build output...');
    if (fs.existsSync(BUILD_DIR)) {
      const files = fs.readdirSync(BUILD_DIR);
      console.log('📁 Build output files:');
      files.forEach(file => {
        const filePath = path.join(BUILD_DIR, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   ${file} (${size} MB)`);
      });
    } else {
      console.warn('⚠️  Build output directory not found');
    }

    console.log('\n🎉 Electron app build completed successfully!');
    console.log('='.repeat(50));
    console.log('📦 Next steps:');
    console.log('1. Test the app: npm run electron');
    console.log('2. Check the build output in electron-dist/ directory');
    console.log('3. Test installers on clean VMs');
    console.log('4. Upload to GitHub releases or distribute as needed');

  } catch (error) {
    console.error('\n❌ Build process failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure all dependencies are installed: npm install');
    console.error('2. Check that Python 3.8+ is available');
    console.error('3. Ensure you have internet connection for downloading binaries');
    console.error('4. Verify platform-specific requirements');
    process.exit(1);
  }
}

// Function to clean build artifacts
function cleanBuild() {
  console.log('🧹 Cleaning build artifacts...');
  
  const dirsToClean = [
    '../electron-dist',
    '../build',
    '../bin/python-wheelhouse',
    '../node_modules/.cache'
  ];

  dirsToClean.forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true });
      console.log(`   Removed: ${dir}`);
    }
  });

  console.log('✅ Build artifacts cleaned');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--clean')) {
    cleanBuild();
  } else if (args.includes('--help')) {
    console.log(`
Electron App Build Script

Usage:
  node build-electron-app.js          # Run full build process
  node build-electron-app.js --clean  # Clean build artifacts
  node build-electron-app.js --help   # Show this help

The build process includes:
1. Building React frontend
2. Creating Python wheelhouse
3. Bundling platform-specific binaries
4. Installing Electron dependencies
5. Building Electron app with installers
6. Creating portable versions

Output: electron-dist/ directory with installers
    `);
  } else {
    buildElectronApp();
  }
}

module.exports = { buildElectronApp, cleanBuild };