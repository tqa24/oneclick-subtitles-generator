/**
 * Document processing service for Gemini API
 * Main entry point for document consolidation and summarization
 */

import { completeDocument } from './consolidationService';
import { summarizeDocument } from './summarizationService';

// Re-export the main functions
export {
    completeDocument,
    summarizeDocument
};
