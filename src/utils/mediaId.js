/** localStorage keys identifying the current media. */
export const CURRENT_VIDEO_ID_KEY = 'current_video_url';
export const CURRENT_FILE_ID_KEY = 'current_file_cache_id';

/**
 * Identifier for the media currently being worked on: the 11-character YouTube video id when a
 * YouTube URL is active, otherwise the file cache id (or null).
 *
 * Single source for the copy that lived in useTranslationState and GeminiNarrationResults.
 * @returns {string|null}
 */
export const getCurrentMediaId = () => {
  const youtubeUrl = localStorage.getItem(CURRENT_VIDEO_ID_KEY);
  if (youtubeUrl) {
    const match = youtubeUrl.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return match ? match[1] : null;
  }
  return localStorage.getItem(CURRENT_FILE_ID_KEY);
};
