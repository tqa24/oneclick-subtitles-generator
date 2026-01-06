/**
 * Edge TTS Controller for generating narration using Microsoft Edge TTS
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Import cleanup function
const { cleanupOldSubtitleDirectories } = require('./narration/directoryManager');

// Check if we're in the project directory and have .venv
const projectRoot = process.cwd();
const venvPath = path.join(projectRoot, '.venv');
const pythonExecutable = process.platform === 'win32'
  ? path.join(venvPath, 'Scripts', 'python.exe')
  : path.join(venvPath, 'bin', 'python');

// Cache file for voices (to use when API fails)
const voicesCacheFile = path.join(os.tmpdir(), 'edge_tts_voices_cache.json');

// Fallback voices list (common voices for when API is unavailable)
const FALLBACK_VOICES = [
  { name: 'Microsoft Server Speech Text to Speech Voice (en-US, AriaNeural)', short_name: 'en-US-AriaNeural', gender: 'Female', locale: 'en-US', language: 'en', display_name: 'Aria (en-US)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (en-US, GuyNeural)', short_name: 'en-US-GuyNeural', gender: 'Male', locale: 'en-US', language: 'en', display_name: 'Guy (en-US)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)', short_name: 'en-US-JennyNeural', gender: 'Female', locale: 'en-US', language: 'en', display_name: 'Jenny (en-US)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (en-GB, SoniaNeural)', short_name: 'en-GB-SoniaNeural', gender: 'Female', locale: 'en-GB', language: 'en', display_name: 'Sonia (en-GB)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (vi-VN, HoaiMyNeural)', short_name: 'vi-VN-HoaiMyNeural', gender: 'Female', locale: 'vi-VN', language: 'vi', display_name: 'Hoài My (vi-VN)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (vi-VN, NamMinhNeural)', short_name: 'vi-VN-NamMinhNeural', gender: 'Male', locale: 'vi-VN', language: 'vi', display_name: 'Nam Minh (vi-VN)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ko-KR, SunHiNeural)', short_name: 'ko-KR-SunHiNeural', gender: 'Female', locale: 'ko-KR', language: 'ko', display_name: 'Sun-Hi (ko-KR)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ko-KR, InJoonNeural)', short_name: 'ko-KR-InJoonNeural', gender: 'Male', locale: 'ko-KR', language: 'ko', display_name: 'InJoon (ko-KR)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, NanamiNeural)', short_name: 'ja-JP-NanamiNeural', gender: 'Female', locale: 'ja-JP', language: 'ja', display_name: 'Nanami (ja-JP)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ja-JP, KeitaNeural)', short_name: 'ja-JP-KeitaNeural', gender: 'Male', locale: 'ja-JP', language: 'ja', display_name: 'Keita (ja-JP)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)', short_name: 'zh-CN-XiaoxiaoNeural', gender: 'Female', locale: 'zh-CN', language: 'zh', display_name: 'Xiaoxiao (zh-CN)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (zh-CN, YunxiNeural)', short_name: 'zh-CN-YunxiNeural', gender: 'Male', locale: 'zh-CN', language: 'zh', display_name: 'Yunxi (zh-CN)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (es-ES, ElviraNeural)', short_name: 'es-ES-ElviraNeural', gender: 'Female', locale: 'es-ES', language: 'es', display_name: 'Elvira (es-ES)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (es-ES, AlvaroNeural)', short_name: 'es-ES-AlvaroNeural', gender: 'Male', locale: 'es-ES', language: 'es', display_name: 'Alvaro (es-ES)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (fr-FR, DeniseNeural)', short_name: 'fr-FR-DeniseNeural', gender: 'Female', locale: 'fr-FR', language: 'fr', display_name: 'Denise (fr-FR)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (fr-FR, HenriNeural)', short_name: 'fr-FR-HenriNeural', gender: 'Male', locale: 'fr-FR', language: 'fr', display_name: 'Henri (fr-FR)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (de-DE, KatjaNeural)', short_name: 'de-DE-KatjaNeural', gender: 'Female', locale: 'de-DE', language: 'de', display_name: 'Katja (de-DE)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (de-DE, ConradNeural)', short_name: 'de-DE-ConradNeural', gender: 'Male', locale: 'de-DE', language: 'de', display_name: 'Conrad (de-DE)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (pt-BR, FranciscaNeural)', short_name: 'pt-BR-FranciscaNeural', gender: 'Female', locale: 'pt-BR', language: 'pt', display_name: 'Francisca (pt-BR)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (pt-BR, AntonioNeural)', short_name: 'pt-BR-AntonioNeural', gender: 'Male', locale: 'pt-BR', language: 'pt', display_name: 'Antonio (pt-BR)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ru-RU, SvetlanaNeural)', short_name: 'ru-RU-SvetlanaNeural', gender: 'Female', locale: 'ru-RU', language: 'ru', display_name: 'Svetlana (ru-RU)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ru-RU, DmitryNeural)', short_name: 'ru-RU-DmitryNeural', gender: 'Male', locale: 'ru-RU', language: 'ru', display_name: 'Dmitry (ru-RU)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ar-SA, ZariyahNeural)', short_name: 'ar-SA-ZariyahNeural', gender: 'Female', locale: 'ar-SA', language: 'ar', display_name: 'Zariyah (ar-SA)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (ar-SA, HamedNeural)', short_name: 'ar-SA-HamedNeural', gender: 'Male', locale: 'ar-SA', language: 'ar', display_name: 'Hamed (ar-SA)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (hi-IN, SwaraNeural)', short_name: 'hi-IN-SwaraNeural', gender: 'Female', locale: 'hi-IN', language: 'hi', display_name: 'Swara (hi-IN)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (hi-IN, MadhurNeural)', short_name: 'hi-IN-MadhurNeural', gender: 'Male', locale: 'hi-IN', language: 'hi', display_name: 'Madhur (hi-IN)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (th-TH, PremwadeeNeural)', short_name: 'th-TH-PremwadeeNeural', gender: 'Female', locale: 'th-TH', language: 'th', display_name: 'Premwadee (th-TH)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (th-TH, NiwatNeural)', short_name: 'th-TH-NiwatNeural', gender: 'Male', locale: 'th-TH', language: 'th', display_name: 'Niwat (th-TH)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (id-ID, GadisNeural)', short_name: 'id-ID-GadisNeural', gender: 'Female', locale: 'id-ID', language: 'id', display_name: 'Gadis (id-ID)' },
  { name: 'Microsoft Server Speech Text to Speech Voice (id-ID, ArdiNeural)', short_name: 'id-ID-ArdiNeural', gender: 'Male', locale: 'id-ID', language: 'id', display_name: 'Ardi (id-ID)' },
];

/**
 * Load cached voices from file
 */
