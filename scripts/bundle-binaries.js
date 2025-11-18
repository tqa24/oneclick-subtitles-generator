const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

/**
 * Script to download and bundle platform-specific binaries for Electron
 * Downloads ffmpeg, yt-dlp, and other required tools
 */

const BIN_DIR = path.join(__dirname, '../bin');
const PLATFORM = process.platform;
const ARCH = process.arch;

console.log(`🔧 Bundling binaries for ${PLATFORM}-${ARCH}...`);

const BINARY_MANIFEST = {
  ffmpeg: {
    version: '7.1',
    files: {
      win32: {
        url: 'https://github.com/ffmpegwasm/ffmpeg.wasm/releases/download/v7.1.0/ffmpeg-core-7.1.0-win32-x64.zip',
        executable: 'ffmpeg.exe',
        dir: 'ffmpeg-win64'
      },
      linux: {
        url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
        executable: 'ffmpeg',
        dir: 'ffmpeg-linux-x64'
      },
      darwin: {
        url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
        executable: 'ffmpeg',
        dir: 'ffmpeg-mac-x64'
      }
    }
  },
  'yt-dlp': {
    version: '2024.11.12',
    files: {
      win32: {
        url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2024.11.12/yt-dlp.exe',
        executable: 'yt-dlp.exe',
        dir: 'yt-dlp'
      },
      linux: {
        url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2024.11.12/yt-dlp',
        executable: 'yt-dlp',
        dir: 'yt-dlp'
      },
      darwin: {
        url: 'https://github.com/yt-dlp/yt-dlp/releases/download/2024.11.12/yt-dlp_macos',
        executable: 'yt-dlp',
        dir: 'yt-dlp'
      }
    }
  }
};

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

async function extractArchive(archivePath, extractDir) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    if (archivePath.endsWith('.zip')) {
      // For zip files
      await execAsync(`cd "${extractDir}" && unzip -q "${archivePath}" && rm "${archivePath}"`);
    } else if (archivePath.endsWith('.tar.xz')) {
      // For tar.xz files
      await execAsync(`cd "${extractDir}" && tar -xf "${archivePath}" && rm "${archivePath}"`);
    } else if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
      // For tar.gz files
      await execAsync(`cd "${extractDir}" && tar -xzf "${archivePath}" && rm "${archivePath}"`);
    }
  } catch (error) {
    console.warn(`⚠️  Extraction failed for ${archivePath}:`, error.message);
  }
}

async function bundleBinaries() {
  try {
    // Create bin directory
    if (fs.existsSync(BIN_DIR)) {
      fs.rmSync(BIN_DIR, { recursive: true });
    }
    fs.mkdirSync(BIN_DIR, { recursive: true });

    for (const [name, manifest] of Object.entries(BINARY_MANIFEST)) {
      const platformFiles = manifest.files[PLATFORM];
      if (!platformFiles) {
        console.warn(`⚠️  No ${name} binary available for ${PLATFORM}`);
        continue;
      }

      const { url, executable, dir } = platformFiles;
      const downloadDir = path.join(BIN_DIR, dir);
      fs.mkdirSync(downloadDir, { recursive: true });

      const archivePath = path.join(downloadDir, path.basename(url));
      
      console.log(`📦 Downloading ${name}...`);
      
      try {
        await downloadFile(url, archivePath);
        
        // If it's an archive, extract it
        if (archivePath.endsWith('.zip') || archivePath.endsWith('.tar.xz') || archivePath.endsWith('.tar.gz')) {
          console.log(`📂 Extracting ${name}...`);
          await extractArchive(archivePath, downloadDir);
        }
        
        // Make executable on Unix systems
        if (PLATFORM !== 'win32') {
          const fullPath = path.join(downloadDir, executable);
          if (fs.existsSync(fullPath)) {
            fs.chmodSync(fullPath, '755');
          }
        }
        
        console.log(`✅ ${name} bundled successfully`);
        
      } catch (error) {
        console.error(`❌ Failed to bundle ${name}:`, error.message);
      }
    }

    // Create a manifest file for the bundled binaries
    const manifestPath = path.join(BIN_DIR, 'manifest.json');
    const manifestData = {
      platform: PLATFORM,
      arch: ARCH,
      timestamp: new Date().toISOString(),
      binaries: Object.keys(BINARY_MANIFEST)
    };
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
    
    console.log('🎉 Binary bundling completed!');
    console.log(`📁 Output directory: ${BIN_DIR}`);
    
  } catch (error) {
    console.error('❌ Binary bundling failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  bundleBinaries();
}

module.exports = { bundleBinaries, BIN_DIR, BINARY_MANIFEST };