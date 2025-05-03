import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlay, FiPause, FiDownload } from 'react-icons/fi';
import '../../../styles/narration/geminiNarrationResults.css';

// Utility function to convert base64 to ArrayBuffer
const base64ToArrayBuffer = (base64) => {
  try {
    // Remove any whitespace or line breaks that might be in the base64 string
    const cleanBase64 = base64.replace(/\s/g, '');

    // Decode the Base64 string to a binary string
    const binaryString = atob(cleanBase64);
    console.log(`Decoded binary string length: ${binaryString.length} bytes`);

    // Convert the binary string to a Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  } catch (error) {
    console.error('Error decoding Base64 data:', error);
    throw new Error(`Failed to decode Base64 data: ${error.message}`);
  }
};

// Utility function to convert PCM data to Float32Array for better audio processing
const pcmToFloat32 = (pcmData, bitsPerSample = 16) => {
  try {
    console.log(`Converting PCM data: ${pcmData.byteLength} bytes, ${bitsPerSample} bits per sample`);

    // For 16-bit PCM, we need to convert each pair of bytes to a float
    const pcmView = new DataView(pcmData);
    const floatArray = new Float32Array(pcmData.byteLength / 2);

    // Log a sample of the PCM data for debugging
    const sampleValues = [];
    for (let i = 0; i < Math.min(10, floatArray.length); i++) {
      const int16 = pcmView.getInt16(i * 2, true);
      sampleValues.push(int16);
    }
    console.log('PCM data sample values:', sampleValues);

    // Convert all samples to float
    for (let i = 0; i < floatArray.length; i++) {
      // Get 16-bit sample (signed)
      const int16 = pcmView.getInt16(i * 2, true);
      // Convert to float in range [-1, 1]
      floatArray[i] = int16 / 32768.0;
    }

    console.log(`Converted to Float32Array: ${floatArray.length} samples`);
    return floatArray;
  } catch (error) {
    console.error('Error converting PCM to Float32Array:', error);
    throw new Error(`Failed to convert PCM data: ${error.message}`);
  }
};

// Utility function to create a WAV file from PCM data
const createWavFromPcm = (pcmData, sampleRate = 24000) => {
  try {
    // Gemini returns 16-bit PCM data at 24000Hz
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    // Create WAV header (44 bytes)
    const headerLength = 44;
    const wavBuffer = new ArrayBuffer(headerLength + pcmData.byteLength);
    const wavView = new DataView(wavBuffer);

    // "RIFF" chunk descriptor
    writeString(wavView, 0, 'RIFF');
    wavView.setUint32(4, 36 + pcmData.byteLength, true); // Chunk size
    writeString(wavView, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(wavView, 12, 'fmt ');
    wavView.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    wavView.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    wavView.setUint16(22, numChannels, true); // NumChannels
    wavView.setUint32(24, sampleRate, true);  // SampleRate
    wavView.setUint32(28, byteRate, true);    // ByteRate
    wavView.setUint16(32, blockAlign, true);  // BlockAlign
    wavView.setUint16(34, bitsPerSample, true); // BitsPerSample

    // "data" sub-chunk
    writeString(wavView, 36, 'data');
    wavView.setUint32(40, pcmData.byteLength, true); // Subchunk2Size

    // Copy PCM data
    const pcmView = new Uint8Array(pcmData);
    const wavDataView = new Uint8Array(wavBuffer, headerLength);

    // Copy the PCM data into the WAV buffer
    for (let i = 0; i < pcmView.length; i++) {
      wavDataView[i] = pcmView[i];
    }

    console.log(`Created WAV file: ${wavBuffer.byteLength} bytes, sample rate: ${sampleRate}Hz`);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('Error creating WAV file:', error);
    throw error;
  }
};

// Direct method to play PCM audio using Web Audio API
const playPcmWithAudioAPI = (pcmData, sampleRate = 24000) => {
  try {
    console.log(`Playing PCM audio with Web Audio API: ${pcmData.byteLength} bytes at ${sampleRate}Hz`);

    // Convert PCM to float32 for Web Audio API
    const floatData = pcmToFloat32(pcmData);

    // Create audio context with the correct sample rate
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: sampleRate
    });

    console.log(`Created audio context with sample rate: ${audioContext.sampleRate}Hz`);

    // Create buffer with the float data
    const audioBuffer = audioContext.createBuffer(1, floatData.length, sampleRate);

    // Copy the float data to the buffer
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(floatData);

    console.log(`Created audio buffer: ${audioBuffer.duration} seconds, ${audioBuffer.length} samples`);

    // Create a buffer source and connect it to the destination
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Add a gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0; // Full volume

    // Connect the source to the gain node and then to the destination
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Track whether the audio context has been closed
    let isContextClosed = false;

    // Return the source, context, and controls
    return {
      source,
      audioContext,
      gainNode,
      play: () => {
        console.log('Starting audio playback');
        source.start(0);
        return Promise.resolve();
      },
      stop: () => {
        console.log('Stopping audio playback');

        // Only try to stop the source if the context is not closed
        if (!isContextClosed) {
          try {
            source.stop();
          } catch (e) {
            console.warn('Error stopping source:', e);
          }
        }

        // Only try to close the context if it's not already closed
        if (!isContextClosed) {
          try {
            audioContext.close();
            isContextClosed = true;
          } catch (e) {
            console.warn('Error closing audio context:', e);
            // If we get an error about the context being closed, mark it as closed
            if (e.name === 'InvalidStateError' && e.message.includes('closed')) {
              isContextClosed = true;
            }
          }
        }
      },
      getDuration: () => audioBuffer.duration,
      isContextClosed: () => isContextClosed
    };
  } catch (error) {
    console.error('Error creating audio with Web Audio API:', error);
    throw error;
  }
};

