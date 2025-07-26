# Video Preview Components - Modular Architecture

This directory contains the modularized video preview system, extracted from the original monolithic `VideoPreview.js` component (3,406 lines) into a clean, maintainable, and reusable architecture.

## Architecture Overview

### Original vs Modular
- **Original**: Single 3,406-line component handling all video preview functionality
- **Modular**: Distributed across multiple focused hooks and components

### Benefits
- **Maintainability**: Each module has a single responsibility
- **Reusability**: Hooks and components can be used independently
- **Testability**: Smaller units are easier to test
- **Performance**: Better optimization opportunities
- **Developer Experience**: Easier to understand and modify

## Directory Structure

```
src/components/previews/
├── hooks/                          # Custom hooks for state management
│   ├── useVideoState.js           # Video loading, URLs, optimization
│   ├── useVideoControls.js        # Playback controls and interactions
│   ├── useFullscreenManager.js    # Fullscreen mode management
│   ├── useSubtitleDisplay.js      # Subtitle rendering and sync
│   ├── useVideoDownloader.js      # Downloads and video rendering
│   └── index.js                   # Hook exports
├── components/                     # UI components
│   ├── VideoPlayer.js             # Core video element
│   ├── VideoControls.js           # Custom video controls UI
│   ├── SubtitleOverlay.js         # Subtitle display
│   ├── VideoLoadingStates.js      # Loading/error states
│   ├── VideoActionButtons.js      # Action buttons
│   ├── VideoPreviewContainer.js   # Main orchestrator
│   └── index.js                   # Component exports
├── utils/                          # Utility functions
│   └── videoPreviewUtils.js       # Shared utilities
├── __tests__/                      # Test files
│   └── VideoPreviewModular.test.js
├── VideoPreview.js                 # Original component (preserved)
├── VideoPreviewModular.js          # New modular component
├── VideoPreview-Analysis.md        # Original component analysis
├── index.js                        # Main exports
└── README.md                       # This file
```

## Custom Hooks

### `useVideoState(videoSource, onVideoUrlReady)`
Manages video loading, URLs, and optimization preferences.

**Returns:**
- `videoUrl`, `optimizedVideoUrl`, `isLoaded`, `error`
- `isDownloading`, `downloadProgress`, `useOptimizedPreview`
- `setIsLoaded`, `setError`, `getCurrentVideoUrl`
- `hasOptimizedVersion`, `effectiveVideoUrl`

### `useVideoControls(videoRef, currentTime, setCurrentTime)`
Handles all video playback controls and interactions.

**Returns:**
- `isPlaying`, `videoDuration`, `volume`, `playbackSpeed`
- `isDragging`, `isBuffering`, `controlsVisible`
- `togglePlayPause`, `handleVolumeChange`, `handleSpeedChange`
- Event handlers for video element

### `useFullscreenManager(videoRef, subtitleSettings, setControlsVisible, setIsVideoHovered)`
Manages complex fullscreen transitions and cleanup.

**Returns:**
- `isFullscreen`, `enterFullscreen`, `handleFullscreenExit`
- `createFullscreenSubtitleContainer`

### `useSubtitleDisplay(currentTime, subtitlesArray, translatedSubtitles, isFullscreen)`
Handles subtitle synchronization and rendering.

**Returns:**
- `currentSubtitleText`, `subtitleSettings`
- `updateSubtitleSettings`, `toggleSubtitleLanguage`
- `getSubtitleCSSVariables`, `getSubtitleStyles`

### `useVideoDownloader(videoUrl, videoSource, subtitlesArray, translatedSubtitles, subtitleSettings)`
Manages video downloads, audio extraction, and rendering.

**Returns:**
- `isAudioDownloading`, `isRenderingVideo`, `renderProgress`
- `handleDownloadAudio`, `handleDownloadWithSubtitles`
- `handleRefreshNarration`

## Components

### `VideoPlayer`
Core video element with basic event handling.

### `VideoControls`
Custom video controls with LiquidGlass styling:
- Play/pause button
- Timeline with drag support
- Volume control with expanding slider
- Speed control menu
- Fullscreen toggle

### `SubtitleOverlay`
Subtitle positioning and rendering with customizable styling.

### `VideoLoadingStates`
Handles all loading, downloading, error, and progress states.

### `VideoActionButtons`
Action buttons for video operations:
- Refresh narration
- Download audio
- Quality toggle

### `VideoPreviewContainer`
Main orchestrator that combines all hooks and components.

## Usage

### Using the Modular Component
```javascript
import { VideoPreviewModular } from './components/previews';

// Same API as original VideoPreview
<VideoPreviewModular
  currentTime={currentTime}
  setCurrentTime={setCurrentTime}
  setDuration={setDuration}
  videoSource={videoSource}
  onSeek={onSeek}
  translatedSubtitles={translatedSubtitles}
  subtitlesArray={subtitlesArray}
  onVideoUrlReady={onVideoUrlReady}
  onReferenceAudioChange={onReferenceAudioChange}
  onRenderVideo={onRenderVideo}
/>
```

### Using Individual Hooks
```javascript
import { useVideoState, useVideoControls } from './components/previews';

function CustomVideoComponent() {
  const videoRef = useRef(null);
  const videoState = useVideoState(videoSource, onVideoUrlReady);
  const videoControls = useVideoControls(videoRef, currentTime, setCurrentTime);
  
  // Use the hooks' returned values and functions
  return (
    <video ref={videoRef} src={videoState.effectiveVideoUrl} />
  );
}
```

### Using Individual Components
```javascript
import { VideoPlayer, VideoControls } from './components/previews';

function CustomVideoPreview() {
  return (
    <div>
      <VideoPlayer {...videoPlayerProps} />
      <VideoControls {...videoControlsProps} />
    </div>
  );
}
```

## Migration Guide

### From Original to Modular
1. Replace `VideoPreview` import with `VideoPreviewModular`
2. No changes needed to props or usage
3. All functionality preserved

### Gradual Migration
1. Keep using original `VideoPreview` component
2. Gradually adopt individual hooks/components as needed
3. Full migration when ready

## Testing

Run tests with:
```bash
npm test src/components/previews/__tests__/VideoPreviewModular.test.js
```

Tests cover:
- Component rendering and props handling
- Hook functionality
- Integration between components
- Error handling
- External API compatibility

## Backward Compatibility

The original `VideoPreview.js` component is preserved and continues to work exactly as before. The modular version (`VideoPreviewModular.js`) provides the same external API, ensuring seamless migration.

## Performance Benefits

- **Code Splitting**: Individual components can be loaded separately
- **Memoization**: Smaller components are easier to optimize with React.memo
- **Selective Updates**: Only affected components re-render on state changes
- **Bundle Size**: Unused components can be tree-shaken

## Future Enhancements

The modular architecture enables:
- Easy addition of new video features
- Component reuse across different video players
- Independent testing and optimization
- Plugin-based architecture for extensions
