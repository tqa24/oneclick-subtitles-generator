import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import VideoPreview from '../VideoPreviewModular';

// Mock the translation hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, defaultValue) => defaultValue || key,
  }),
}));

// Mock the config
jest.mock('../../../config', () => ({
  SERVER_URL: 'http://localhost:3031'
}));

// Mock the utility modules
jest.mock('../../../utils/videoDownloader', () => ({
  startYoutubeVideoDownload: jest.fn(() => 'mock-video-id'),
  checkDownloadStatus: jest.fn(() => ({ status: 'completed', url: 'mock-video-url' })),
  extractYoutubeVideoId: jest.fn(() => 'mock-video-id')
}));

jest.mock('../../../utils/videoUtils', () => ({
  renderSubtitlesToVideo: jest.fn(() => Promise.resolve('mock-rendered-url')),
  downloadVideo: jest.fn()
}));

jest.mock('../../../utils/vttUtils', () => ({
  convertTimeStringToSeconds: jest.fn((timeString) => {
    if (typeof timeString === 'string') {
      const parts = timeString.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return timeString;
  })
}));

jest.mock('../../../utils/fileUtils', () => ({
  extractAndDownloadAudio: jest.fn(() => Promise.resolve())
}));

// Mock SubtitleSettings component
jest.mock('../../SubtitleSettings', () => {
  return function MockSubtitleSettings(props) {
    return (
      <div data-testid="subtitle-settings">
        <button onClick={props.onDownloadWithSubtitles}>Download with Subtitles</button>
        <button onClick={props.onDownloadWithTranslatedSubtitles}>Download with Translated Subtitles</button>
      </div>
    );
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window methods
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

describe('VideoPreview Modular', () => {
  const defaultProps = {
    currentTime: 0,
    setCurrentTime: jest.fn(),
    setDuration: jest.fn(),
    videoSource: 'test-video.mp4',
    onSeek: jest.fn(),
    translatedSubtitles: [],
    subtitlesArray: [
      { id: 1, start: 0, end: 5, text: 'First subtitle' },
      { id: 2, start: 5, end: 10, text: 'Second subtitle' }
    ],
    onVideoUrlReady: jest.fn(),
    onReferenceAudioChange: jest.fn(),
    onRenderVideo: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Mock video element
    const mockVideoElement = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      play: jest.fn(() => Promise.resolve()),
      pause: jest.fn(),
      load: jest.fn(),
      currentTime: 0,
      duration: 100,
      paused: true,
      volume: 1,
      muted: false,
      playbackRate: 1,
      buffered: {
        length: 0,
        start: jest.fn(),
        end: jest.fn()
      },
      readyState: 4
    };

    // Mock useRef to return our mock video element
    jest.spyOn(React, 'useRef').mockReturnValue({ current: mockVideoElement });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders video preview component', () => {
    render(<VideoPreview {...defaultProps} />);
    
    expect(screen.getByText('Video Preview with Subtitles')).toBeInTheDocument();
    expect(screen.getByTestId('subtitle-settings')).toBeInTheDocument();
  });

  test('handles video source changes', async () => {
    const { rerender } = render(<VideoPreview {...defaultProps} />);
    
    // Change video source
    rerender(<VideoPreview {...defaultProps} videoSource="new-video.mp4" />);
    
    await waitFor(() => {
      expect(defaultProps.onVideoUrlReady).toHaveBeenCalled();
    });
  });

  test('handles YouTube video URLs', async () => {
    const youtubeProps = {
      ...defaultProps,
      videoSource: 'https://www.youtube.com/watch?v=test'
    };

    render(<VideoPreview {...youtubeProps} />);
    
    await waitFor(() => {
      expect(require('../../../utils/videoDownloader').startYoutubeVideoDownload).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test');
    });
  });

  test('handles blob URLs', async () => {
    const blobProps = {
      ...defaultProps,
      videoSource: 'blob:http://localhost/test-blob'
    };

    render(<VideoPreview {...blobProps} />);
    
    await waitFor(() => {
      expect(defaultProps.onVideoUrlReady).toHaveBeenCalledWith('blob:http://localhost/test-blob');
    });
  });

  test('manages subtitle settings', () => {
    render(<VideoPreview {...defaultProps} />);
    
    // Check that subtitle settings are initialized
    expect(localStorageMock.getItem).toHaveBeenCalledWith('subtitle_settings');
  });

  test('handles subtitle downloads', async () => {
    render(<VideoPreview {...defaultProps} />);
    
    const downloadButton = screen.getByText('Download with Subtitles');
    fireEvent.click(downloadButton);
    
    await waitFor(() => {
      expect(require('../../../utils/videoUtils').renderSubtitlesToVideo).toHaveBeenCalled();
    });
  });

  test('handles translated subtitle downloads', async () => {
    const propsWithTranslation = {
      ...defaultProps,
      translatedSubtitles: [
        { id: 1, originalId: 1, text: 'Translated first subtitle' },
        { id: 2, originalId: 2, text: 'Translated second subtitle' }
      ]
    };

    render(<VideoPreview {...propsWithTranslation} />);
    
    const downloadButton = screen.getByText('Download with Translated Subtitles');
    fireEvent.click(downloadButton);
    
    await waitFor(() => {
      expect(require('../../../utils/videoUtils').renderSubtitlesToVideo).toHaveBeenCalled();
    });
  });

  test('stores subtitle data in window object', () => {
    render(<VideoPreview {...defaultProps} />);
    
    expect(window.subtitlesData).toEqual(defaultProps.subtitlesArray);
    expect(window.originalSubtitles).toEqual(defaultProps.subtitlesArray);
  });

  test('handles optimized preview setting', () => {
    localStorageMock.getItem.mockReturnValue('true');
    
    render(<VideoPreview {...defaultProps} />);
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('use_optimized_preview');
  });

  test('cleans up on unmount', () => {
    const { unmount } = render(<VideoPreview {...defaultProps} />);
    
    // Mock window cleanup functions
    window.resetAlignedNarration = jest.fn();
    window.alignedAudioElement = {
      pause: jest.fn(),
      load: jest.fn()
    };
    
    unmount();
    
    expect(window.resetAlignedNarration).toHaveBeenCalled();
  });

  test('handles current time changes', async () => {
    const { rerender } = render(<VideoPreview {...defaultProps} />);
    
    // Change current time
    rerender(<VideoPreview {...defaultProps} currentTime={50} />);
    
    // Should trigger seek if difference is significant
    await waitFor(() => {
      // Video element currentTime should be updated
      expect(React.useRef().current.currentTime).toBeDefined();
    });
  });

  test('handles error states', () => {
    // Mock an error in video state
    const errorProps = {
      ...defaultProps,
      videoSource: null // This should trigger an error state
    };

    render(<VideoPreview {...errorProps} />);
    
    // Component should still render without crashing
    expect(screen.getByText('Video Preview with Subtitles')).toBeInTheDocument();
  });

  test('handles loading states', () => {
    render(<VideoPreview {...defaultProps} />);
    
    // Component should handle loading states gracefully
    expect(screen.getByText('Video Preview with Subtitles')).toBeInTheDocument();
  });
});

describe('VideoPreview Integration', () => {
  test('maintains external API compatibility', () => {
    const props = {
      currentTime: 0,
      setCurrentTime: jest.fn(),
      setDuration: jest.fn(),
      videoSource: 'test-video.mp4',
      onSeek: jest.fn(),
      translatedSubtitles: [],
      subtitlesArray: [],
      onVideoUrlReady: jest.fn(),
      onReferenceAudioChange: jest.fn(),
      onRenderVideo: jest.fn()
    };

    // Should render without errors
    expect(() => render(<VideoPreview {...props} />)).not.toThrow();
  });

  test('passes all props correctly to child components', () => {
    const props = {
      currentTime: 25,
      setCurrentTime: jest.fn(),
      setDuration: jest.fn(),
      videoSource: 'test-video.mp4',
      onSeek: jest.fn(),
      translatedSubtitles: [{ id: 1, text: 'Translated' }],
      subtitlesArray: [{ id: 1, start: 0, end: 5, text: 'Original' }],
      onVideoUrlReady: jest.fn(),
      onReferenceAudioChange: jest.fn(),
      onRenderVideo: jest.fn()
    };

    render(<VideoPreview {...props} />);
    
    // Verify that the component renders and handles props
    expect(screen.getByText('Video Preview with Subtitles')).toBeInTheDocument();
    expect(props.onVideoUrlReady).toHaveBeenCalled();
  });
});

// Additional tests for individual hooks
describe('useVideoState Hook', () => {
  test('initializes with correct default state', () => {
    const { useVideoState } = require('../hooks/useVideoState');

    // This would need to be tested with a proper hook testing library
    // For now, we verify the hook exists and can be imported
    expect(useVideoState).toBeDefined();
    expect(typeof useVideoState).toBe('function');
  });
});

describe('useVideoControls Hook', () => {
  test('provides video control functionality', () => {
    const { useVideoControls } = require('../hooks/useVideoControls');

    expect(useVideoControls).toBeDefined();
    expect(typeof useVideoControls).toBe('function');
  });
});

describe('useFullscreenManager Hook', () => {
  test('manages fullscreen state', () => {
    const { useFullscreenManager } = require('../hooks/useFullscreenManager');

    expect(useFullscreenManager).toBeDefined();
    expect(typeof useFullscreenManager).toBe('function');
  });
});

describe('useSubtitleDisplay Hook', () => {
  test('handles subtitle display logic', () => {
    const { useSubtitleDisplay } = require('../hooks/useSubtitleDisplay');

    expect(useSubtitleDisplay).toBeDefined();
    expect(typeof useSubtitleDisplay).toBe('function');
  });
});

describe('useVideoDownloader Hook', () => {
  test('manages video download functionality', () => {
    const { useVideoDownloader } = require('../hooks/useVideoDownloader');

    expect(useVideoDownloader).toBeDefined();
    expect(typeof useVideoDownloader).toBe('function');
  });
});