const loadCachedVoices = () => {
  try {
    if (fs.existsSync(voicesCacheFile)) {
      const cached = JSON.parse(fs.readFileSync(voicesCacheFile, 'utf-8'));
      if (cached.voices && cached.voices.length > 0) {
        console.log(`[Edge TTS] Loaded ${cached.voices.length} voices from cache`);
        return cached.voices;
      }
    }
  } catch (e) {
    console.warn('[Edge TTS] Failed to load cached voices:', e.message);
  }
  return null;
};

/**
 * Save voices to cache file
 */
const saveCachedVoices = (voices) => {
  try {
    fs.writeFileSync(voicesCacheFile, JSON.stringify({ voices, timestamp: Date.now() }), 'utf-8');
    console.log(`[Edge TTS] Saved ${voices.length} voices to cache`);
  } catch (e) {
    console.warn('[Edge TTS] Failed to save voices cache:', e.message);
  }
};


/**
 * Get available Edge TTS voices
 */
const getVoices = async (req, res) => {
  try {
    // Create a temporary Python script to get voices
    const tempScript = path.join(os.tmpdir(), `edge_tts_voices_${uuidv4()}.py`);
    const scriptContent = `
import asyncio
import json
import sys
import ssl
import aiohttp

try:
    import edge_tts
    
    async def get_voices():
        try:
            voices = await edge_tts.list_voices()
            formatted_voices = []
            for voice in voices:
                # Use .get() for safety - API structure may vary between versions
                # FriendlyName is the new key (was DisplayName in older versions)
                display_name = voice.get('FriendlyName') or voice.get('DisplayName') or voice.get('ShortName', 'Unknown')
                locale = voice.get('Locale', 'en-US')
                formatted_voices.append({
                    'name': voice.get('Name', ''),
                    'short_name': voice.get('ShortName', ''),
                    'gender': voice.get('Gender', 'Unknown'),
                    'locale': locale,
                    'language': locale.split('-')[0] if locale else 'en',
                    'display_name': f"{display_name} ({locale})"
                })
            return formatted_voices
        except aiohttp.ClientError as e:
            raise Exception(f"Network error fetching voices: {str(e)}")
        except ssl.SSLError as e:
            raise Exception(f"SSL error fetching voices: {str(e)}")
    
    voices = asyncio.run(get_voices())
    print(json.dumps({'voices': voices}))
    
except ImportError as e:
    print(json.dumps({'error': f'edge-tts library not available: {str(e)}'}))
    sys.exit(1)
except Exception as e:
    import traceback
    print(json.dumps({'error': str(e), 'traceback': traceback.format_exc()}))
    sys.exit(1)
`;

    fs.writeFileSync(tempScript, scriptContent);

    // Execute the Python script
    const pythonProcess = spawn(pythonExecutable, [tempScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempScript);
      } catch (e) {
        // Ignore cleanup errors
      }

      if (code !== 0) {
        console.error('Edge TTS voices error:', stderr);
        console.error('Edge TTS voices stdout:', stdout);
        console.error('Edge TTS voices exit code:', code);
        console.error('Edge TTS Python executable:', pythonExecutable);
        console.error('Edge TTS Python exists:', fs.existsSync(pythonExecutable));

        // Try to parse error from stdout if available
        let errorMessage = 'Failed to get Edge TTS voices';
        try {
          const errorData = JSON.parse(stdout);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.traceback) {
            console.error('Edge TTS Python traceback:', errorData.traceback);
          }
        } catch (e) {
          // stdout was not valid JSON
        }

        // Try to use cached voices first, then fallback
        const cachedVoices = loadCachedVoices();
        if (cachedVoices) {
          console.log('[Edge TTS] Using cached voices due to API failure');
          return res.json({ voices: cachedVoices, cached: true, warning: errorMessage });
        }

        console.log('[Edge TTS] Using fallback voices due to API failure');
        return res.json({ voices: FALLBACK_VOICES, fallback: true, warning: errorMessage });
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          // API returned an error - try cache/fallback
          const cachedVoices = loadCachedVoices();
          if (cachedVoices) {
            console.log('[Edge TTS] Using cached voices due to API error:', result.error);
            return res.json({ voices: cachedVoices, cached: true, warning: result.error });
          }
          console.log('[Edge TTS] Using fallback voices due to API error:', result.error);
          return res.json({ voices: FALLBACK_VOICES, fallback: true, warning: result.error });
        }

        // Success - cache the voices for future use
        if (result.voices && result.voices.length > 0) {
          saveCachedVoices(result.voices);
        }

        res.json(result);
      } catch (parseError) {
        console.error('Failed to parse voices response:', parseError);

        // Try cache/fallback on parse error too
        const cachedVoices = loadCachedVoices();
        if (cachedVoices) {
          return res.json({ voices: cachedVoices, cached: true, warning: 'Failed to parse API response' });
        }
        res.json({ voices: FALLBACK_VOICES, fallback: true, warning: 'Failed to parse API response' });
      }
    });

  } catch (error) {
    console.error('Error getting Edge TTS voices:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate Edge TTS narration
 */
const generateNarration = async (req, res) => {
  try {
    console.log(`[Edge TTS] Starting narration generation`);
    console.log(`[Edge TTS] Python executable: ${pythonExecutable}`);
    console.log(`[Edge TTS] Python executable exists: ${fs.existsSync(pythonExecutable)}`);
    console.log(`[Edge TTS] Virtual environment path: ${venvPath}`);
    console.log(`[Edge TTS] Virtual environment exists: ${fs.existsSync(venvPath)}`);

    const { subtitles, settings } = req.body;

    if (!subtitles || !Array.isArray(subtitles)) {
      return res.status(400).json({ error: 'Invalid subtitles data' });
    }

    console.log(`[Edge TTS] Processing ${subtitles.length} subtitles`);

    const voice = settings?.voice || 'en-US-AriaNeural';
    const rate = settings?.rate || '+0%';
    const volume = settings?.volume || '+0%';
    const pitch = settings?.pitch || '+0Hz';

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send start event
    res.write(`data: ${JSON.stringify({ status: 'started', total: subtitles.length })}\n\n`);

    const results = [];
    const outputDir = path.join(projectRoot, 'narration', 'output');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Process each subtitle
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];

      // Check if client disconnected
      if (res.destroyed || req.aborted) {
        console.log(`[Edge TTS] Client disconnected during processing at subtitle ${i + 1}, stopping generation`);
        return;
      }

      console.log(`[Edge TTS] Processing subtitle ${i + 1}/${subtitles.length}:`);
      console.log(`[Edge TTS] Text: "${subtitle.text}"`);
      console.log(`[Edge TTS] ID: ${subtitle.id || i}`);
      console.log(`[Edge TTS] Voice settings: ${voice}, Rate: ${rate}, Volume: ${volume}, Pitch: ${pitch}`);
      console.log(`[Edge TTS] Voice type: ${typeof voice}, Voice length: ${voice.length}`);

      try {
        // Create temporary Python script for this subtitle
        const tempScript = path.join(os.tmpdir(), `edge_tts_generate_${uuidv4()}.py`);
        console.log(`[Edge TTS] Created temp script: ${tempScript}`);

        // Create subtitle directory (same as F5-TTS/Chatterbox pattern)
        const subtitleDir = path.join(outputDir, `subtitle_${subtitle.id || i}`);
        console.log(`[Edge TTS] Subtitle directory: ${subtitleDir}`);
        if (!fs.existsSync(subtitleDir)) {
          fs.mkdirSync(subtitleDir, { recursive: true });
          console.log(`[Edge TTS] Created subtitle directory: ${subtitleDir}`);
        } else {
          console.log(`[Edge TTS] Subtitle directory already exists: ${subtitleDir}`);
        }

        // Always use 1.mp3 to override existing narrations for the same video/subtitle set
        // This ensures align-narration always finds the latest narration
        const filename = '1.mp3';
        const outputPath = path.join(subtitleDir, filename);
        console.log(`[Edge TTS] Output path: ${outputPath}`);

        // If file exists, it will be overwritten (this is intentional)
        if (fs.existsSync(outputPath)) {
          console.log(`[Edge TTS] Overriding existing narration: ${outputPath}`);

          // Clear backup audio file created by speed control to prevent dangerous risks
          const backupFilename = `backup_${filename}`;
          const backupPath = path.join(subtitleDir, backupFilename);
          if (fs.existsSync(backupPath)) {
            try {
              fs.unlinkSync(backupPath);
              console.log(`[Edge TTS] Cleared backup file: ${backupPath}`);
            } catch (backupError) {
              console.warn(`[Edge TTS] Failed to clear backup file ${backupPath}: ${backupError.message}`);
            }
          }
        } else {
          console.log(`[Edge TTS] Creating new narration file: ${outputPath}`);
        }

        // Full filename for response (includes subtitle directory)
        const fullFilename = `subtitle_${subtitle.id || i}/${filename}`;

        const scriptContent = `
import asyncio
import json
import sys
import subprocess
import tempfile
import os

try:
    import edge_tts

    async def generate_audio():
        text = """${subtitle.text.replace(/"/g, '\\"')}"""
        voice = "${voice}"
        rate = "${rate}"
        volume = "${volume}"
        pitch = "${pitch}"
        output_path = "${outputPath.replace(/\\/g, '\\\\')}"

        # Create a temporary text file for the input
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as temp_file:
            temp_file.write(text)
            temp_text_path = temp_file.name

        try:
            # Use edge-tts command line with prosody parameters
            cmd = [
                sys.executable, '-m', 'edge_tts',
                '--voice', voice,
                '--file', temp_text_path,
                '--write-media', output_path
            ]

            # Add prosody parameters if they're not default values
            # Use --option=value format for edge-tts command line
            if rate != "+0%":
                cmd.append(f'--rate={rate}')
            if volume != "+0%":
                cmd.append(f'--volume={volume}')
            if pitch != "+0Hz":
                cmd.append(f'--pitch={pitch}')

            # Run the command
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            print(json.dumps({'success': True, 'filename': '${fullFilename}'}))

        finally:
            # Clean up temporary file
            if os.path.exists(temp_text_path):
                os.unlink(temp_text_path)

    asyncio.run(generate_audio())

except ImportError:
    print(json.dumps({'success': False, 'error': 'edge-tts library not available'}))
    sys.exit(1)
except subprocess.CalledProcessError as e:
    print(json.dumps({'success': False, 'error': f'edge-tts command failed: {e.stderr}'}))
    sys.exit(1)
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
    sys.exit(1)
`;

        fs.writeFileSync(tempScript, scriptContent);
        console.log(`[Edge TTS] Written Python script to: ${tempScript}`);

        // Execute the Python script
        console.log(`[Edge TTS] Executing Python script with: ${pythonExecutable} ${tempScript}`);
        console.log(`[Edge TTS] Expected edge-tts command: ${pythonExecutable} -m edge_tts --voice ${voice} --file <temp_file> --write-media ${outputPath}${rate !== '+0%' ? ` --rate=${rate}` : ''}${volume !== '+0%' ? ` --volume=${volume}` : ''}${pitch !== '+0Hz' ? ` --pitch=${pitch}` : ''}`);
        const result = await new Promise((resolve, reject) => {
          const pythonProcess = spawn(pythonExecutable, [tempScript], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          console.log(`[Edge TTS] Python process spawned with PID: ${pythonProcess.pid}`);

          let stdout = '';
          let stderr = '';

          pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          pythonProcess.on('close', (code) => {
            // Clean up temp file
            try {
              fs.unlinkSync(tempScript);
            } catch (e) {
              // Ignore cleanup errors
            }

            if (code !== 0) {
              console.error(`[Edge TTS] Python process failed for subtitle ${i}:`);
              console.error(`[Edge TTS] Exit code: ${code}`);
              console.error(`[Edge TTS] Python executable: ${pythonExecutable}`);
              console.error(`[Edge TTS] Script path: ${tempScript}`);
              console.error(`[Edge TTS] Subtitle text: "${subtitle.text}"`);
              console.error(`[Edge TTS] Voice: ${voice}, Rate: ${rate}, Volume: ${volume}, Pitch: ${pitch}`);
              console.error(`[Edge TTS] Output path: ${outputPath}`);
              console.error(`[Edge TTS] STDERR: ${stderr}`);
              console.error(`[Edge TTS] STDOUT: ${stdout}`);
              reject(new Error(`Python process failed with exit code ${code}. STDERR: ${stderr}. STDOUT: ${stdout}`));
              return;
            }

            try {
              const result = JSON.parse(stdout);
              console.log(`[Edge TTS] Successfully parsed result for subtitle ${i}:`, result);
              resolve(result);
            } catch (parseError) {
              console.error(`[Edge TTS] Failed to parse result for subtitle ${i}:`);
              console.error(`[Edge TTS] Parse error: ${parseError.message}`);
              console.error(`[Edge TTS] Raw stdout: ${stdout}`);
              console.error(`[Edge TTS] Raw stderr: ${stderr}`);
              reject(new Error(`Failed to parse result: ${parseError.message}. Raw output: ${stdout}`));
            }
          });
        });

        const subtitleResult = {
          subtitle_id: subtitle.id || i,
          text: subtitle.text,
          start_time: subtitle.start || 0,
          end_time: subtitle.end || 0,
          filename: result.success ? result.filename : null,
          success: result.success,
          error: result.error || null,
          method: 'edge-tts'
        };

        results.push(subtitleResult);

        // Send progress event
        try {
          res.write(`data: ${JSON.stringify({
            status: 'progress',
            current: i + 1,
            total: subtitles.length,
            result: subtitleResult
          })}\n\n`);
        } catch (writeError) {
          console.log(`[Edge TTS] Client disconnected during progress write at subtitle ${i + 1}, stopping generation`);
          return;
        }

      } catch (error) {
        console.error(`[Edge TTS] Error generating Edge TTS for subtitle ${i}:`, error);
        console.error(`[Edge TTS] Error stack:`, error.stack);
        console.error(`[Edge TTS] Subtitle text: "${subtitle.text}"`);
        console.error(`[Edge TTS] Voice settings: ${voice}, Rate: ${rate}, Volume: ${volume}, Pitch: ${pitch}`);

        const errorResult = {
          subtitle_id: subtitle.id || i,
          text: subtitle.text,
          success: false,
          error: error.message,
          method: 'edge-tts'
        };

        results.push(errorResult);

        try {
          res.write(`data: ${JSON.stringify({
            status: 'error',
            current: i + 1,
            total: subtitles.length,
            result: errorResult
          })}\n\n`);
        } catch (writeError) {
          console.log(`[Edge TTS] Client disconnected during error write at subtitle ${i + 1}, stopping generation`);
          return;
        }
      }
    }

    // Clean up old subtitle directories only on explicit full-run request
    const hasGroupedSubtitles = subtitles.some(subtitle => subtitle.original_ids && subtitle.original_ids.length > 0);
    if (hasGroupedSubtitles && settings?.allowCleanup === true) {
      console.log('Edge TTS: Detected grouped subtitles, cleaning up old directories');
      cleanupOldSubtitleDirectories(subtitles);
    } else if (hasGroupedSubtitles) {
      console.log('Edge TTS: Detected grouped subtitles, but skipping cleanup (no allowCleanup flag)');
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({
      status: 'completed',
      results: results
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('Error in Edge TTS generation:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getVoices,
  generateNarration
};
