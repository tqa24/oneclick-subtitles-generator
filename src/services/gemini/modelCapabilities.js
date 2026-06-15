/**
 * Capability checks for Gemini models.
 *
 * Single source of truth — previously duplicated verbatim in core.js and streamingService.js.
 */

// Experimental models that do NOT support the generationConfig.mediaResolution setting.
const UNSUPPORTED_MEDIA_RESOLUTION_MODELS = [
  'learnlm-2.0-flash-experimental',
  'learnlm-2.0-flash',
  'learnlm-1.5-flash',
];

/**
 * Whether the given model supports the media-resolution generation setting.
 * @param {string} model - The model id to check.
 * @returns {boolean} - True if the model supports media resolution.
 */
export const supportsMediaResolution = (model) =>
  !UNSUPPORTED_MEDIA_RESOLUTION_MODELS.some((unsupported) => model.includes(unsupported));
