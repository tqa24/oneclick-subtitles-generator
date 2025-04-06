/**
 * Gemini Button Effects - Advanced physics-based animations for Gemini buttons
 * This file is now a simple re-export of the modular implementation
 */

// Import and re-export the main functionality from the modular implementation
import initGeminiButtonEffects, { resetGeminiButtonState, resetAllGeminiButtonEffects } from './geminiEffects';

// Export all functions
export default initGeminiButtonEffects;
export { initGeminiButtonEffects, resetGeminiButtonState, resetAllGeminiButtonEffects };
