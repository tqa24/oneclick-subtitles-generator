/**
 * ES6 Module version of WavyProgressIndicator
 * Use this when importing in React or other ES6 module environments
 */

// Import the main component (this will register it and make it available globally)
import './WavyProgressIndicator.js';

// Re-export for ES6 module usage
export default window.LinearWavyProgressIndicator;
export const LinearWavyProgressIndicator = window.LinearWavyProgressIndicator;
export const WavyProgressIndicatorDefaults = window.WavyProgressIndicatorDefaults;
export const AnimationSpecs = window.AnimationSpecs;
