import React, { useEffect, useCallback, useRef } from 'react';

const TimelineVisualization = ({ lyrics, currentTime, duration, onTimelineClick }) => {
  const timelineRef = useRef(null);
  const lastTimeRef = useRef(0);

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
    
    // Find the max time to use same scale as drawing
    const maxLyricTime = lyrics.length > 0 
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    
    // Use the greater of actual duration or max lyric time 
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05; // Add 5% padding
    
    // Draw lyric segments FIRST (below time markers)
    lyrics.forEach((lyric, index) => {
      const startX = (lyric.start / timelineEnd) * displayWidth;
      const endX = (lyric.end / timelineEnd) * displayWidth;
      const segmentWidth = Math.max(1, endX - startX); // Ensure minimum width
      
      // Get a color based on the index
      const hue = (index * 30) % 360;
      ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
      // Draw segments in lower 70% of canvas height
      ctx.fillRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
      
      // Draw border
      ctx.strokeStyle = `hsla(${hue}, 70%, 40%, 0.9)`;
      ctx.strokeRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
    });
    
    // Draw time markers ON TOP
    ctx.fillStyle = '#ddd';
    
    // Calculate proper spacing for time markers based on timeline length
    const timeStep = Math.max(1, Math.ceil(timelineEnd / 15));
    for (let i = 0; i <= timelineEnd; i += timeStep) {
      const x = (i / timelineEnd) * displayWidth;
      // Draw full-height vertical lines
      ctx.fillRect(x, 0, 1, displayHeight);
      
      // Draw time labels at the top
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(`${i}s`, x + 3, 2);
      ctx.fillStyle = '#ddd';
    }
    
    // Draw current time indicator - make it more visible
    const currentX = (currentTime / timelineEnd) * displayWidth;
    
    // Draw indicator shadow for better visibility
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(currentX - 2, 0, 4, displayHeight);
    
    // Draw indicator
    ctx.fillStyle = 'red';
    ctx.fillRect(currentX - 1, 0, 3, displayHeight);
    
    // Draw playhead triangle at the top
    ctx.beginPath();
    ctx.moveTo(currentX - 6, 0);
    ctx.lineTo(currentX + 6, 0);
    ctx.lineTo(currentX, 6);
    ctx.closePath();
    ctx.fillStyle = 'red';
    ctx.fill();
  }, [lyrics, currentTime, duration]);

  // Initialize and resize the canvas for proper pixel density
  useEffect(() => {
    if (timelineRef.current) {
      const canvas = timelineRef.current;
      const container = canvas.parentElement;
      
      const resizeCanvas = () => {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = '50px';
        
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = 50 * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        drawTimeline();
      };
      
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();
      
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [drawTimeline]);
  
  // Draw timeline when lyrics or currentTime change
  useEffect(() => {
    if (timelineRef.current && lyrics.length > 0) {
      lastTimeRef.current = currentTime;
      drawTimeline();
    }
  }, [lyrics, currentTime, duration, drawTimeline]);
  
  // Force redraw timeline when currentTime changes
  useEffect(() => {
    if (Math.abs(lastTimeRef.current - currentTime) > 0.01) {
      lastTimeRef.current = currentTime;
      if (timelineRef.current) {
        drawTimeline();
      }
    }
  }, [currentTime, drawTimeline]);

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !duration || !onTimelineClick) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;
    
    const maxLyricTime = lyrics.length > 0 
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;
    
    const newTime = (clickX / timelineWidth) * timelineEnd;
    
    if (newTime >= 0 && newTime <= duration) {
      onTimelineClick(Math.min(duration, newTime));
    }
  };

  return (
    <div className="timeline-container">
      <canvas 
        ref={timelineRef}
        onClick={handleTimelineClick}
        className="subtitle-timeline"
      />
    </div>
  );
};

export default TimelineVisualization;