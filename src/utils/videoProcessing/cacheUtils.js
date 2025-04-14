/**
 * Utilities for cache management in video processing
 */

/**
 * Generate a cache ID for a media file
 * @param {File} mediaFile - The media file
 * @returns {string} - Cache ID
 */
export const getCacheIdForMedia = (mediaFile) => {
  if (!mediaFile) return null;

  // For files, use the file name without extension as the cache ID
  const fileName = mediaFile.name;
  const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

  // Add a hash based on file size and last modified date for uniqueness
  const fileSize = mediaFile.size;
  const lastModified = mediaFile.lastModified || Date.now();
  const hash = `${fileSize}_${lastModified}`;

  return `${fileNameWithoutExt}_${hash}`;
};
