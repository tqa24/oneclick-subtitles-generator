import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Import utility modules
import { getVisibleTimeRange, calculateVisibleTimeRange } from './utils/TimelineCalculations';
import { drawTimeline } from './utils/TimelineDrawing';
import { centerTimelineOnTime as centerTimeOnTime, handleTimelineClick as handleClick, animateZoom as animateZoomTo } from './utils/TimelineInteractions';

// Import volume visualizer
import VolumeVisualizer from './VolumeVisualizer';

// Import optimized video streaming utilities
import { clearUnusedChunks } from '../../utils/optimizedVideoStreaming';

// Import LiquidGlass component
import LiquidGlass from '../common/LiquidGlass';

const TimelineVisualization = ({
  lyrics,
  currentTime,
  duration,
  onTimelineClick,
  zoom,
  setZoom,
  panOffset,
  setPanOffset,
  centerOnTime, // Prop to center the view on a specific time
  timeFormat = 'seconds', // Prop to control time display format
  videoSource, // Video source URL for audio analysis
  showWaveform = true, // Whether to show the waveform visualization
  onSegmentSelect, // Callback for when a segment is selected via drag
  selectedSegment = null, // Currently selected segment { start, end }
  isProcessingSegment = false // New prop to indicate if processing is active
}) => {
  const { t } = useTranslation();
  const [showWaveformDisabledNotice, setShowWaveformDisabledNotice] = useState(false);
  const durationRef = useRef(0);

  // Segment selection state
  const [isDraggingSegment, setIsDraggingSegment] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(null);
  const [dragCurrentTime, setDragCurrentTime] = useState(null);
  const dragStartRef = useRef(null);
  const dragCurrentRef = useRef(null);
  const isDraggingRef = useRef(false);
  
  // Animation state for processing
  const [animationTime, setAnimationTime] = useState(0);
  const processingAnimationRef = useRef(null);
  
  // Handle processing animation
  useEffect(() => {
    if (isProcessingSegment) {
      const startTime = performance.now();
      
      const animate = () => {
        const elapsed = performance.now() - startTime;
        setAnimationTime(elapsed);
        processingAnimationRef.current = requestAnimationFrame(animate);
      };
      
      processingAnimationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (processingAnimationRef.current) {
          cancelAnimationFrame(processingAnimationRef.current);
        }
      };
    } else {
      // Reset animation when processing stops
      setAnimationTime(0);
      if (processingAnimationRef.current) {
        cancelAnimationFrame(processingAnimationRef.current);
      }
    }
  }, [isProcessingSegment]);

  // Calculate minimum zoom level based on duration to limit view to 300 seconds
  const calculateMinZoom = (duration) => {
    if (!duration || duration <= 300) return 1;
    return duration / 300; // Ensure max visible time is 300 seconds
  };

  // Get current video duration from the video element
  useEffect(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      const updateDuration = () => {
        if (videoElement.duration && !isNaN(videoElement.duration)) {
          durationRef.current = videoElement.duration;

          // Enforce minimum zoom level when duration changes
          const minZoom = calculateMinZoom(durationRef.current);
          if (zoom < minZoom && setZoom) {
            setZoom(minZoom);
          }
        }
      };

      // Update duration when metadata is loaded
      videoElement.addEventListener('loadedmetadata', updateDuration);

      // Check if duration is already available
      if (videoElement.duration && !isNaN(videoElement.duration)) {
        updateDuration();
      }

      return () => {
        videoElement.removeEventListener('loadedmetadata', updateDuration);
      };
    }
  }, [zoom, setZoom]);

  // Update durationRef when video metadata is loaded
  useEffect(() => {
    const videoElement = document.querySelector('video');
    if (videoElement && videoElement.duration && !isNaN(videoElement.duration)) {
      durationRef.current = videoElement.duration;
    }
  }, []);

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
  // Initialize currentZoomRef with the correct zoom level
  const currentZoomRef = useRef(zoom);

  // Update currentZoomRef immediately when zoom prop changes
  useEffect(() => {
    // Ensure we respect the minimum zoom level
    if (duration) {
      const minZoom = calculateMinZoom(duration);
      const effectiveZoom = Math.max(minZoom, zoom);
      currentZoomRef.current = effectiveZoom;
    } else {
      currentZoomRef.current = zoom;
    }
  }, [zoom, duration]);
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
    if (!canvas) return;

    // Use a default duration if none is provided (for debugging)
    const effectiveDuration = duration || 60; // Default to 60 seconds for testing

    canvasWidthRef.current = canvas.clientWidth;

    // Use the provided temporary pan offset during active panning, or the state value
    const effectivePanOffset = tempPanOffset !== null ? tempPanOffset : panOffset;

    // Get visible time range with the effective pan offset
    const visibleTimeRange = tempPanOffset !== null
      ? getVisibleRangeWithTempOffset(effectivePanOffset)
      : getTimeRange();

    // Prepare segment data for drawing
    const segmentData = {
      selectedSegment,
      isDraggingSegment,
      dragStartTime,
      dragCurrentTime,
      isProcessing: isProcessingSegment,
      animationTime
    };

    // Draw the timeline
    drawTimeline(
      canvas,
      effectiveDuration,
      lyrics,
      currentTime,
      visibleTimeRange,
      effectivePanOffset,
      tempPanOffset !== null, // isActivePanning
      timeFormat,
      segmentData
    );
  }, [lyrics, currentTime, duration, getTimeRange, panOffset, getVisibleRangeWithTempOffset, timeFormat, selectedSegment, isDraggingSegment, dragStartTime, dragCurrentTime, isProcessingSegment, animationTime]);

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
        if (!container) return;

        // Use requestAnimationFrame to ensure layout is complete
        requestAnimationFrame(() => {
          const rect = container.getBoundingClientRect();

          // Set CSS style dimensions to match container
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = '50px';

          // The actual canvas dimensions will be set by TimelineDrawing.js
          // based on clientWidth/clientHeight and DPR
          renderTimeline();
        });
      };

      // Use ResizeObserver for more accurate container size changes
      const resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });

      // Observe the container for size changes
      resizeObserver.observe(container);

      // Also listen to window resize as fallback
      window.addEventListener('resize', resizeCanvas);

      // Initial resize
      resizeCanvas();

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [renderTimeline]);

  // Add keyboard shortcut to toggle auto-scrolling
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+S to toggle auto-scrolling
      if (e.altKey && e.key === 's') {
        disableAutoScroll.current = !disableAutoScroll.current;


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
            renderTimeline();
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
    if (timelineRef.current && (lyrics.length > 0 || onSegmentSelect)) {
      lastTimeRef.current = currentTime;
      renderTimeline();

      // For long videos, optimize memory usage by clearing unused chunks
      if (duration > 1800 && videoSource) { // 30 minutes
        // Clear unused video chunks to free up memory
        clearUnusedChunks(videoSource, currentTime, duration);
      }
    }
  }, [lyrics, currentTime, duration, zoom, panOffset, renderTimeline, videoSource, onSegmentSelect]);

  // Initial render when component mounts or when segment selection is enabled
  useEffect(() => {
    if (timelineRef.current && onSegmentSelect) {
      renderTimeline();
    }
  }, [onSegmentSelect, renderTimeline]);

  // Re-render when drag state changes to show visual feedback
  useEffect(() => {
    if (timelineRef.current && (isDraggingSegment || dragStartTime !== null || dragCurrentTime !== null)) {
      renderTimeline();
    }
  }, [isDraggingSegment, dragStartTime, dragCurrentTime, renderTimeline]);



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

  // Convert pixel position to time
  const pixelToTime = (pixelX) => {
    const canvas = timelineRef.current;
    const effectiveDuration = duration || 60;
    if (!canvas) return 0;

    const rect = canvas.getBoundingClientRect();
    const relativeX = pixelX - rect.left;
    const timeRange = getTimeRange();
    const timePerPixel = (timeRange.end - timeRange.start) / canvas.clientWidth;

    return Math.max(0, Math.min(effectiveDuration, timeRange.start + (relativeX * timePerPixel)));
  };

  // Handle right-click on selected segment
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we have a selected segment and the click is within its bounds
    if (selectedSegment && onSegmentSelect) {
      const clickTime = pixelToTime(e.clientX);
      
      // Check if the click is within the selected segment range
      if (clickTime >= selectedSegment.start && clickTime <= selectedSegment.end) {
        console.log('[Timeline] Right-click on selected segment - opening video processing modal');
        // Trigger the segment selection callback to open the modal
        onSegmentSelect(selectedSegment);
      }
    }
  };
  
  // Handle mouse down - supports both click and drag
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const startTime = pixelToTime(e.clientX);
    const startX = e.clientX;
    let hasMoved = false;
    let dragThreshold = 5; // pixels - minimum movement to consider it a drag

    console.log('[Timeline] Mouse down at time:', startTime.toFixed(2), 's');

    // Initialize drag state for segment selection (if enabled)
    if (onSegmentSelect) {
      setDragStartTime(startTime);
      setDragCurrentTime(startTime);
      dragStartRef.current = startTime;
      dragCurrentRef.current = startTime;
    }

    const handleMouseMove = (moveEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);

      // Check if we've moved enough to consider this a drag
      if (deltaX > dragThreshold) {
        hasMoved = true;

        // Only handle drag if segment selection is enabled
        if (onSegmentSelect) {
          if (!isDraggingRef.current) {
            setIsDraggingSegment(true);
            isDraggingRef.current = true;
          }

          const currentTime = pixelToTime(moveEvent.clientX);

          // Only update if the time has changed significantly (avoid excessive updates)
          if (Math.abs(currentTime - (dragCurrentRef.current || 0)) > 0.1) {
            setDragCurrentTime(currentTime);
            dragCurrentRef.current = currentTime;
          }
        }
      }
    };

    const handleMouseUp = (upEvent) => {
      if (hasMoved && onSegmentSelect && isDraggingRef.current) {
        // This was a drag - handle segment selection
        console.log('[Timeline] Drag detected - creating segment');
        if (dragStartRef.current !== null && dragCurrentRef.current !== null) {
          const start = Math.min(dragStartRef.current, dragCurrentRef.current);
          const end = Math.max(dragStartRef.current, dragCurrentRef.current);

          // Only create segment if there's a meaningful duration (at least 1 second)
          if (end - start >= 1) {
            console.log('[Timeline] Creating segment:', start.toFixed(2), '-', end.toFixed(2), 's');
            onSegmentSelect({ start, end });
          } else {
            console.log('[Timeline] Segment too short, ignoring');
          }
        }
      } else if (!hasMoved) {
        // This was a click - handle timeline seeking
        const clickTime = pixelToTime(upEvent.clientX);
        console.log('[Timeline] Click detected - seeking to:', clickTime.toFixed(2), 's');
        handleClick(
          upEvent,
          timelineRef.current,
          duration,
          onTimelineClick,
          getTimeRange(),
          lastManualPanTime
        );
      }

      // Clean up drag state
      if (onSegmentSelect) {
        setIsDraggingSegment(false);
        setDragStartTime(null);
        setDragCurrentTime(null);
        dragStartRef.current = null;
        dragCurrentRef.current = null;
        isDraggingRef.current = false;
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Note: Timeline click handling is now integrated into handleMouseDown
  // to support both click-to-seek and drag-to-select functionality

  return (
    <div className="timeline-container">
      <canvas
        ref={timelineRef}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        className="subtitle-timeline"
        style={{
          cursor: isDraggingSegment
            ? 'ew-resize'
            : onSegmentSelect
              ? 'crosshair'
              : 'pointer'
        }}
      />

      {/* Liquid Glass zoom controls in top right corner */}
      {setZoom && (
        <LiquidGlass
          width={80}
          height={32}
          position="absolute"
          top="8px"
          right="8px"
          borderRadius="16px"
          className="content-center theme-primary size-small"
          cursor="ew-resize"
          zIndex={10}
          effectIntensity={0.8}
          effectRadius={0.4}
          effectWidth={0.25}
          effectHeight={0.15}
          animateOnHover={true}
          hoverScale={1.05}
          updateOnMouseMove={true}
          aria-label={t('timeline.dragToZoom', 'Drag to zoom')}
          style={{
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'ew-resize'
            }}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startZoom = zoom;
              const minZoom = calculateMinZoom(durationRef.current);

              const handleMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                // Increased sensitivity for more responsive zooming
                // Increased maximum zoom level from 50 to 200 for more detailed view
                const newZoom = Math.max(minZoom, Math.min(200, startZoom + (deltaX * 0.05)));
                setZoom(newZoom);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--md-on-surface)',
              fontFamily: 'JetBrains Mono, monospace',
              userSelect: 'none',
              pointerEvents: 'none'
            }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </LiquidGlass>
      )}

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