/**
 * Client helpers for the local video-renderer server.
 *
 * Extracted from VideoRenderingSection — these close over no component state. The base URL is
 * centralized here so every renderer call site shares one constant.
 */

export const RENDERER_BASE_URL = 'http://localhost:3033';

/** Upload a File to the renderer and return the stored filename. */
export const uploadFileToRenderer = async (file, type = 'video') => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${RENDERER_BASE_URL}/upload/${type}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload ${type}`);
  }

  const data = await response.json();
  return data.filename;
};

/** Download a (non-blob) video URL and upload it to the renderer; returns the stored filename. */
export const downloadVideoFromUrl = async (videoUrl) => {
  if (videoUrl.startsWith('blob:')) {
    throw new Error('Blob URLs cannot be downloaded from server. Please upload the original file.');
  }

  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error('Failed to download video from URL');
  }

  const blob = await response.blob();
  const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
  return uploadFileToRenderer(file, 'video');
};

/** Fetch a blob: URL and wrap it in a File object for upload. */
export const convertBlobUrlToFile = async (blobUrl, filename = 'video.mp4') => {
  try {
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch blob');
    }
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type || 'video/mp4' });
  } catch (error) {
    console.error('Error converting blob URL to file:', error);
    throw new Error('Failed to convert blob URL to file');
  }
};
