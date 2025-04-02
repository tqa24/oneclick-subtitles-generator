/**
 * Utilities for handling caching of subtitles
 */

/**
 * Generate a cache ID for a file by creating a hash of its content
 * @param {File} file - The file to hash
 * @returns {Promise<string>} - A promise that resolves to the cache ID
 */
export const generateFileCacheId = async (file) => {
  try {
    // For files, generate a hash based on the first 1MB of content + filename + size
    // This is a good balance between uniqueness and performance
    const maxBytes = 1024 * 1024; // 1MB
    const bytes = await readFileChunk(file, 0, Math.min(maxBytes, file.size));
    
    // Combine with filename and size for better uniqueness
    const fileInfo = `${file.name}_${file.size}_${file.type}`;
    const dataToHash = bytes + fileInfo;
    
    // Generate hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataToHash));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Error generating file cache ID:', error);
    // Fallback to a less reliable but still useful ID
    return `${file.name.replace(/[^a-z0-9]/gi, '')}_${file.size}_${Date.now()}`;
  }
};

/**
 * Read a chunk of a file as text
 * @param {File} file - The file to read
 * @param {number} start - The start byte position
 * @param {number} end - The end byte position
 * @returns {Promise<string>} - A promise that resolves to the chunk as text
 */
const readFileChunk = (file, start, end) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file.slice(start, end));
  });
};