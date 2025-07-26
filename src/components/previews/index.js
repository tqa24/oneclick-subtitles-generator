/**
 * Main export file for video preview components and hooks
 * Provides both the original monolithic component and the new modular structure
 */

// Export the original VideoPreview component (for backward compatibility)
export { default as VideoPreview } from './VideoPreview';

// Export the new modular VideoPreview component
export { default as VideoPreviewModular } from './VideoPreviewModular';

// Export all hooks
export {
  useVideoState,
  useVideoControls,
  useFullscreenManager,
  useSubtitleDisplay,
  useVideoDownloader
} from './hooks';

// Export all components
export {
  VideoPlayer,
  VideoControls,
  SubtitleOverlay,
  VideoLoadingStates,
  VideoActionButtons,
  VideoPreviewContainer
} from './components';

// Export utilities
export * from './utils/videoPreviewUtils';
