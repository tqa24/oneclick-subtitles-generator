import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VideoProcessingTab from './VideoProcessingTab';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => key, // Basic mock, returns the key itself
  }),
}));

describe('VideoProcessingTab Component', () => {
  const mockSetAutoSelectDefaultPreset = jest.fn();
  const defaultProps = {
    segmentDuration: 5,
    setSegmentDuration: jest.fn(),
    geminiModel: 'gemini-2.5-flash',
    setGeminiModel: jest.fn(),
    timeFormat: 'hms',
    setTimeFormat: jest.fn(),
    showWaveform: true,
    setShowWaveform: jest.fn(),
    useVideoAnalysis: true,
    videoAnalysisModel: 'gemini-2.5-flash-lite',
    setVideoAnalysisModel: jest.fn(),
    videoAnalysisTimeout: '20',
    setVideoAnalysisTimeout: jest.fn(),
    autoSelectDefaultPreset: false,
    setAutoSelectDefaultPreset: mockSetAutoSelectDefaultPreset,
    optimizeVideos: true, // Always true now
    optimizedResolution: '360p',
    setOptimizedResolution: jest.fn(),
    useOptimizedPreview: true,
    setUseOptimizedPreview: jest.fn(),
    thinkingBudgets: {
      'gemini-2.5-pro': -1,
      'gemini-2.5-flash': -1,
      'gemini-2.5-flash-lite': 0
    },
    setThinkingBudgets: jest.fn(),
  };

  beforeEach(() => {
    // Clear any previous mock calls
    mockSetAutoSelectDefaultPreset.mockClear();
  });

  test('should render the new Auto-select default preset toggle switch', () => {
    render(<VideoProcessingTab {...defaultProps} />);

    // Check for the label of the toggle switch
    expect(screen.getByLabelText('settings.autoSelectDefaultPreset')).toBeInTheDocument();
    
    // Check for the description
    expect(screen.getByText('settings.autoSelectDefaultPresetDescription')).toBeInTheDocument();
  });

  test('should call setAutoSelectDefaultPreset when the toggle is clicked', () => {
    render(<VideoProcessingTab {...defaultProps} autoSelectDefaultPreset={false} />);

    const toggleSwitch = screen.getByLabelText('settings.autoSelectDefaultPreset');
    fireEvent.click(toggleSwitch);

    expect(mockSetAutoSelectDefaultPreset).toHaveBeenCalledTimes(1);
    expect(mockSetAutoSelectDefaultPreset).toHaveBeenCalledWith(true);

    // Simulate clicking again to toggle off
    // Re-render with the prop updated to true, as the component itself doesn't manage this state internally
    render(<VideoProcessingTab {...defaultProps} autoSelectDefaultPreset={true} />);
    const toggleSwitchUpdated = screen.getByLabelText('settings.autoSelectDefaultPreset');
    fireEvent.click(toggleSwitchUpdated);
    expect(mockSetAutoSelectDefaultPreset).toHaveBeenCalledTimes(2); // Called once in this render, once in previous
    expect(mockSetAutoSelectDefaultPreset).toHaveBeenCalledWith(false);


  });
});
