/**
 * Resolve the Gemini Files-API cache entry for a media file.
 *
 * Single source for the cache-key + reuse logic the callGeminiApi* paths used to inline three
 * times: a URL-based key for downloaded videos (`gemini_file_url_<hash>`) or a file-based key
 * (`gemini_file_<name>_<size>_<mtime>`), with YouTube URLs reused directly (no Files API upload).
 *
 * @param {File} file
 * @param {string} [logTag='[GeminiAPI]'] - prefix for the cache-key log lines
 * @returns {Promise<{fileKey: string, uploadedFile: object|null, currentVideoUrl: string|null, isYouTube: boolean}>}
 */
export const resolveGeminiFileCache = async (file, logTag = '[GeminiAPI]') => {
  const currentVideoUrl = localStorage.getItem('current_video_url');

  let fileKey;
  if (currentVideoUrl) {
    // Downloaded video - use URL-based caching for consistency
    const { generateUrlBasedCacheId } = await import('../../services/subtitleCache');
    const urlBasedId = await generateUrlBasedCacheId(currentVideoUrl);
    fileKey = `gemini_file_url_${urlBasedId}`;
    console.log(`${logTag} Using URL-based cache key for downloaded video:`, fileKey);
  } else {
    // Uploaded file - use file-based caching
    const lastModified = file.lastModified || Date.now();
    fileKey = `gemini_file_${file.name}_${file.size}_${lastModified}`;
    console.log(`${logTag} Using file-based cache key for uploaded file:`, fileKey);
  }

  let uploadedFile = JSON.parse(localStorage.getItem(fileKey) || 'null');
  const isYouTube = !!(currentVideoUrl && /(youtube\.com|youtu\.be)\//.test(currentVideoUrl));
  if (isYouTube) {
    // YouTube videos skip Files API upload; use the URL directly
    uploadedFile = { uri: currentVideoUrl, mimeType: file?.type };
  }

  return { fileKey, uploadedFile, currentVideoUrl, isYouTube };
};
