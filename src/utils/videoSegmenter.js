/**
 * Utility functions for handling video segmentation
 * This allows processing long videos by splitting them into smaller segments
 */

// Server URL for the local server - using unified port configuration
const SERVER_URL = 'http://localhost:3031'; // Backend server port

/**
 * Extract a video segment locally on the server using ffmpeg and return it as a File
 * @param {File} videoFile - Source video file
 * @param {number} startSec - Start time in seconds
 * @param {number} endSec - End time in seconds
 * @returns {Promise<File>} - Extracted segment as a File
 */
export const extractVideoSegmentLocally = async (videoFile, startSec, endSec, options = {}) => {
  const url = `${SERVER_URL}/api/extract-video-segment?start=${encodeURIComponent(startSec)}&end=${encodeURIComponent(endSec)}`;
  const formData = new FormData();
  formData.append('file', videoFile);

  const headers = {};
  const runId = options && options.runId ? options.runId : undefined;
  if (runId) headers['X-Run-Id'] = runId;

  const res = await fetch(url, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    let msg = `Failed to extract segment (Status: ${res.status})`;
    try { const data = await res.json(); if (data?.error) msg = data.error; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  const clipUrl = data.url?.startsWith('http') ? data.url : `${SERVER_URL}${data.url}`;
  const resp2 = await fetch(clipUrl, { headers });
  if (!resp2.ok) throw new Error(`Failed to fetch extracted segment: ${resp2.statusText}`);
  const blob = await resp2.blob();
  const name = (clipUrl.split('/').pop()) || 'segment.mp4';

  // Cache mapping for offline refresh: per current video
  try {
    const videoKey = localStorage.getItem('current_file_cache_id')
      || localStorage.getItem('current_file_url')
      || localStorage.getItem('current_video_url')
      || (videoFile && (videoFile.__cacheId || `${videoFile.name}|${videoFile.size}`));
    if (videoKey) {
      const raw = localStorage.getItem('offline_segments_cache');
      const cache = raw ? JSON.parse(raw) : {};
      const list = Array.isArray(cache[videoKey]) ? cache[videoKey] : [];
      // Avoid duplicate entries for the same exact range
      const exists = list.some(e => Math.abs(e.start - startSec) < 1e-6 && Math.abs(e.end - endSec) < 1e-6);
      if (!exists) {
        list.push({ start: startSec, end: endSec, url: clipUrl, name, createdAt: Date.now() });
        cache[videoKey] = list;
        localStorage.setItem('offline_segments_cache', JSON.stringify(cache));
      }
      // Notify UI about availability
      try {
        window.dispatchEvent(new CustomEvent('offline-segment-cached', { detail: { start: startSec, end: endSec, url: clipUrl, name } }));
      } catch {}
    }
  } catch {}

  return new File([blob], name, { type: blob.type || 'video/mp4' });
};
