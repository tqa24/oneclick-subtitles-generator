/**
 * Douyin URL normalization
 */

/**
 * Normalize Douyin URL to ensure it's in the correct format
 * @param {string} url - The Douyin URL to normalize
 * @returns {string} - Normalized URL
 */
function normalizeDouyinUrl(url) {
  // If it's a short URL (v.douyin.com), make sure it has https:// prefix
  if (url.includes('v.douyin.com') && !url.startsWith('http')) {
    return `https://${url}`;
  }

  // If it's a full URL (www.douyin.com), make sure it has https:// prefix
  if (url.includes('douyin.com') && !url.startsWith('http')) {
    return `https://${url}`;
  }

  // Remove trailing slashes for consistency
  let normalizedUrl = url;
  while (normalizedUrl.endsWith('/')) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }

  // Special handling for short URLs to ensure they work properly
  if (normalizedUrl.includes('v.douyin.com')) {
    // Make sure the URL ends with a slash for short URLs
    if (!normalizedUrl.endsWith('/')) {
      normalizedUrl = `${normalizedUrl}/`;
    }


  }

  return normalizedUrl;
}

module.exports = {
  normalizeDouyinUrl
};
