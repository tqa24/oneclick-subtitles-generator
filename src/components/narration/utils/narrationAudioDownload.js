import { SERVER_URL } from '../../../config';

/**
 * Download a narration audio file as a WAV via the browser.
 * @param {Object} result - Narration result (needs filename + subtitle_id)
 * @param {Function} getAudioUrl - Resolves a filename to a playable URL
 * @param {Function} t - i18next translation function (for error messages)
 */
export const downloadAudio = (result, getAudioUrl, t) => {
  if (result.filename) {
    try {


      // Get the audio URL
      const audioUrl = getAudioUrl(result.filename);


      // Use fetch to get the file as a blob
      fetch(audioUrl)

        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          // Create a blob URL
          const blobUrl = URL.createObjectURL(blob);

          // Create a download link
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `narration_${result.subtitle_id}.wav`;
          a.style.display = 'none';
          document.body.appendChild(a);

          // Trigger the download
          a.click();

          // Clean up
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          }, 100);


        })
        .catch(error => {
          console.error('Error downloading audio file:', error);
          alert(t('narration.downloadError', `Error downloading audio file: ${error.message}`));
        });
    } catch (error) {
      console.error('Error initiating download:', error);
      alert(t('narration.downloadError', `Error initiating download: ${error.message}`));
    }
  } else {
    console.error('No filename available for download');
    alert(t('narration.downloadError', 'No audio file available for download'));
  }
};

/**
 * Persist F5-TTS PCM audio data to the server, returning the saved filename.
 * @param {Object} result - Narration result containing audioData
 * @returns {Promise<string|null>} The saved filename, or null on failure
 */
export const saveAudioToServer = async (result) => {
  if (!result || !result.audioData) return null;

  try {
    // Send the audio data to the server
    const response = await fetch(`${SERVER_URL}/api/narration/save-f5tts-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData: result.audioData,
        subtitle_id: result.subtitle_id,
        sampleRate: result.sampleRate || 24000,
        mimeType: result.mimeType || 'audio/pcm'
      })
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    if (data.success) {
      // Return the filename
      return data.filename;
    } else {
      throw new Error(data.error || 'Unknown error saving audio to server');
    }
  } catch (error) {
    console.error(`Error saving audio for subtitle ${result.subtitle_id}:`, error);
    return null;
  }
};
