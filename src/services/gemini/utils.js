/**
 * Utility functions for Gemini API service
 */

// fileToBase64 is centralized in utils/fileUtils (as toBase64). Re-exported here so existing
// `import { fileToBase64 } from './utils'` call sites keep working unchanged.
export { fileToBase64 } from '../../utils/fileUtils';
