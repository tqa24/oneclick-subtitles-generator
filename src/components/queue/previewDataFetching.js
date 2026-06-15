import { extractVideoIdFromUrl } from './queueHelpers';

// Fetch detailed media info via server (ffprobe-backed). Returns data object or null.
export const fetchPreviewInfo = async (url) => {
  // If it's a server-hosted /videos/ URL, use id-based endpoint
  if (url && url.includes('/videos/')) {
    const id = extractVideoIdFromUrl(url);
    if (!id) return null;
    const endpoints = [
      `${window.location.origin}/api/video-dimensions/${id}`,
      `http://localhost:3031/api/video-dimensions/${id}`
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.success) {
          return data;
        }
      } catch (e) {
        // try next endpoint
        continue;
      }
    }
    return null;
  }

  // Otherwise, probe the absolute URL via /api/probe-media
  try {
    const absolute = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const endpoints = [
      `${window.location.origin}/api/probe-media?url=${encodeURIComponent(absolute)}`,
      `http://localhost:3031/api/probe-media?url=${encodeURIComponent(absolute)}`
    ];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.success) {
          return data;
        }
      } catch (e) {
        // try next endpoint
        continue;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
};

// Fetch extra file info (size, createdAt) from /video-exists. Returns { size, createdAt } or null.
export const fetchPreviewExtra = async (url) => {
  const id = extractVideoIdFromUrl(url);
  if (!id) return null;
  try {
    const res = await fetch(`${window.location.origin}/api/video-exists/${id}`);
    const data = await res.json();
    if (data && data.exists) {
      return { size: data.size, createdAt: data.createdAt };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Fallback: try a HEAD request to get Content-Length and Last-Modified.
// Returns { size, createdAt } or null.
export const fetchHeadInfo = async (url) => {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const len = res.headers.get('content-length');
    const lm = res.headers.get('last-modified');
    const size = len ? parseInt(len) : null;
    return {
      size: Number.isFinite(size) ? size : null,
      createdAt: lm || null
    };
  } catch (_) {
    // ignore
    return null;
  }
};
