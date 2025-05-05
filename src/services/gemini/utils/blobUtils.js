/**
 * Utility functions for handling blobs
 */

/**
 * Convert a blob to JSON
 * @param {Blob} blob - Blob to convert
 * @returns {Promise<Object|null>} - Parsed JSON object or null if parsing fails
 */
export const blobToJSON = async (blob) => {
  const text = await blob.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Error parsing JSON from blob:', e);
    return null;
  }
};
