import { createLoadingOverlay } from '../utils/loadingOverlayFactory';
import { getAudioUrl } from '../../../services/narrationService';

/**
 * Narration audio playback + bulk download.
 *
 * @param {Object} params - State/setters threaded from the generation hook.
 * @returns {{ playAudio: Function, downloadAllAudio: Function }}
 */
const useNarrationDownloads = ({
  generationResults,
  currentAudio,
  setCurrentAudio,
  isPlaying,
  setIsPlaying,
  t,
}) => {
  // Play a specific narration audio (always fetch fresh from filesystem)
  const playAudio = async (result) => {
    try {
      // If already playing this audio, toggle off
      if (isPlaying && currentAudio && currentAudio.id === result.subtitle_id) {
        setIsPlaying(false);
        return;
      }

      // Revoke previous blob URL if any
      try {
        if (currentAudio && currentAudio.url && currentAudio.url.startsWith('blob:')) {
          URL.revokeObjectURL(currentAudio.url);
        }
      } catch (_) { /* noop */ }

      // Build cache-busting URL to force fresh read from narration/output
      const baseUrl = getAudioUrl(result.filename);
      const cacheBustUrl = `${baseUrl}?t=${Date.now()}`;

      // Fetch the file and create a blob URL to guarantee latest content
      const response = await fetch(cacheBustUrl, {
        headers: { 'Accept': 'audio/*' },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Set the audio source to the blob URL so it cannot be cached
      setCurrentAudio({ id: result.subtitle_id, url: blobUrl, ts: Date.now() });
      setIsPlaying(true);
    } catch (e) {
      console.error('Error playing audio from filesystem:', e);
      // Fallback: try direct URL with cache bust (without blob)
      const fallbackUrl = `${getAudioUrl(result.filename)}?t=${Date.now()}`;
      setCurrentAudio({ id: result.subtitle_id, url: fallbackUrl, ts: Date.now() });
      setIsPlaying(true);
    }
  };

  // Download all narration audio as a zip file
  const downloadAllAudio = async () => {
    // Check if we have any generation results
    if (!generationResults || generationResults.length === 0) {
      alert(t('narration.noResults', 'No narration results to download'));
      return;
    }

    // Create a React-based loading overlay
    const loadingOverlay = createLoadingOverlay(t('narration.downloading', 'Downloading audio files...'));

    try {
      // Get the server URL from the narration service
      const { SERVER_URL } = require('../../../config');

      // Extract filenames from generation results
      const filenames = generationResults.map(result => result.filename);


      // Create a download link with the filenames as query parameters
      const downloadUrl = `${SERVER_URL}/api/narration/download-all`;

      // Use fetch API to download the file

      const response = await fetch(downloadUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/octet-stream'
        },
        body: JSON.stringify({ filenames })
      });


      // Check if the response is successful
      if (!response.ok) {
        // Try to parse error message if it's JSON
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to download audio files');
        } catch (jsonError) {
          // If it's not JSON, use the status text
          throw new Error(`Failed to download audio files: ${response.statusText}`);
        }
      }

      // Get the blob from the response
      const blob = await response.blob();


      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = 'narration_audio.zip';
      a.target = '_blank'; // Open in a new tab to avoid redirecting
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error downloading all audio:', error);
      alert(t('narration.downloadError', `Error downloading audio files: ${error.message}`));
    } finally {
      // Remove loading overlay
      loadingOverlay.destroy();
    }
  };

  return { playAudio, downloadAllAudio };
};

export default useNarrationDownloads;
