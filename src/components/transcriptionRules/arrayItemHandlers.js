/**
 * Pure helpers for mutating the array-based sections of the transcription rules
 * object. Each returns a NEW rules object and never touches component state.
 */

/**
 * Returns a new rules object with the item at `index` in `category` updated.
 *
 * @param {Object} rules - Current rules object.
 * @param {string} category - The rules array key to update.
 * @param {number} index - Index of the item to change.
 * @param {string|null} field - For object arrays, the field to set; null for string arrays.
 * @param {*} value - The new value.
 * @returns {Object} A new rules object.
 */
export const handleArrayItemChange = (rules, category, index, field, value) => {
  const updatedArray = [...rules[category]];

  if (field) {
    // For objects in arrays (terminology, speakerIdentification)
    updatedArray[index] = {
      ...updatedArray[index],
      [field]: value
    };
  } else {
    // For simple string arrays
    updatedArray[index] = value;
  }

  return {
    ...rules,
    [category]: updatedArray
  };
};

/**
 * Returns a new rules object with `template` appended to `category`.
 *
 * @param {Object} rules - Current rules object.
 * @param {string} category - The rules array key to append to.
 * @param {*} template - The new item to append.
 * @returns {Object} A new rules object.
 */
export const addArrayItem = (rules, category, template) => ({
  ...rules,
  [category]: [...(rules[category] || []), template]
});

/**
 * Returns a new rules object with the item at `index` removed from `category`.
 *
 * @param {Object} rules - Current rules object.
 * @param {string} category - The rules array key to remove from.
 * @param {number} index - Index of the item to remove.
 * @returns {Object} A new rules object.
 */
export const removeArrayItem = (rules, category, index) => {
  const updatedArray = [...rules[category]];
  updatedArray.splice(index, 1);

  return {
    ...rules,
    [category]: updatedArray
  };
};
