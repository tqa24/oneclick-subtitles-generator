import { getAudioUrl } from '../../../services/narrationService';

// Gated debug logging (enable in the browser console: localStorage.debug_logs = 'true')
const DEBUG_LOGS = (typeof window !== 'undefined') && (localStorage.getItem('debug_logs') === 'true');
const dbg = (...args) => { if (DEBUG_LOGS) console.log(...args); };

/**
 * Play a narration result directly from the server URL (no cache, no blob persistence).
 * Toggles off if the same item is already playing.
 *
 * @param {Object} result - The narration result to play (needs filename + subtitle_id)
 * @param {Object} deps - Bound state/refs from the host component
 * @param {Object} deps.audioRef - Ref holding the active Audio element
 * @param {*} deps.currentlyPlaying - Currently playing subtitle id
 * @param {boolean} deps.isPlaying - Whether audio is currently playing
 * @param {Function} deps.setCurrentlyPlaying - Setter for currentlyPlaying
 * @param {Function} deps.setIsPlaying - Setter for isPlaying
 */
export const playAudio = async (result, { audioRef, currentlyPlaying, isPlaying, setCurrentlyPlaying, setIsPlaying }) => {
  if (!result?.filename) return;

  // Toggle off if the same item is already playing
  if (currentlyPlaying === result.subtitle_id && isPlaying) {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_) {}
      try {
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      } catch (_) {}
    }
    setIsPlaying(false);
    setCurrentlyPlaying(null);
    return;
  }

  // Stop any currently playing audio and revoke blob URL
  if (audioRef.current) {
    try { audioRef.current.pause(); } catch (_) {}
    try {
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    } catch (_) {}
  }

  // Build cache-busting URL and fetch fresh file like other methods
  const baseUrl = getAudioUrl(result.filename);
  const cacheBustUrl = `${baseUrl}?t=${Date.now()}`;
  dbg(`[DEBUG] Playing audio via fresh fetch: ${cacheBustUrl}`);

  try {
    const resp = await fetch(cacheBustUrl, {
      headers: { 'Accept': 'audio/*' },
      credentials: 'include'
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);

    const audio = new Audio(blobUrl);
    audio.preload = 'none';
    audio.onerror = (e) => {
      console.error(`[DEBUG] Audio error for subtitle ${result.subtitle_id}:`, e);
      console.error(`[DEBUG] Audio src:`, audio.src);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentlyPlaying(null);
      try {
        if (audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
      } catch (_) {}
    };

    setCurrentlyPlaying(result.subtitle_id);
    setIsPlaying(true);

    audio.play().catch((err) => {
      console.error('[DEBUG] Error playing audio:', err);
      setIsPlaying(false);
      setCurrentlyPlaying(null);
      try {
        if (audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
      } catch (_) {}
    });

    audioRef.current = audio;
  } catch (e) {
    console.error('[DEBUG] Failed to fetch fresh audio, falling back to direct URL:', e);
    const audio = new Audio(cacheBustUrl);
    audio.preload = 'none';
    audio.onerror = (err) => {
      console.error('[DEBUG] Fallback audio error:', err);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentlyPlaying(null);
    };
    setCurrentlyPlaying(result.subtitle_id);
    setIsPlaying(true);
    audio.play().catch(() => {
      setIsPlaying(false);
      setCurrentlyPlaying(null);
    });
    audioRef.current = audio;
  }
};

/**
 * Download a narration result as a WAV file.
 *
 * @param {Object} result - The narration result to download (needs filename + subtitle_id)
 * @param {Function} t - i18n translation function
 */
export const downloadAudio = (result, t) => {
  if (result.filename) {
    try {
      dbg(`[DEBUG] Downloading audio with filename: ${result.filename}`);

      // Get the audio URL
      const audioUrl = getAudioUrl(result.filename);
      dbg(`[DEBUG] Download URL: ${audioUrl}`);

      // Add a cache-busting parameter to the URL
      const cacheBustUrl = `${audioUrl}?t=${Date.now()}`;
      dbg(`[DEBUG] Cache-busting download URL: ${cacheBustUrl}`);

      // Use fetch to get the file as a blob
      fetch(cacheBustUrl)
        .then(response => {
          dbg(`[DEBUG] Download fetch response status: ${response.status}`);
          if (!response.ok) {
            console.error(`[DEBUG] Download fetch failed: ${response.status} ${response.statusText}`);
            const errorMsg = `Server responded with ${response.status}: ${response.statusText}`;
            window.addToast(t('narration.downloadError', `Error downloading audio file: ${errorMsg}`), 'error');
            throw new Error(errorMsg);
          }
          return response.blob();
        })
        .then(blob => {
          dbg(`[DEBUG] Got blob for download, size: ${blob.size} bytes, type: ${blob.type}`);

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
          console.error('[DEBUG] Error downloading audio file:', error);
          window.addToast(t('narration.downloadError', `Error downloading audio file: ${error.message}`), 'error');
        });
    } catch (error) {
      console.error('[DEBUG] Error initiating download:', error);
      alert(t('narration.downloadError', `Error initiating download: ${error.message}`));
    }
  } else {
    console.error('[DEBUG] No filename available for download');
    window.addToast(t('narration.downloadError', 'No audio file available for download'), 'error');
  }
};
