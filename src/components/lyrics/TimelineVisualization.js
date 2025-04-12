import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Import utility modules
import { calculateMinZoom, getVisibleTimeRange, calculateVisibleTimeRange } from './utils/TimelineCalculations';
import { drawTimeline } from './utils/TimelineDrawing';
import { centerTimelineOnTime as centerTimeOnTime, handleTimelineClick as handleClick, animateZoom as animateZoomTo } from './utils/TimelineInteractions';

// Import volume visualizer
import VolumeVisualizer from './VolumeVisualizer';

// Import optimized video streaming utilities
import { clearUnusedChunks } from '../../utils/optimizedVideoStreaming';

const TimelineVisualization = ({
  lyrics,
  currentTime,
  duration,
  onTimelineClick,
  zoom,
  panOffset,
  setPanOffset,
  centerOnTime, // Prop to center the view on a specific time
  timeFormat = 'seconds', // Prop to control time display format
  videoSource, // Video source URL for audio analysis
  showWaveform = true // Whether to show the waveform visualization
}) => {
  const { t } = useTranslation();
  const [showWaveformDisabledNotice, setShowWaveformDisabledNotice] = useState(false);

  // Check if waveform should be disabled due to long video
  useEffect(() => {
    if (showWaveform && duration > 1800) {
      setShowWaveformDisabledNotice(true);

      // Hide the notice after 10 seconds
      const timer = setTimeout(() => {
        setShowWaveformDisabledNotice(false);
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      setShowWaveformDisabledNotice(false);
    }
  }, [showWaveform, duration]);
  const timelineRef = useRef(null);
  const lastTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const currentZoomRef = useRef(zoom);
  const autoScrollRef = useRef(null);
  const isScrollingRef = useRef(false);
  const canvasWidthRef = useRef(0);

  // Track the last time the user manually interacted with the timeline
  const lastManualPanTime = useRef(0);

  // Flag to completely disable auto-scrolling
  const disableAutoScroll = useRef(false);

  // Debug counter to track state updates
  const debugCounter = useRef(0);

  // Ensure zoom level respects the minimum zoom
  useEffect(() => {
    if (duration) {
      const minZoom = calculateMinZoom(duration);
      if (zoom < minZoom) {
        // Use requestAnimationFrame to avoid state update during render
        requestAnimationFrame(() => {
          setPanOffset(Math.min(panOffset, Math.max(0, duration - 300)));
          // We don't call setZoom here as it would create a loop with the parent component
          // The parent component's useEffect will handle this
        });
      }
    }
  }, [duration, zoom, panOffset, setPanOffset]);

  // Calculate visible time range with playhead-centered zoom
  const getTimeRange = useCallback(() => {
    const { start, end, total: timelineEnd, effectiveZoom } = getVisibleTimeRange(lyrics, duration, panOffset, zoom, currentZoomRef.current);

    // Update currentZoomRef to match effective zoom
    const prevZoom = currentZoomRef.current;
    currentZoomRef.current = effectiveZoom;

    // If zoom changed, recalculate panOffset to keep playhead centered
    if (prevZoom !== effectiveZoom && duration > 0) {
      const prevVisibleDuration = timelineEnd / prevZoom;
      const newVisibleDuration = timelineEnd / effectiveZoom;

      // Calculate relative position of playhead in previous view (0-1)
      const relativePlayheadPos = (currentTime - panOffset) / prevVisibleDuration;

      // Apply the relative position to the new visible duration
      const newPanOffset = Math.max(0, currentTime - (relativePlayheadPos * newVisibleDuration));

      // Ensure we don't go past the end
      const maxPanOffset = Math.max(0, timelineEnd - newVisibleDuration);

      // Use requestAnimationFrame to avoid state update during render
      if (panOffset !== Math.min(newPanOffset, maxPanOffset)) {
        requestAnimationFrame(() => {
          setPanOffset(Math.min(newPanOffset, maxPanOffset));
        });
      }
    }

    return { start, end, total: timelineEnd };
  }, [lyrics, duration, panOffset, zoom, currentTime, setPanOffset]);

  // Store the playhead position before zooming
  // This effect is no longer needed since we removed the playhead animation
  useEffect(() => {
    // No-op - we've removed the playhead animation
  }, []);

  // Function to center the timeline view on a specific time
  const centerTimelineOnTime = useCallback((time) => {
    centerTimeOnTime(
      time,
      lyrics,
      duration,
      currentZoomRef.current,
      setPanOffset,
      lastManualPanTime
    );
  }, [lyrics, duration, setPanOffset]);

  // Watch for centerOnTime prop changes
  useEffect(() => {
    if (centerOnTime !== undefined && centerOnTime !== null) {
      centerTimelineOnTime(centerOnTime);
    }
  }, [centerOnTime, centerTimelineOnTime]);

  // Helper function to calculate visible time range with a temporary pan offset
  // This avoids creating a dependency on the state panOffset during active panning
  const getVisibleRangeWithTempOffset = useCallback((tempPanOffset) => {
    return calculateVisibleTimeRange(lyrics, duration, tempPanOffset, currentZoomRef.current);
  }, [lyrics, duration]);

  // Draw the timeline visualization with optimizations
  const renderTimeline = useCallback((tempPanOffset = null) => {
    const canvas = timelineRef.current;
    if (!canvas || !duration) return;

    canvasWidthRef.current = canvas.clientWidth;

    // Use the provided temporary pan offset during active panning, or the state value
    const effectivePanOffset = tempPanOffset !== null ? tempPanOffset : panOffset;

    // Get visible time range with the effective pan offset
    const visibleTimeRange = tempPanOffset !== null
      ? getVisibleRangeWithTempOffset(effectivePanOffset)
      : getTimeRange();

    // Draw the timeline
    drawTimeline(
      canvas,
      duration,
      lyrics,
      currentTime,
      visibleTimeRange,
      effectivePanOffset,
      tempPanOffset !== null, // isActivePanning
      timeFormat
    );
  }, [lyrics, currentTime, duration, getTimeRange, panOffset, getVisibleRangeWithTempOffset, timeFormat]);

  // Simplified zoom animation function - just set zoom and let getTimeRange handle panOffset
  const animateZoom = useCallback((targetZoom) => {
    animateZoomTo(
      targetZoom,
      animationFrameRef,
      lyrics,
      duration,
      currentZoomRef,
      renderTimeline
    );
  }, [renderTimeline, lyrics, duration]);

  // Update zoom with animation when zoom prop changes
  useEffect(() => {
    if (zoom !== currentZoomRef.current) {
      animateZoom(zoom);
    }
  }, [zoom, animateZoom]);





  // Clean up animation frame on unmount
  useEffect(() => {
    // Store the ref value in a variable that won't change
    const animationFrameRef2 = animationFrameRef;

    return () => {
      const animationFrame = animationFrameRef2.current;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  // Initialize and handle canvas resize
  useEffect(() => {
    if (timelineRef.current) {
      const canvas = timelineRef.current;
      const container = canvas.parentElement;

      const resizeCanvas = () => {
        const rect = container.getBoundingClientRect();
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = '50px';
        drawTimeline();
      };

      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, []);

  // Add keyboard shortcut to toggle auto-scrolling
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+S to toggle auto-scrolling
      if (e.altKey && e.key === 's') {
        disableAutoScroll.current = !disableAutoScroll.current;
        console.log(`Auto-scrolling ${disableAutoScroll.current ? 'disabled' : 'enabled'}`);

        // Show a temporary message on the canvas
        const canvas = timelineRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const message = `Auto-scrolling ${disableAutoScroll.current ? 'disabled' : 'enabled'}`;

          // Save current state
          ctx.save();

          // Draw message
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(10, 10, 200, 30);
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px Arial';
          ctx.fillText(message, 20, 30);

          // Restore state after a delay
          setTimeout(() => {
            ctx.restore();
            drawTimeline();
          }, 1500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [renderTimeline]);

  // Handle timeline updates
  useEffect(() => {
    if (timelineRef.current && lyrics.length > 0) {
      lastTimeRef.current = currentTime;
      renderTimeline();

      // For long videos, optimize memory usage by clearing unused chunks
      if (duration > 1800 && videoSource) { // 30 minutes
        // Clear unused video chunks to free up memory
        clearUnusedChunks(videoSource, currentTime, duration);
      }
    }
  }, [lyrics, currentTime, duration, zoom, panOffset, renderTimeline, videoSource]);



  // Ensure playhead stays visible by auto-scrolling, but only when absolutely necessary
  useEffect(() => {
    // COMPLETELY DISABLE auto-scroll if:
    // 1. No duration set yet
    // 2. Recently manually interacted with (within last 5 seconds)
    // 3. User has explicitly disabled it
    if (!duration ||
        (performance.now() - lastManualPanTime.current < 5000) ||
        disableAutoScroll.current) {
      return;
    }

    // Only auto-scroll when the playhead is COMPLETELY outside the visible area
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getTimeRange();
    if (!isScrollingRef.current &&
        (currentTime < visibleStart || currentTime > visibleEnd) &&
        Math.abs(currentTime - visibleStart) > 5 && // Must be significantly outside
        Math.abs(currentTime - visibleEnd) > 5) {   // Must be significantly outside

      isScrollingRef.current = true;
      debugCounter.current++;
      console.log(`Auto-scroll triggered #${debugCounter.current}. Current time: ${currentTime}, Visible: ${visibleStart}-${visibleEnd}`);

      // Ensure we respect the minimum zoom level
      const minZoom = calculateMinZoom(timelineEnd);
      const effectiveZoom = Math.max(minZoom, currentZoomRef.current);

      // Limit visible duration to 300 seconds
      const totalVisibleDuration = Math.min(timelineEnd / effectiveZoom, 300);
      const halfVisibleDuration = totalVisibleDuration / 2;

      // Center the view on the current time
      const targetOffset = Math.max(0, Math.min(currentTime - halfVisibleDuration, timelineEnd - totalVisibleDuration));

      // Don't scroll if we're already close to the target
      if (Math.abs(targetOffset - panOffset) < 1) {
        isScrollingRef.current = false;
        return;
      }

      // Cancel any existing animation
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
      }

      // Set the pan offset directly without animation to avoid shaking
      // This creates a clean jump to the new position without any transition
      setPanOffset(targetOffset);

      // Release the scrolling lock immediately
      setTimeout(() => {
        isScrollingRef.current = false;
        console.log('Auto-scroll completed');
      }, 50);
    }

    // Store the ref value in a variable that won't change
    const autoScrollRef2 = autoScrollRef;

    return () => {
      const autoScroll = autoScrollRef2.current;
      if (autoScroll) {
        cancelAnimationFrame(autoScroll);
      }
    };
  }, [currentTime, duration, getTimeRange, panOffset, setPanOffset]);

  // Handle timeline click with zoom consideration
  const handleTimelineClick = (e) => {
    handleClick(
      e,
      timelineRef.current,
      duration,
      onTimelineClick,
      getTimeRange(),
      lastManualPanTime
    );
  };

  return (
    <div className="timeline-container">
      <canvas
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="subtitle-timeline"
        style={{ cursor: 'pointer' }}
      />
      {videoSource && showWaveform && duration <= 1800 && ( // Only show waveform for videos <= 30 minutes (1800 seconds)
        <VolumeVisualizer
          audioSource={videoSource}
          duration={duration}
          visibleTimeRange={getTimeRange()}
          height={30}
        />
      )}
      {!videoSource && (
        <div className="srt-only-timeline-message">
          <span>{t('timeline.srtOnlyMode', 'SRT Only Mode - Timeline visualization based on subtitle timing')}</span>
        </div>
      )}
      {showWaveformDisabledNotice && (
        <div className="waveform-disabled-notice">
          {t('timeline.waveformDisabled', 'Waveform visualization has been automatically disabled for videos longer than 30 minutes to improve performance.')}
        </div>
      )}
    </div>
  );
};

export default TimelineVisualization;