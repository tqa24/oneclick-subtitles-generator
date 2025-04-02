import React, { useEffect, useCallback, useRef } from 'react';

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

  // Calculate visible time range first, since drawTimeline depends on it
  const getVisibleTimeRange = useCallback(() => {
    const maxLyricTime = lyrics.length > 0 
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;
    
    const visibleDuration = timelineEnd / currentZoomRef.current;
    const start = Math.max(0, panOffset);
    const end = Math.min(timelineEnd, start + visibleDuration);
    
    return { start, end, total: timelineEnd };
  }, [lyrics, duration, panOffset]);

  // Draw the timeline visualization
  const drawTimeline = useCallback(() => {
    const canvas = timelineRef.current;
    if (!canvas || !duration) return;
    
    const ctx = canvas.getContext('2d');
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // Set canvas dimensions for proper resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    // Draw background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    const { start: visibleStart, end: visibleEnd, total: timelineEnd } = getVisibleTimeRange();
    const visibleDuration = visibleEnd - visibleStart;
    
    // Function to convert time to x coordinate
    const timeToX = (time) => {
      return ((time - visibleStart) / visibleDuration) * displayWidth;
    };
    
    // Draw lyric segments
    lyrics.forEach((lyric, index) => {
      // Skip segments completely outside visible range
      if (lyric.end < visibleStart || lyric.start > visibleEnd) return;
      
      const startX = timeToX(lyric.start);
      const endX = timeToX(lyric.end);
      const segmentWidth = Math.max(2, endX - startX); // Minimum width of 2px
      
      // Get a color based on the index
      const hue = (index * 30) % 360;
      ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
      ctx.fillRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
      
      // Draw border
      ctx.strokeStyle = `hsla(${hue}, 70%, 40%, 0.9)`;
      ctx.strokeRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
    });
    
    // Draw time markers
    ctx.fillStyle = '#ddd';
    
    // Calculate proper spacing for time markers based on zoom level
    const timeStep = Math.max(1, Math.ceil(visibleDuration / 15));
    const firstMarker = Math.floor(visibleStart / timeStep) * timeStep;
    
    for (let time = firstMarker; time <= visibleEnd; time += timeStep) {
      const x = timeToX(time);
      // Draw full-height vertical lines
      ctx.fillRect(x, 0, 1, displayHeight);
      
      // Draw time labels at the top
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(time)}s`, x + 3, 2);
      ctx.fillStyle = '#ddd';
    }
    
    // Draw current time indicator
    if (currentTime >= visibleStart && currentTime <= visibleEnd) {
      const currentX = timeToX(currentTime);
      
      // Draw indicator shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(currentX - 2, 0, 4, displayHeight);
      
      // Draw indicator
      ctx.fillStyle = 'red';
      ctx.fillRect(currentX - 1, 0, 3, displayHeight);
      
      // Draw playhead triangle
      ctx.beginPath();
      ctx.moveTo(currentX - 6, 0);
      ctx.lineTo(currentX + 6, 0);
      ctx.lineTo(currentX, 6);
      ctx.closePath();
      ctx.fill();
    }
  }, [lyrics, currentTime, duration, getVisibleTimeRange]);

  // Smoothly animate zoom
  const animateZoom = useCallback((targetZoom) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startZoom = currentZoomRef.current;
    const zoomDiff = targetZoom - startZoom;
    const startTime = performance.now();
    const animDuration = 300; // Animation duration in ms

    // Calculate the time range before zooming
    const { start: oldStart, end: oldEnd, total: timelineEnd } = getVisibleTimeRange();
    const oldVisibleDuration = oldEnd - oldStart;
    const oldViewCenter = oldStart + (oldVisibleDuration / 2);

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / animDuration, 1);
      
      // Ease out cubic function for smooth deceleration
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      currentZoomRef.current = startZoom + (zoomDiff * easeOutCubic);
      
      // Calculate new visible duration at current zoom level
      const newVisibleDuration = timelineEnd / currentZoomRef.current;
      
      // Calculate new pan offset to maintain the same view center
      const newStart = oldViewCenter - (newVisibleDuration / 2);
      const boundedStart = Math.min(Math.max(0, newStart), timelineEnd - newVisibleDuration);
      
      setPanOffset(boundedStart);
      drawTimeline();

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        currentZoomRef.current = targetZoom;
        drawTimeline();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [getVisibleTimeRange, setPanOffset, drawTimeline]);

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
    const timeDelta = (deltaX / rect.width) * (visibleEnd - visibleStart);
    
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
    const { start: visibleStart, end: visibleEnd } = getVisibleTimeRange();
    
    const newTime = visibleStart + (clickX / rect.width) * (visibleEnd - visibleStart);
    
    if (newTime >= 0 && newTime <= duration) {
      onTimelineClick(Math.min(duration, newTime));
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