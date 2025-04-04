import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';

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

const TimelineVisualization = ({
  lyrics,
  currentTime,
  duration,
  onTimelineClick,
  zoom,
  panOffset,
  setPanOffset
}) => {
  const timelineRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isPanning = useRef(false);
  const lastPanX = useRef(0);
  const justPanned = useRef(false);
  const animationFrameRef = useRef(null);
  const currentZoomRef = useRef(zoom);
  const autoScrollRef = useRef(null);
  const isScrollingRef = useRef(false);
  const [playheadX, setPlayheadX] = useState(null);
  const canvasWidthRef = useRef(0);

  // Calculate minimum zoom level to limit visible timeline to 600 seconds
  const calculateMinZoom = useCallback((totalDuration) => {
    if (!totalDuration || totalDuration <= 600) return 1;
    return totalDuration / 600; // Ensure max visible time is 600 seconds
  }, []);

  // Ensure zoom level respects the minimum zoom
  useEffect(() => {
    if (duration) {
      const minZoom = calculateMinZoom(duration);
      if (zoom < minZoom) {
        // Use requestAnimationFrame to avoid state update during render
        requestAnimationFrame(() => {
          setPanOffset(Math.min(panOffset, Math.max(0, duration - 600)));
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

    // Ensure visible duration doesn't exceed 600 seconds
    const maxVisibleDuration = Math.min(visibleDuration, 600);

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
  useEffect(() => {
    setPlayheadX(calculatePlayheadPosition());
  }, [calculatePlayheadPosition]);

  // Draw the timeline visualization with optimizations
  const drawTimeline = useCallback(() => {
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

    // Draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;

    // Function to convert time to x coordinate
    const timeToX = (time) => ((time - visibleStart) / visibleDuration) * displayWidth;

    // Calculate proper spacing for time markers based on zoom level
    const timeStep = Math.max(1, Math.ceil(visibleDuration / 15));
    const firstMarker = Math.floor(visibleStart / timeStep) * timeStep;

    // Batch time markers drawing
    ctx.beginPath();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;

    for (let time = firstMarker; time <= visibleEnd; time += timeStep) {
      const x = timeToX(time);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, displayHeight);
    }
    ctx.stroke();

    // Draw time labels
    ctx.font = '10px Arial';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;

    for (let time = firstMarker; time <= visibleEnd; time += timeStep) {
      const x = timeToX(time);
      ctx.fillText(`${Math.round(time)}s`, x + 3, 2);
    }

    // Optimize lyric segments rendering
    const minSegmentWidth = 2; // Minimum width to render a segment
    const visibleLyrics = lyrics.filter(lyric => {
      if (lyric.end < visibleStart || lyric.start > visibleEnd) return false;
      const startX = timeToX(lyric.start);
      const endX = timeToX(lyric.end);
      return (endX - startX) >= minSegmentWidth;
    });

    // Create a buffer for batch rendering
    const segmentBuffer = [];
    visibleLyrics.forEach(lyric => {
      const startX = timeToX(lyric.start);
      const endX = timeToX(lyric.end);
      const segmentWidth = endX - startX;

      // Generate consistent color based on lyric content
      const hash = hashString(lyric.text);
      const hue = hash % 360;
      const saturation = 70 + (hash % 20); // Vary saturation slightly
      const isDark = computedStyle.backgroundColor.includes('rgb(30, 30, 30)');
      const lightness = isDark ? '40%' : '60%';
      const alpha = isDark ? '0.8' : '0.7';

      segmentBuffer.push({
        x: startX,
        width: segmentWidth,
        fillStyle: `hsla(${hue}, ${saturation}%, ${lightness}, ${alpha})`,
        strokeStyle: `hsla(${hue}, ${saturation}%, ${isDark ? '50%' : '40%'}, 0.9)`
      });
    });

    // Batch render segments for better performance
    segmentBuffer.forEach(segment => {
      ctx.fillStyle = segment.fillStyle;
      ctx.fillRect(segment.x, displayHeight * 0.3, segment.width, displayHeight * 0.7);
      ctx.strokeStyle = segment.strokeStyle;
      ctx.strokeRect(segment.x, displayHeight * 0.3, segment.width, displayHeight * 0.7);
    });

    // Draw current time indicator
    if (currentTime >= visibleStart && currentTime <= visibleEnd) {
      const currentX = timeToX(currentTime);

      // Store the current playhead position for zoom animations
      setPlayheadX(currentX);

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
  }, [lyrics, currentTime, duration, getVisibleTimeRange]);

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

  // Handle timeline updates
  useEffect(() => {
    if (timelineRef.current && lyrics.length > 0) {
      lastTimeRef.current = currentTime;
      drawTimeline();
    }
  }, [lyrics, currentTime, duration, zoom, panOffset, drawTimeline]);

  // Ensure playhead stays visible by auto-scrolling
  useEffect(() => {
    if (!duration || isPanning.current) return;

    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;
    const margin = visibleDuration * 0.2;

    // Only scroll if we're significantly off-center and not already scrolling
    const isFarFromCenter = Math.abs(currentTime - (visibleStart + visibleDuration / 2)) > visibleDuration * 0.3;

    if (!isScrollingRef.current && (currentTime < visibleStart + margin || currentTime > visibleEnd - margin) && isFarFromCenter) {
      isScrollingRef.current = true;

      // Ensure we respect the minimum zoom level
      const minZoom = calculateMinZoom(timelineEnd);
      const effectiveZoom = Math.max(minZoom, currentZoomRef.current);

      // Limit visible duration to 600 seconds
      const totalVisibleDuration = Math.min(timelineEnd / effectiveZoom, 600);
      const halfVisibleDuration = totalVisibleDuration / 2;
      const targetOffset = Math.max(0, Math.min(currentTime - halfVisibleDuration, timelineEnd - totalVisibleDuration));

      // Don't scroll if we're already close to the target
      if (Math.abs(targetOffset - panOffset) < 0.1) {
        isScrollingRef.current = false;
        return;
      }

      // Cancel any existing animation
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
      }

      const startPanOffset = panOffset;
      const endPanOffset = targetOffset;
      const startTime = performance.now();
      const animDuration = 500;

      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / animDuration, 1);

        const easeOutProgress = 1 - Math.pow(1 - progress, 3);
        const newOffset = startPanOffset + (endPanOffset - startPanOffset) * easeOutProgress;

        setPanOffset(newOffset);

        if (progress < 1) {
          autoScrollRef.current = requestAnimationFrame(animate);
        } else {
          isScrollingRef.current = false;
          autoScrollRef.current = null;
        }
      };

      autoScrollRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current);
      }
    };
  }, [currentTime, duration, getVisibleTimeRange, panOffset, setPanOffset, calculateMinZoom]);

  // Handle mouse down for panning
  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click only
      e.preventDefault(); // Prevent text selection
      isPanning.current = true;
      justPanned.current = false; // Reset the panned state
      lastPanX.current = e.clientX;
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e) => {
    if (!isPanning.current) return;

    e.preventDefault();
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - lastPanX.current;

    // Increase panning sensitivity with a multiplier
    const panSensitivity = 1.05; // Higher value = more sensitive panning
    const scaledDeltaX = deltaX * panSensitivity;

    // Apply sensitivity to time delta calculation
    const timeDelta = (scaledDeltaX / rect.width) * (visibleEnd - visibleStart);

    if (Math.abs(deltaX) > 2) { // If we've moved more than 2 pixels
      justPanned.current = true; // Mark that we've panned
    }

    // Calculate new pan offset
    const newPanOffset = Math.max(0, panOffset - timeDelta);

    // Only update if we're not at the boundaries or if we're moving away from them
    const isAtStart = panOffset <= 0;
    const isAtEnd = visibleEnd >= timelineEnd;

    if ((!isAtStart || deltaX < 0) && (!isAtEnd || deltaX > 0)) {
      // Additional boundary check for the end
      if (isAtEnd && deltaX > 0) {
        // If at the end, only allow panning left
        if (timeDelta > 0) {
          setPanOffset(newPanOffset);
        }
      } else {
        setPanOffset(newPanOffset);
      }
      lastPanX.current = e.clientX;
    }
  };

  // Handle mouse up to end panning
  const handleMouseUp = (e) => {
    if (isPanning.current) {
      e.preventDefault();
      e.stopPropagation();
      isPanning.current = false;
      if (timelineRef.current) {
        timelineRef.current.style.cursor = 'grab';
      }

      // Clear the panned state after a short delay
      setTimeout(() => {
        justPanned.current = false;
      }, 100);
    }
  };

  // Handle timeline click with zoom consideration
  const handleTimelineClick = (e) => {
    // Prevent seeking if we just finished panning
    if (!timelineRef.current || !duration || !onTimelineClick || justPanned.current) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;

    const newTime = visibleStart + (clickX / rect.width) * visibleDuration;

    if (newTime >= 0 && newTime <= duration) {
      // Ensure we respect the minimum zoom level
      const minZoom = calculateMinZoom(timelineEnd);
      const effectiveZoom = Math.max(minZoom, currentZoomRef.current);

      // Calculate new pan offset while maintaining current zoom level
      const totalVisibleDuration = Math.min(timelineEnd / effectiveZoom, 600);
      const halfVisibleDuration = totalVisibleDuration / 2;
      const newPanOffset = Math.max(0, Math.min(newTime - halfVisibleDuration, timelineEnd - totalVisibleDuration));

      // Update pan offset first, then trigger the time change
      setPanOffset(newPanOffset);
      requestAnimationFrame(() => {
        onTimelineClick(Math.min(duration, newTime));
      });
    }
  };

  return (
    <div className="timeline-container">
      <canvas
        ref={timelineRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleTimelineClick}
        className="subtitle-timeline"
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
      />
    </div>
  );
};

export default TimelineVisualization;