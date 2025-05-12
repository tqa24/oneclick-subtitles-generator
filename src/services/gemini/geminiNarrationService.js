/**
 * Gemini narration service for generating narration using Gemini API with WebSocket for audio
 * This is the main entry point for Gemini narration functionality
 */

// Import constants
import { GEMINI_VOICES } from './constants/voiceConstants';
import { GEMINI_LANGUAGE_CODES } from './constants/languageConstants';

// Import utilities
import { getGeminiLanguageCode } from './utils/languageUtils';

// Import model selection functions
import { listGeminiModels, findSuitableAudioModel } from './models/modelSelector';

// Import narration generation functions
import {
  generateGeminiNarration,
  generateGeminiNarrations,
  cancelGeminiNarrations
} from './narration/narrationGenerator';

// Import client manager functions
import {
  initializeClientPool,
  getNextAvailableClient,
  markClientAsNotBusy,
  disconnectAllClients
} from './client/clientManager';

// Import availability checker
import { checkGeminiAvailability } from './availability/availabilityChecker';

// Export all the functions and constants
export {
  // Constants
  GEMINI_VOICES,
  GEMINI_LANGUAGE_CODES,

  // Utilities
  getGeminiLanguageCode,

  // Model selection
  listGeminiModels,
  findSuitableAudioModel,

  // Narration generation
  generateGeminiNarration,
  generateGeminiNarrations,
  cancelGeminiNarrations,

  // Client management
  initializeClientPool,
  getNextAvailableClient,
  markClientAsNotBusy,
  disconnectAllClients,

  // Availability checking
  checkGeminiAvailability
};
