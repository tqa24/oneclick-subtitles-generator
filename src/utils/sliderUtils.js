/**
 * Utility functions for custom slider positioning
 * Handles the padding adjustment for proper thumb positioning
 */

/**
 * Calculate the correct left position for a slider thumb accounting for container padding
 * @param {number} percentage - The percentage value (0-100)
 * @param {number} thumbWidth - Width of the thumb in pixels (default: 16)
 * @returns {string} - CSS calc() expression for the left position
 */
export const calculateThumbPosition = (percentage, thumbWidth = 16) => {
  const padding = thumbWidth / 2; // Half thumb width padding on each side
  // Map 0-100% to the available track space (container width - 2*padding)
  // Formula: padding + (percentage * (100% - 2*padding) / 100)
  return `calc(${padding}px + ${percentage}% * (100% - ${padding * 2}px) / 100%)`;
};

/**
 * Calculate the correct width for a slider fill accounting for container padding
 * @param {number} percentage - The percentage value (0-100)
 * @param {number} thumbWidth - Width of the thumb in pixels (default: 16)
 * @returns {string} - CSS calc() expression for the width
 */
export const calculateFillWidth = (percentage, thumbWidth = 16) => {
  const padding = thumbWidth / 2; // Half thumb width padding on each side
  // Fill width should be the distance from track start to thumb center
  // Track starts at padding (8px), thumb center is at calculateThumbPosition()
  // So fill width = thumb center position - track start position
  // = (padding + percentage * (100% - 2*padding) / 100) - padding
  // = percentage * (100% - 2*padding) / 100
  return `calc(${percentage}% * (100% - ${padding * 2}px) / 100%)`;
};

/**
 * Get the padding value for a given thumb width
 * @param {number} thumbWidth - Width of the thumb in pixels
 * @returns {number} - Padding value in pixels
 */
export const getSliderPadding = (thumbWidth = 16) => {
  return thumbWidth; // Full thumb width for complete coverage
};

/**
 * Calculate thumb position for 14px thumbs (advanced settings, speed control)
 * @param {number} percentage - The percentage value (0-100)
 * @returns {string} - CSS calc() expression for the left position
 */
export const calculateThumbPosition14px = (percentage) => {
  return calculateThumbPosition(percentage, 14);
};

/**
 * Calculate fill width for 14px thumbs (advanced settings, speed control)
 * @param {number} percentage - The percentage value (0-100)
 * @returns {string} - CSS calc() expression for the width
 */
export const calculateFillWidth14px = (percentage) => {
  return calculateFillWidth(percentage, 14);
};
