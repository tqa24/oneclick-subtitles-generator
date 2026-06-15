// Pure URL validation and ID extraction helpers (zero closures).

// URL validation functions
export const isValidYoutubeUrl = (url) => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
  return youtubeRegex.test(url);
};

export const isValidDouyinUrl = (url) => {
  const douyinRegex = /^(https?:\/\/)?(www\.|v\.)?douyin\.com\/(video\/\d+|[a-zA-Z0-9]+\/?.*)/;
  return douyinRegex.test(url);
};

export const isValidUrl = (url) => {
  if (!url) return false;

  // First, check if it's a valid URL format
  try {
    new URL(url);
  } catch (e) {
    return false;
  }

  // Then check if it has a domain name
  const domainRegex = /^https?:\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?/i;
  return domainRegex.test(url);
};

// ID extraction functions
export const extractYoutubeVideoId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

export const extractDouyinVideoId = (url) => {
  // Extract ID from full URL format: https://www.douyin.com/video/7123456789012345678
  const fullUrlMatch = url.match(/douyin\.com\/video\/(\d+)/);
  if (fullUrlMatch && fullUrlMatch[1]) {
    return fullUrlMatch[1];
  }

  // Extract ID from short URL format: https://v.douyin.com/ABC123/
  const shortUrlMatch = url.match(/v\.douyin\.com\/([a-zA-Z0-9]+)/);
  if (shortUrlMatch && shortUrlMatch[1]) {
    return shortUrlMatch[1];
  }

  return null;
};

export const generateAllSitesVideoId = (url) => {
  // Generate a unique ID based on the URL
  try {
    // First, try to create a more reliable ID
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname.replace(/\//g, '_');

    // Create a base ID from domain and path
    const baseId = `${domain}${path}`.replace(/[^a-zA-Z0-9]/g, '_');

    // Add a timestamp to ensure uniqueness
    const timestamp = Date.now();

    // Combine everything into a valid ID
    return `site_${baseId}_${timestamp}`;
  } catch (error) {
    console.error('Error generating video ID:', error);
    // Fallback to a simpler ID generation
    const timestamp = Date.now();
    return `site_${timestamp}`;
  }
};
