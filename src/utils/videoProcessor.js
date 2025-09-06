/**
 * Main media processing module for handling long videos/audio and segment processing
 * This file is maintained for backward compatibility
 * It re-exports all functions from the modular videoProcessing directory
 */

// Re-export everything from the modular structure
export * from './videoProcessing';

// Also export the new simplified processing as the recommended approach
export { processMediaFile as processVideo } from './videoProcessing';
