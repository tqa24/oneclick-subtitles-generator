import React, { useEffect, useCallback, useRef } from 'react';
import { formatTime } from '../../utils/timeFormatter';

// Simple hash function for consistent colors
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; str.length > i; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Color cache to avoid recalculating colors for the same text
const colorCache = new Map();

// Get color for a lyric, using cache for better performance
const getLyricColor = (text, isDark) => {
  const cacheKey = `${text}-${isDark}`;

  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey);
  }

  const hash = hashString(text);
  const hue = hash % 360;
  const saturation = 70 + (hash % 20); // Vary saturation slightly
  const lightness = isDark ? '40%' : '60%';
  const alpha = isDark ? '0.8' : '0.7';

  const colors = {
    fillStyle: `hsla(${hue}, ${saturation}%, ${lightness}, ${alpha})`,
    strokeStyle: `hsla(${hue}, ${saturation}%, ${isDark ? '50%' : '40%'}, 0.9)`
  };

  colorCache.set(cacheKey, colors);
  return colors;
};

const TimelineVisualization = ({
  lyrics,
  currentTime,
  duration,
  onTimelineClick,
  zoom,
  panOffset,
  setPanOffset,
  centerOnTime, // Prop to center the view on a specific time
  timeFormat = 'seconds' // Prop to control time display format
}) => {
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

  // Calculate minimum zoom level to limit visible timeline to 300 seconds
  const calculateMinZoom = useCallback((totalDuration) => {
    if (!totalDuration || totalDuration <= 300) return 1;
    return totalDuration / 300; // Ensure max visible time is 300 seconds
  }, []);

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
  }, [duration, zoom, panOffset, setPanOffset, calculateMinZoom]);

  // Calculate visible time range with playhead-centered zoom
  const getVisibleTimeRange = useCallback(() => {
    const maxLyricTime = lyrics.length > 0
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;

    // Ensure zoom respects minimum zoom level
    const minZoom = calculateMinZoom(timelineEnd);
    const effectiveZoom = Math.max(minZoom, zoom);

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

    // Calculate visible duration based on effective zoom
    const visibleDuration = timelineEnd / effectiveZoom;

    // Ensure visible duration doesn't exceed 300 seconds
    const maxVisibleDuration = Math.min(visibleDuration, 300);

    const start = panOffset;
    const end = Math.min(timelineEnd, start + maxVisibleDuration);

    return { start, end, total: timelineEnd };
  }, [lyrics, duration, panOffset, zoom, currentTime, setPanOffset, calculateMinZoom]);

  // Calculate the playhead position on screen
  const calculatePlayheadPosition = useCallback(() => {
    if (!timelineRef.current || !duration) return null;

    const canvas = timelineRef.current;
    const displayWidth = canvas.clientWidth;
    canvasWidthRef.current = displayWidth;

    const { start: visibleStart, end: visibleEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;

    // Calculate the pixel position
    if (currentTime >= visibleStart && currentTime <= visibleEnd) {
      return ((currentTime - visibleStart) / visibleDuration) * displayWidth;
    }

    return null;
  }, [currentTime, getVisibleTimeRange, duration]);

  // Store the playhead position before zooming
  // This effect is no longer needed since we removed the playhead animation
  useEffect(() => {
    // No-op - we've removed the playhead animation
  }, [calculatePlayheadPosition]);

  // Function to center the timeline view on a specific time
  const centerTimelineOnTime = useCallback((time) => {
    if (!duration) return;

    // Get the current timeline end
    const maxLyricTime = lyrics.length > 0
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;

    // Ensure we respect the minimum zoom level
    const minZoom = calculateMinZoom(timelineEnd);
    const effectiveZoom = Math.max(minZoom, currentZoomRef.current);

    // Calculate visible duration based on effective zoom
    const totalVisibleDuration = Math.min(timelineEnd / effectiveZoom, 300);
    const halfVisibleDuration = totalVisibleDuration / 2;

    // Center the view on the specified time
    const newPanOffset = Math.max(0, Math.min(time - halfVisibleDuration, timelineEnd - totalVisibleDuration));

    // Update the pan offset
    setPanOffset(newPanOffset);

    // Record this as a manual interaction to prevent auto-scrolling
    lastManualPanTime.current = performance.now();

    console.log(`Centered timeline on time: ${time}s, new offset: ${newPanOffset}`);
  }, [lyrics, duration, calculateMinZoom, setPanOffset]);

  // Watch for centerOnTime prop changes
  useEffect(() => {
    if (centerOnTime !== undefined && centerOnTime !== null) {
      centerTimelineOnTime(centerOnTime);
    }
  }, [centerOnTime, centerTimelineOnTime]);

  // Helper function to calculate visible time range with a temporary pan offset
  // This avoids creating a dependency on the state panOffset during active panning
  const calculateVisibleTimeRange = useCallback((tempPanOffset) => {
    const maxLyricTime = lyrics.length > 0
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;

    // Ensure zoom respects minimum zoom level
    const minZoom = calculateMinZoom(timelineEnd);
    const effectiveZoom = Math.max(minZoom, currentZoomRef.current);

    // Calculate visible duration based on effective zoom
    const visibleDuration = timelineEnd / effectiveZoom;

    // Ensure visible duration doesn't exceed 300 seconds
    const maxVisibleDuration = Math.min(visibleDuration, 300);

    const start = tempPanOffset;
    const end = Math.min(timelineEnd, start + maxVisibleDuration);

    return { start, end, total: timelineEnd };
  }, [lyrics, duration, calculateMinZoom]);

  // Draw the timeline visualization with optimizations
  const drawTimeline = useCallback((tempPanOffset = null) => {
    const canvas = timelineRef.current;
    if (!canvas || !duration) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for non-transparent canvas
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvasWidthRef.current = displayWidth;

    // Set canvas dimensions with proper DPR handling
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = displayWidth * dpr;
    const scaledHeight = displayHeight * dpr;

    // Only resize canvas if dimensions have changed
    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      ctx.scale(dpr, dpr);
    }

    // Get computed colors from the container element for theme support
    const computedStyle = getComputedStyle(canvas.parentElement);
    const bgColor = computedStyle.backgroundColor;
    const borderColor = computedStyle.borderColor;
    const textColor = computedStyle.color;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    const isDark = computedStyle.backgroundColor.includes('rgb(30, 30, 30)');

    // Use the provided temporary pan offset during active panning, or the state value
    const effectivePanOffset = tempPanOffset !== null ? tempPanOffset : panOffset;

    // Get visible time range with the effective pan offset
    const { start: visibleStart, end: visibleEnd } =
      tempPanOffset !== null
        ? calculateVisibleTimeRange(effectivePanOffset)
        : getVisibleTimeRange();

    const visibleDuration = visibleEnd - visibleStart;

    // Clear the canvas with a single operation
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Function to convert time to x coordinate
    const timeToX = (time) => ((time - visibleStart) / visibleDuration) * displayWidth;

    // Calculate proper spacing for time markers based on zoom level and visible duration
    // Adaptive time step calculation for better performance with long videos
    const maxMarkers = 20; // Maximum number of time markers to display
    const timeStep = Math.max(1, Math.ceil(visibleDuration / maxMarkers));
    const firstMarker = Math.floor(visibleStart / timeStep) * timeStep;

    // Only draw time markers if we're not actively panning or if the visible duration is reasonable
    if (tempPanOffset === null || visibleDuration < 300) {
      // Batch time markers drawing
      ctx.beginPath();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;

      // Limit the number of markers to draw
      const markerCount = Math.min(maxMarkers, Math.ceil(visibleDuration / timeStep));

      for (let i = 0; i <= markerCount; i++) {
        const time = firstMarker + (i * timeStep);
        if (time > visibleEnd) break;

        const x = timeToX(time);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, displayHeight);
      }
      ctx.stroke();

      // Draw time labels - only if not actively panning for better performance
      if (tempPanOffset === null) {
        ctx.font = '10px Arial';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillStyle = textColor;

        for (let i = 0; i <= markerCount; i++) {
          const time = firstMarker + (i * timeStep);
          if (time > visibleEnd) break;

          const x = timeToX(time);
          ctx.fillText(formatTime(time, timeFormat), x + 3, 2);
        }
      }
    }

    // Optimize lyric segments rendering
    // Increase minimum segment width during panning for better performance
    const minSegmentWidth = tempPanOffset !== null ? 4 : 2;

    // Filter visible lyrics - use a more efficient approach with segment limiting
    const visibleLyrics = [];
    const maxSegmentsToRender = 300; // Limit the number of segments to render for performance

    // Binary search to find the approximate starting index
    let startIdx = 0;
    let endIdx = lyrics.length - 1;

    // Find the first lyric that might be visible
    while (startIdx <= endIdx) {
      const midIdx = Math.floor((startIdx + endIdx) / 2);
      const midLyric = lyrics[midIdx];

      if (midLyric.end < visibleStart) {
        startIdx = midIdx + 1;
      } else {
        endIdx = midIdx - 1;
      }
    }

    // Collect visible lyrics starting from the found index
    let segmentCount = 0;
    for (let i = startIdx; i < lyrics.length && segmentCount < maxSegmentsToRender; i++) {
      const lyric = lyrics[i];

      // Stop once we're past the visible area
      if (lyric.start > visibleEnd) break;

      const startX = timeToX(lyric.start);
      const endX = timeToX(lyric.end);

      // Only add if the segment is wide enough to be visible
      if ((endX - startX) >= minSegmentWidth) {
        visibleLyrics.push({
          lyric,
          startX,
          width: endX - startX
        });
        segmentCount++;
      }
    }

    // If we hit the segment limit, add an indicator
    if (segmentCount >= maxSegmentsToRender && lyrics.length > maxSegmentsToRender) {
      console.log(`Timeline rendering limited to ${maxSegmentsToRender} segments out of ${lyrics.length} total`);
    }

    // Batch render all segments with same fill color
    if (visibleLyrics.length > 0) {
      // Group segments by color for batch rendering
      const colorGroups = new Map();

      for (const { lyric, startX, width } of visibleLyrics) {
        const { fillStyle, strokeStyle } = getLyricColor(lyric.text, isDark);

        if (!colorGroups.has(fillStyle)) {
          colorGroups.set(fillStyle, {
            fill: fillStyle,
            stroke: strokeStyle,
            segments: []
          });
        }

        colorGroups.get(fillStyle).segments.push({
          x: startX,
          width: width
        });
      }

      // Render each color group in a batch
      colorGroups.forEach(group => {
        ctx.fillStyle = group.fill;

        // Draw all fills for this color at once
        for (const segment of group.segments) {
          ctx.fillRect(segment.x, displayHeight * 0.3, segment.width, displayHeight * 0.7);
        }

        // Only draw strokes if not actively panning (for better performance)
        if (tempPanOffset === null) {
          ctx.strokeStyle = group.stroke;
          for (const segment of group.segments) {
            ctx.strokeRect(segment.x, displayHeight * 0.3, segment.width, displayHeight * 0.7);
          }
        }
      });
    }

    // Draw current time indicator
    if (currentTime >= visibleStart && currentTime <= visibleEnd) {
      const currentX = timeToX(currentTime);

      // We no longer need to store the playhead position for zoom animations
      // since we've removed the dragging functionality

      // Use path for better performance
      ctx.beginPath();
      ctx.fillStyle = primaryColor;

      // Draw playhead triangle
      ctx.moveTo(currentX - 6, 0);
      ctx.lineTo(currentX + 6, 0);
      ctx.lineTo(currentX, 6);
      ctx.closePath();
      ctx.fill();

      // Draw indicator line
      ctx.fillRect(currentX - 1, 0, 3, displayHeight);
    }
  }, [lyrics, currentTime, duration, getVisibleTimeRange, panOffset, calculateVisibleTimeRange]);

  // Simplified zoom animation function - just set zoom and let getVisibleTimeRange handle panOffset
  const animateZoom = useCallback((targetZoom) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Ensure target zoom respects minimum zoom level
    const maxLyricTime = lyrics.length > 0
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;
    const minZoom = calculateMinZoom(timelineEnd);
    const effectiveTargetZoom = Math.max(minZoom, targetZoom);

    // Let getVisibleTimeRange recalculate panOffset to center on playhead
    currentZoomRef.current = effectiveTargetZoom;
    drawTimeline();
  }, [drawTimeline, lyrics, duration, calculateMinZoom]);

  // Update zoom with animation when zoom prop changes
  useEffect(() => {
    if (zoom !== currentZoomRef.current) {
      animateZoom(zoom);
    }
  }, [zoom, animateZoom]);





  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
  }, [drawTimeline]);

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
  }, [drawTimeline]);

  // Handle timeline updates
  useEffect(() => {
    if (timelineRef.current && lyrics.length > 0) {
      lastTimeRef.current = currentTime;
      drawTimeline();
    }
  }, [lyrics, currentTime, duration, zoom, panOffset, drawTimeline]);



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
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
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

    return () => {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
      }
    };
  }, [currentTime, duration, getVisibleTimeRange, panOffset, setPanOffset, calculateMinZoom]);

  // Handle timeline click with zoom consideration
  const handleTimelineClick = (e) => {
    // Check if we can handle the click
    if (!timelineRef.current || !duration || !onTimelineClick) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const { start: visibleStart, end: visibleEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;

    // Calculate the new time based on click position
    const newTime = visibleStart + (clickX / rect.width) * visibleDuration;

    if (newTime >= 0 && newTime <= duration) {
      // Record this as a manual interaction to prevent auto-scrolling
      lastManualPanTime.current = performance.now();

      // Just seek to the new time without changing the view position
      // This eliminates the shaking effect by avoiding multiple view transitions
      onTimelineClick(Math.min(duration, newTime));

      // The view will be centered automatically when the currentTime prop updates
      // This creates a single, smooth transition instead of multiple jerky ones
    }
  };

  return (
    <div className="timeline-container">
      <canvas
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="subtitle-timeline"
        style={{ cursor: 'pointer' }}
      />
    </div>
  );
};

export default TimelineVisualization;