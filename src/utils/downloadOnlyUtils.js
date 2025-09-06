/**
 * Utility functions for download-only functionality
 */

const SERVER_URL = 'http://localhost:3031';

/**
 * Cancel an active download-only process
 * @param {string} videoId - The video ID to cancel
 * @returns {Promise<boolean>} - Success status
 */
export const cancelDownloadOnly = async (videoId) => {
  try {
    console.log('[DownloadOnly] Cancelling download:', videoId);

    const response = await fetch(`${SERVER_URL}/api/cancel-download-only/${videoId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[DownloadOnly] Failed to cancel download:', errorData.error);
      return false;
    }

    const data = await response.json();
    console.log('[DownloadOnly] Server cancel response:', data);
    return true;
  } catch (error) {
    console.error('[DownloadOnly] Error cancelling download:', error);
    return false;
  }
};
