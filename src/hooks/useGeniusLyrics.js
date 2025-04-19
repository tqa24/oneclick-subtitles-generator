import { useState } from 'react';
import { API_BASE_URL } from '../config';

/**
 * Custom hook for fetching lyrics from Genius API
 * @returns {Object} - Lyrics fetching state and functions
 */
const useGeniusLyrics = () => {
  const [lyrics, setLyrics] = useState('');
  const [albumArtUrl, setAlbumArtUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch lyrics from Genius API
   * @param {string} artist - Artist name
   * @param {string} song - Song name
   * @param {boolean} force - Force refetch even if cached
   * @returns {Promise<Object>} - Lyrics and album art URL
   */
  const fetchLyrics = async (artist, song, force = false) => {
    if (!artist || !song) {
      setError('Artist and song name are required');
      return null;
    }

    try {
      setError(null);
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist,
          song,
          force
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch lyrics');
      }

      const data = await response.json();

      if (data.lyrics) {
        // Clean up the lyrics by splitting into lines and filtering empty ones
        const lyricsText = data.lyrics;
        setLyrics(lyricsText);
        setAlbumArtUrl(data.albumArtUrl || '');
        return data;
      }

      return null;
    } catch (err) {
      setError(`Lyrics fetch failed: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear the current lyrics and album art
   */
  const clearLyrics = () => {
    setLyrics('');
    setAlbumArtUrl('');
  };

  return {
    lyrics,
    albumArtUrl,
    loading,
    error,
    fetchLyrics,
    clearLyrics
  };
};

export default useGeniusLyrics;
