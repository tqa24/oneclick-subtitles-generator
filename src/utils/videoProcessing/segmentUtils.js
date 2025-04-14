/**
 * Utilities for segment management in video processing
 */

/**
 * Create a function to update segment status
 * @param {Array} segmentStatusArray - Array to track segment status
 * @param {Function} t - Translation function
 * @returns {Function} - Function to update segment status
 */
export const createSegmentStatusUpdater = (segmentStatusArray, t) => {
  /**
   * Update segment status
   * @param {number} index - Segment index
   * @param {string} status - Status (loading, success, error, cached, pending)
   * @param {string} message - Status message
   * @param {string} timeRange - Time range for the segment
   */
  return (index, status, message, timeRange = null) => {
    // Update the status array
    segmentStatusArray[index] = {
      index,
      status,
      message,
      timeRange,
      // Use simple status indicators without segment numbers
      shortMessage: status === 'loading' ? t('output.processing') :
                   status === 'success' ? t('output.done') :
                   status === 'error' ? t('output.failed') :
                   status === 'cached' ? t('output.cached') :
                   status === 'pending' ? t('output.pending') : ''
    };

    // Dispatch event to update UI
    const event = new CustomEvent('segmentStatusUpdate', {
      detail: [...segmentStatusArray]
    });
    window.dispatchEvent(event);
  };
};

/**
 * Format time in MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
