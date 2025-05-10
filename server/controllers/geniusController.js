/**
 * Controller for Genius API operations
 */
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { VIDEOS_DIR } = require('../config');
const cheerio = require('cheerio');
const crypto = require('crypto');

// Directory for storing album art
const ALBUM_ART_DIR = path.join(process.cwd(), 'public', 'videos', 'album_art');
const LYRICS_DIR = path.join(VIDEOS_DIR, 'lyrics');

/**
 * Get lyrics from Genius API
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLyrics = async (req, res) => {
  try {
    const { artist, song, force } = req.body;

    if (!artist || !song) {
      return res.status(400).json({ error: 'Missing artist or song' });
    }

    // Create a hash of the artist and song to use as a unique identifier
    const hash = crypto.createHash('md5').update(`${artist}_${song}`).digest('hex');
    const safeName = hash.substring(0, 10); // Use first 10 characters of hash for brevity



    const lyricsFilePath = path.join(LYRICS_DIR, `${safeName}.txt`);

    // Ensure directories exist
    await fs.mkdir(LYRICS_DIR, { recursive: true });
    await fs.mkdir(ALBUM_ART_DIR, { recursive: true });

    // Check if we have cached lyrics and force is not true
    let cachedLyrics = null;
    let cachedAlbumArtUrl = null;

    if (!force) {
      try {
        const lyricsExists = await fs.access(lyricsFilePath).then(() => true).catch(() => false);

        if (lyricsExists) {
          cachedLyrics = await fs.readFile(lyricsFilePath, 'utf-8');

          // Check for album art with any extension
          const albumArtFiles = await fs.readdir(ALBUM_ART_DIR);
          const albumArtFile = albumArtFiles.find(file => file.startsWith(safeName + '.'));

          if (albumArtFile) {
            cachedAlbumArtUrl = `/videos/album_art/${albumArtFile}`;
          }



          if (cachedLyrics && cachedAlbumArtUrl) {
            return res.json({
              lyrics: cachedLyrics,
              albumArtUrl: cachedAlbumArtUrl
            });
          }
        }
      } catch (cacheError) {
        console.error('Error checking cache:', cacheError);
        // Continue to fetch from API if cache check fails
      }
    }

    // Get Genius API key from localStorage
    let geniusApiKey = null;
    try {
      const localStoragePath = path.join(process.cwd(), 'localStorage.json');
      const localStorageData = await fs.readFile(localStoragePath, 'utf-8');
      const localStorage = JSON.parse(localStorageData);
      geniusApiKey = localStorage.genius_token;
    } catch (localStorageError) {
      console.error('Error reading localStorage file:', localStorageError);
    }

    if (!geniusApiKey) {
      return res.status(400).json({ error: 'Genius API key not set. Please provide it through the settings.' });
    }

    // Search for the song on Genius
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${song}`)}`;


    const searchResponse = await axios.get(searchUrl, {
      headers: {
        'Authorization': `Bearer ${geniusApiKey}`
      }
    });

    if (!searchResponse.data.response.hits.length) {
      return res.status(404).json({ error: 'No results found on Genius' });
    }

    // Get the first hit
    const hit = searchResponse.data.response.hits[0];
    const songUrl = hit.result.url;
    const albumArtUrl = hit.result.song_art_image_url || hit.result.header_image_url;





    // Get the lyrics from the song page
    const lyricsPageResponse = await axios.get(songUrl);
    const html = lyricsPageResponse.data;

    // Use cheerio to parse the HTML
    const $ = cheerio.load(html);

    // Try different selectors to find lyrics
    let lyrics = '';

    // Method 1: Look for the lyrics div
    const lyricsDiv = $('.lyrics');
    if (lyricsDiv.length > 0) {
      lyrics = lyricsDiv.text().trim();

    }

    // Method 2: Look for lyrics in the new Genius format
    if (!lyrics) {
      const lyricsSections = $('[data-lyrics-container="true"]');
      if (lyricsSections.length > 0) {
        lyrics = '';
        lyricsSections.each((i, el) => {
          // Replace <br> tags with newlines before getting text
          $(el).find('br').replaceWith('\n');
          lyrics += $(el).text() + '\n';
        });
        lyrics = lyrics.trim();

      }
    }

    // Method 3: Look for lyrics in another common format
    if (!lyrics) {
      const lyricsContainer = $('.song_body-lyrics');
      if (lyricsContainer.length > 0) {
        lyrics = lyricsContainer.text().trim();

      }
    }

    // Method 4: Try to find any element with "lyrics" in its class
    if (!lyrics) {
      $('[class*="lyrics"], [class*="Lyrics"]').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > lyrics.length) {
          lyrics = text;
        }
      });
      if (lyrics) {

      }
    }

    // If we still couldn't extract lyrics, return a placeholder
    if (!lyrics) {

      lyrics = `Lyrics for "${song}" by ${artist}\n\nCouldn't extract lyrics from Genius.\nPlease visit ${songUrl} to view the lyrics.`;
    } else {
      // Clean up the lyrics
      lyrics = lyrics
        .replace(/\\n/g, '\n')  // Replace escaped newlines with actual newlines
        .replace(/\n{3,}/g, '\n\n')  // Replace multiple newlines with just two
        .trim();

    }

    // Save lyrics to file
    await fs.writeFile(lyricsFilePath, lyrics, 'utf-8');


    // Download and save album art if available
    let localAlbumArtUrl = '';
    if (albumArtUrl) {
      try {


        const imageResponse = await axios({
          method: 'get',
          url: albumArtUrl,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        // Determine the appropriate file extension based on content type
        const contentType = imageResponse.headers['content-type'];
        let extension = 'jpg'; // Default extension

        if (contentType === 'image/png') {
          extension = 'png';
        } else if (contentType === 'image/gif') {
          extension = 'gif';
        } else if (contentType === 'image/webp') {
          extension = 'webp';
        }

        // Save the album art with the appropriate extension
        const albumArtFilePath = path.join(ALBUM_ART_DIR, `${safeName}.${extension}`);
        await fs.writeFile(albumArtFilePath, Buffer.from(imageResponse.data), 'binary');

        localAlbumArtUrl = `/videos/album_art/${safeName}.${extension}`;

      } catch (imageError) {
        console.error('Error downloading album art:', imageError.message);
      }
    }

    return res.json({
      lyrics,
      albumArtUrl: localAlbumArtUrl
    });
  } catch (error) {
    console.error('Error in getLyrics:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getLyrics
};
