import React from 'react';
import { render, screen, act } from '@testing-library/react';
import VideoAnalysisModal from './VideoAnalysisModal';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (options) {
        // Replace placeholders like {{countdown}} for relevant keys
        if (key === 'videoAnalysis.autoSelectCountdown' && options.countdown !== undefined) {
          return `Auto-selecting recommended preset in (click anywhere to cancel) ${options.countdown} seconds`;
        }
      }
      return key;
    },
  }),
}));

// Mock PROMPT_PRESETS used in getPresetTitle
jest.mock('../services/geminiService', () => ({
  PROMPT_PRESETS: [
    { id: 'general', title: 'General purpose' },
    { id: 'recommended-preset-id', title: 'Recommended Preset Title' },
  ],
}));

describe('VideoAnalysisModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnUsePreset = jest.fn();
  const mockOnUseDefaultPreset = jest.fn();
  const mockOnEditRules = jest.fn();

  const analysisResultMock = {
    recommendedPreset: {
      id: 'recommended-preset-id',
      reason: 'This is a recommended preset.',
    },
    transcriptionRules: {
      additionalNotes: ['Test note 1'],
    },
  };

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    analysisResult: analysisResultMock,
    onUsePreset: mockOnUsePreset,
    onUseDefaultPreset: mockOnUseDefaultPreset,
    onEditRules: mockOnEditRules,
  };

  let mockLocalStorageGetItem;

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnClose.mockClear();
    mockOnUsePreset.mockClear();
    mockOnUseDefaultPreset.mockClear();
    mockOnEditRules.mockClear();

    // Mock localStorage.getItem
    mockLocalStorageGetItem = jest.spyOn(Storage.prototype, 'getItem');
    // Default mock for video_analysis_timeout for the countdown
    mockLocalStorageGetItem.mockImplementation((key) => {
      if (key === 'video_analysis_timeout') {
        return '20'; // Default 20 seconds for countdown
      }
      if (key === 'video_analysis_result') {
        return JSON.stringify(analysisResultMock); // Provide stored result if component tries to read it
      }
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    mockLocalStorageGetItem.mockRestore();
  });

  test('should call onUseDefaultPreset when timer expires and autoSelectDefaultPreset is true in localStorage', () => {
    mockLocalStorageGetItem.mockImplementation((key) => {
      if (key === 'auto_select_default_preset') {
        return 'true';
      }
      if (key === 'video_analysis_timeout') {
        return '20';
      }
      if (key === 'video_analysis_result') {
        return JSON.stringify(analysisResultMock);
      }
      return null;
    });

    render(<VideoAnalysisModal {...defaultProps} />);
    
    act(() => {
      jest.advanceTimersByTime(20000); // Advance by 20 seconds
    });

    expect(mockOnUseDefaultPreset).toHaveBeenCalledTimes(1);
    expect(mockOnUsePreset).not.toHaveBeenCalled();
  });

  test('should call onUsePreset with recommended preset when timer expires and autoSelectDefaultPreset is false in localStorage', () => {
    mockLocalStorageGetItem.mockImplementation((key) => {
      if (key === 'auto_select_default_preset') {
        return 'false';
      }
      if (key === 'video_analysis_timeout') {
        return '20';
      }
      if (key === 'video_analysis_result') {
        return JSON.stringify(analysisResultMock);
      }
      return null;
    });

    render(<VideoAnalysisModal {...defaultProps} />);

    act(() => {
      jest.advanceTimersByTime(20000);
    });

    expect(mockOnUsePreset).toHaveBeenCalledTimes(1);
    expect(mockOnUsePreset).toHaveBeenCalledWith(analysisResultMock.recommendedPreset.id);
    expect(mockOnUseDefaultPreset).not.toHaveBeenCalled();
  });

  test('should call onUsePreset with recommended preset when timer expires and autoSelectDefaultPreset is not in localStorage', () => {
    // localStorage.getItem will return null by default for 'auto_select_default_preset' due to the mock setup in beforeEach
    mockLocalStorageGetItem.mockImplementation((key) => {
      if (key === 'video_analysis_timeout') {
        return '20';
      }
      if (key === 'video_analysis_result') {
        return JSON.stringify(analysisResultMock);
      }
      // 'auto_select_default_preset' will return undefined, which simulates it not being in localStorage
      return null;
    });
    
    render(<VideoAnalysisModal {...defaultProps} />);

    act(() => {
      jest.advanceTimersByTime(20000);
    });

    expect(mockOnUsePreset).toHaveBeenCalledTimes(1);
    expect(mockOnUsePreset).toHaveBeenCalledWith(analysisResultMock.recommendedPreset.id);
    expect(mockOnUseDefaultPreset).not.toHaveBeenCalled();
  });

  test('should display countdown timer if timeout is set', () => {
    mockLocalStorageGetItem.mockImplementation((key) => {
      if (key === 'video_analysis_timeout') {
        return '10'; // Set a 10-second timeout for this test
      }
      if (key === 'video_analysis_result') {
        return JSON.stringify(analysisResultMock);
      }
      return null;
    });

    render(<VideoAnalysisModal {...defaultProps} />);
    expect(screen.getByText(/Auto-selecting recommended preset in \(click anywhere to cancel\) 10 seconds/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000); // Advance 1 second
    });
    expect(screen.getByText(/Auto-selecting recommended preset in \(click anywhere to cancel\) 9 seconds/i)).toBeInTheDocument();
  });

  test('should not start countdown if timeout setting is "none"', () => {
    mockLocalStorageGetItem.mockImplementation((key) => {
      if (key === 'video_analysis_timeout') {
        return 'none';
      }
      if (key === 'video_analysis_result') {
        return JSON.stringify(analysisResultMock);
      }
      return null;
    });
    render(<VideoAnalysisModal {...defaultProps} />);
    expect(screen.queryByText(/Auto-selecting recommended preset in/i)).not.toBeInTheDocument();
  });

  test('should clear timers and stop countdown on user interaction', () => {
    mockLocalStorageGetItem.mockImplementation((key) => {
      if (key === 'video_analysis_timeout') {
        return '20';
      }
      if (key === 'video_analysis_result') {
        return JSON.stringify(analysisResultMock);
      }
      return null;
    });
    render(<VideoAnalysisModal {...defaultProps} />);
    expect(screen.getByText(/Auto-selecting recommended preset in \(click anywhere to cancel\) 20 seconds/i)).toBeInTheDocument();

    // Simulate user clicking the modal overlay (which calls handleUserInteraction)
    const modalOverlay = screen.getByText('videoAnalysis.title').closest('.video-analysis-modal-overlay');
    if (modalOverlay) {
       act(() => {
        fireEvent.click(modalOverlay);
      });
    }


    expect(screen.queryByText(/Auto-selecting recommended preset in/i)).not.toBeInTheDocument();

    // Advance timers to see if the original timeout still fires
    act(() => {
      jest.advanceTimersByTime(20000);
    });
    expect(mockOnUseDefaultPreset).not.toHaveBeenCalled();
    expect(mockOnUsePreset).not.toHaveBeenCalled();
  });
});