// Simpler method to create WAV from PCM for download
const createWavFromPcmForDownload = (pcmData, sampleRate = 24000) => {
  // This is a more reliable method for creating WAV files for download
  try {
    console.log(`Creating WAV file from PCM data: ${pcmData.byteLength} bytes at ${sampleRate}Hz`);

    // Ensure we're working with 16-bit PCM data
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);

    // Create WAV header
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // "RIFF" chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.byteLength, true);
    writeString(view, 8, 'WAVE');

    // "fmt " chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // "data" chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.byteLength, true);

    // Log header information for debugging
    console.log('WAV header created:', {
      format: 'PCM',
      channels: numChannels,
      sampleRate: sampleRate,
      bitsPerSample: bitsPerSample,
      dataSize: pcmData.byteLength
    });

    // Combine header and PCM data
    const wavFile = new Uint8Array(header.byteLength + pcmData.byteLength);
    wavFile.set(new Uint8Array(header), 0);
    wavFile.set(new Uint8Array(pcmData), header.byteLength);

    console.log(`WAV file created: ${wavFile.length} bytes total`);

    return new Blob([wavFile], { type: 'audio/wav' });
  } catch (error) {
    console.error('Error creating WAV file for download:', error);
    throw error;
  }
};

// Helper function to write a string to a DataView
const writeString = (view, offset, string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Component for displaying Gemini narration results with audio playback
 * @param {Object} props - Component props
 * @param {Array} props.generationResults - Array of narration results
 * @returns {JSX.Element} - Rendered component
 */
const GeminiNarrationResults = ({ generationResults }) => {
  const { t } = useTranslation();
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const audioRef = useRef(null);
  // Audio player reference for Web Audio API
  const [activeAudioPlayer, setActiveAudioPlayer] = useState(null);

  // Clean up audio resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any active audio player
      if (activeAudioPlayer) {
        try {
          activeAudioPlayer.stop();
        } catch (error) {
          console.error('Error stopping audio player during cleanup:', error);
        }
      }
    };
  }, [activeAudioPlayer]);

  if (!generationResults || generationResults.length === 0) {
    return null;
  }

  // Play audio from base64 data
  const playAudio = async (result) => {
    // Create a unique ID for this playback request to prevent race conditions
    const playbackId = Date.now();
    const currentPlaybackId = playbackId;

    if (currentlyPlaying === result.subtitle_id) {
      // If already playing this audio, stop it
      if (activeAudioPlayer) {
        try {
          activeAudioPlayer.stop();
        } catch (error) {
          console.warn('Error stopping active audio player:', error);
        }
        setActiveAudioPlayer(null);
      }
      setCurrentlyPlaying(null);
      return;
    }

    // Stop any currently playing audio
    if (activeAudioPlayer) {
      try {
        activeAudioPlayer.stop();
      } catch (error) {
        console.warn('Error stopping active audio player:', error);
      }
      setActiveAudioPlayer(null);
    }

    // Set the current playing ID immediately to prevent race conditions
    setCurrentlyPlaying(result.subtitle_id);

    // Create audio source from base64 data
    if (result.audioData) {
      try {
        // Convert PCM data to audio format for browser playback
        const pcmData = base64ToArrayBuffer(result.audioData);
        // Use the sample rate from the audio data if available, otherwise default to 24000Hz
        const sampleRate = result.sampleRate || 24000;
        console.log(`Using sample rate: ${sampleRate}Hz for audio playback of subtitle ${result.subtitle_id}`);

        // Check if this is still the current playback request
        if (currentPlaybackId !== playbackId) {
          console.log('Playback request superseded by a newer request');
          return;
        }

        // Try direct Web Audio API playback for better quality
        try {
          console.log(`Playing audio for subtitle ${result.subtitle_id} using Web Audio API...`);
          const player = playPcmWithAudioAPI(pcmData, sampleRate);

          // Check if this is still the current playback request
          if (currentPlaybackId !== playbackId) {
            console.log('Playback request superseded by a newer request');
            try {
              player.stop();
            } catch (error) {
              console.warn('Error stopping player:', error);
            }
            return;
          }

          // Set up ended event
          player.source.onended = () => {
            console.log(`Audio playback ended for subtitle ${result.subtitle_id}`);
            // Only clear the currently playing if it's still this subtitle
            if (currentlyPlaying === result.subtitle_id) {
              setCurrentlyPlaying(null);
              setActiveAudioPlayer(null);
            }
          };

          // Start playback
          await player.play();

          // Check if this is still the current playback request
          if (currentPlaybackId !== playbackId) {
            console.log('Playback request superseded by a newer request');
            try {
              player.stop();
            } catch (error) {
              console.warn('Error stopping player:', error);
            }
            return;
          }

          setActiveAudioPlayer(player);
          console.log(`Playing audio with duration: ${player.getDuration()} seconds for subtitle ${result.subtitle_id}`);
        } catch (webAudioError) {
          console.warn(`Web Audio API method failed for subtitle ${result.subtitle_id}, falling back to HTML Audio element:`, webAudioError);

          // Check if this is still the current playback request
          if (currentPlaybackId !== playbackId) {
            console.log('Playback request superseded by a newer request');
            return;
          }

          // Fallback to HTML Audio element with WAV file
          const wavBlob = createWavFromPcmForDownload(pcmData, sampleRate);
          const audioUrl = URL.createObjectURL(wavBlob);

          audioRef.current.src = audioUrl;
          audioRef.current.play()
            .then(() => {
              // Check if this is still the current playback request
              if (currentPlaybackId !== playbackId) {
                console.log('Playback request superseded by a newer request');
                audioRef.current.pause();
                return;
              }
            })
            .catch(err => {
              console.error(`Error playing audio with fallback method for subtitle ${result.subtitle_id}:`, err);
              // Only clear the currently playing if it's still this subtitle
              if (currentlyPlaying === result.subtitle_id) {
                setCurrentlyPlaying(null);
              }
              alert(t('narration.playbackError', 'Error playing audio'));
            });
        }
      } catch (error) {
        console.error(`Error processing audio data for subtitle ${result.subtitle_id}:`, error);
        // Only clear the currently playing if it's still this subtitle
        if (currentlyPlaying === result.subtitle_id) {
          setCurrentlyPlaying(null);
        }
        alert(t('narration.processingError', 'Error processing audio data'));
      }
    }
  };

  // Handle audio ended event
  const handleAudioEnded = () => {
    setCurrentlyPlaying(null);
  };

  // Download audio as WAV file
  const downloadAudio = async (result) => {
    if (result.audioData) {
      try {
        // Convert PCM data to WAV format for download
        const pcmData = base64ToArrayBuffer(result.audioData);
        // Use the sample rate from the audio data if available, otherwise default to 24000Hz
        const sampleRate = result.sampleRate || 24000;
        console.log(`Using sample rate: ${sampleRate}Hz for audio download`);

        // Use the specialized download method for better compatibility
        const wavBlob = createWavFromPcmForDownload(pcmData, sampleRate);

        // Create download link
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `narration_${result.subtitle_id}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`Downloaded WAV file for subtitle ${result.subtitle_id}`);
      } catch (error) {
        console.error('Error creating WAV file for download:', error);
        alert(t('narration.downloadError', 'Error creating WAV file for download'));
      }
    }
  };

  // Download all audio files as a zip
  const downloadAllAudio = () => {
    // For now, just alert that this feature is not implemented
    // In a real implementation, you would use JSZip or similar to create a zip file
    alert(t('narration.downloadAllNotImplemented', 'Download all functionality not implemented yet'));
  };

  return (
    <div className="gemini-narration-results">
      <h4>{t('narration.geminiResults', 'Generated Narration (Gemini)')}</h4>

      <div className="gemini-results-list">
        {generationResults.map((result) => (
          <div
            key={result.subtitle_id}
            className={`gemini-result-item ${result.success ? '' : 'failed'}`}
          >
            <div className="gemini-result-header">
              <span className="gemini-result-id">{result.subtitle_id}.</span>
              <div className="gemini-result-text">
                {result.text}
              </div>
              {result.success && result.audioData && (
                <div className="audio-controls">
                  <button
                    className={`play-btn ${currentlyPlaying === result.subtitle_id ? 'playing' : ''}`}
                    onClick={() => playAudio(result)}
                    title={currentlyPlaying === result.subtitle_id ?
                      t('narration.pause', 'Pause') :
                      t('narration.play', 'Play')}
                  >
                    {currentlyPlaying === result.subtitle_id ? <FiPause size={16} /> : <FiPlay size={16} />}
                  </button>
                  <button
                    className="download-btn"
                    onClick={() => downloadAudio(result)}
                    title={t('narration.download', 'Download')}
                  >
                    <FiDownload size={16} />
                  </button>
                </div>
              )}
            </div>

            {!result.success && (
              <div className="gemini-error-message">
                {t('narration.generationFailed', 'Generation failed')}: {result.error || t('narration.unknownError', 'Unknown error')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Download all button */}
      {generationResults.length > 0 && generationResults.some(r => r.success && r.audioData) && (
        <div className="gemini-export-controls">
          <button
            className="gemini-export-btn"
            onClick={downloadAllAudio}
          >
            {t('narration.downloadAll', 'Download All Audio')}
          </button>
        </div>
      )}

      {/* Hidden audio player for playback */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default GeminiNarrationResults;
