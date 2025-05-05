/**
 * Utility functions for font handling
 */

/**
 * Group fonts for the select element
 * @param {Array} fontOptions - Array of font options
 * @returns {Object} - Grouped fonts by category
 */
export const groupFontsByCategory = (fontOptions) => {
  return fontOptions.reduce((groups, font) => {
    if (!groups[font.group]) {
      groups[font.group] = [];
    }
    groups[font.group].push(font);
    return groups;
  }, {});
};
