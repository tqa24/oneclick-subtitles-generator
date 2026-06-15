/**
 * Formatting helpers for the frames-per-second (FPS) controls in the video-processing modal.
 * Pure (no React/component state), so they live outside the component and stay unit-testable.
 */

/** Display an FPS value, e.g. getFpsValue(2) -> "2 FPS". */
export const getFpsValue = (value) => `${value} FPS`;

/**
 * Describe the seconds-between-frames interval for an FPS value.
 * @param {number} value - frames per second
 * @param {Function} t - i18n translate (key, defaultText, params)
 * @returns {string} e.g. "0.5s intervals"
 */
export const getFpsInterval = (value, t) => {
  // Interval in seconds between frames
  const interval = 1 / value;

  let formattedInterval;
  if (interval >= 10) {
    formattedInterval = interval.toFixed(0);
  } else if (interval >= 1) {
    formattedInterval = interval % 1 === 0 ? interval.toFixed(0) : interval.toFixed(1);
  } else if (interval >= 0.1) {
    formattedInterval = interval.toFixed(1); // 0.1, 0.2, 0.5, etc.
  } else {
    formattedInterval = interval.toFixed(2); // 0.05, 0.04, etc.
  }

  return t('processing.fpsIntervals', '{{interval}}s intervals', { interval: formattedInterval });
};
