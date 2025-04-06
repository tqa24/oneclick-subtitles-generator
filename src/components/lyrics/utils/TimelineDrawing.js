/**
 * Utility functions for drawing the timeline visualization
 */

import { getLyricColor, getRandomHeight } from './ColorUtils';
import { timeToX } from './TimelineCalculations';
import { formatTime } from '../../../utils/timeFormatter';

/**
 * Draw the timeline visualization
 * @param {Object} canvas - Canvas element
 * @param {number} duration - Total duration of the video
 * @param {Array} lyrics - Array of lyric objects
 * @param {number} currentTime - Current playback time
 * @param {Object} visibleTimeRange - Visible time range object
 * @param {number} panOffset - Current pan offset
 * @param {boolean} isActivePanning - Whether the user is actively panning
 * @param {string} timeFormat - Time format to use
 */
export const drawTimeline = (
  canvas,
  duration,
  lyrics,
  currentTime,
  visibleTimeRange,
  panOffset,
  isActivePanning,
  timeFormat
) => {
  if (!canvas || !duration) return;

  const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for non-transparent canvas
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

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

  const { start: visibleStart, end: visibleEnd } = visibleTimeRange;
  const visibleDuration = visibleEnd - visibleStart;

  // Clear the canvas with a single operation
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  // Draw time markers and labels
  drawTimeMarkers(
    ctx,
    visibleStart,
    visibleEnd,
    visibleDuration,
    displayWidth,
    displayHeight,
    borderColor,
    textColor,
    isActivePanning,
    timeFormat
  );

  // Draw lyric segments
  drawLyricSegments(
    ctx,
    lyrics,
    visibleStart,
    visibleEnd,
    visibleDuration,
    displayWidth,
    displayHeight,
    isDark,
    isActivePanning
  );

  // Draw current time indicator
  drawPlayhead(
    ctx,
    currentTime,
    visibleStart,
    visibleEnd,
    visibleDuration,
    displayWidth,
    displayHeight,
    primaryColor
  );
};

/**
 * Draw time markers and labels on the timeline
 */
const drawTimeMarkers = (
  ctx,
  visibleStart,
  visibleEnd,
  visibleDuration,
  displayWidth,
  displayHeight,
  borderColor,
  textColor,
  isActivePanning,
  timeFormat
) => {
  // Only draw time markers if we're not actively panning or if the visible duration is reasonable
  if (isActivePanning && visibleDuration >= 300) return;

  // Calculate proper spacing for time markers based on visible duration
  const maxMarkers = 20; // Maximum number of time markers to display
  const timeStep = Math.max(1, Math.ceil(visibleDuration / maxMarkers));
  const firstMarker = Math.floor(visibleStart / timeStep) * timeStep;

  // Batch time markers drawing
  ctx.beginPath();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;

  // Limit the number of markers to draw
  const markerCount = Math.min(maxMarkers, Math.ceil(visibleDuration / timeStep));

  for (let i = 0; i <= markerCount; i++) {
    const time = firstMarker + (i * timeStep);
    if (time > visibleEnd) break;

    const x = timeToX(time, visibleStart, visibleDuration, displayWidth);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, displayHeight);
  }
  ctx.stroke();

  // Draw time labels - only if not actively panning for better performance
  if (!isActivePanning) {
    ctx.font = '10px Arial';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;

    for (let i = 0; i <= markerCount; i++) {
      const time = firstMarker + (i * timeStep);
      if (time > visibleEnd) break;

      const x = timeToX(time, visibleStart, visibleDuration, displayWidth);
      // Position time labels with more space from the top
      ctx.fillText(formatTime(time, timeFormat), x + 3, 5);
    }
  }
};

/**
 * Draw lyric segments on the timeline
 */
const drawLyricSegments = (
  ctx,
  lyrics,
  visibleStart,
  visibleEnd,
  visibleDuration,
  displayWidth,
  displayHeight,
  isDark,
  isActivePanning
) => {
  // Optimize lyric segments rendering
  // Increase minimum segment width during panning for better performance
  const minSegmentWidth = isActivePanning ? 4 : 2;

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

    const startX = timeToX(lyric.start, visibleStart, visibleDuration, displayWidth);
    const endX = timeToX(lyric.end, visibleStart, visibleDuration, displayWidth);

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

    // Reserve space at the top for time markers and labels (25px)
    const timeMarkerSpace = 25;
    const availableHeight = displayHeight - timeMarkerSpace;

    for (const { lyric, startX, width } of visibleLyrics) {
      const { fillStyle, strokeStyle } = getLyricColor(lyric.text, isDark);
      // Calculate a random height for this segment
      const heightPercentage = getRandomHeight(lyric.text);

      if (!colorGroups.has(fillStyle)) {
        colorGroups.set(fillStyle, {
          fill: fillStyle,
          stroke: strokeStyle,
          segments: []
        });
      }

      colorGroups.get(fillStyle).segments.push({
        x: startX,
        width: width,
        height: heightPercentage,
        // Calculate the actual pixel height based on available height (after reserving space for time markers)
        actualHeight: availableHeight * heightPercentage,
        // Position segments below the time marker space and center them in the remaining available height
        y: timeMarkerSpace + (availableHeight * 0.5 - (availableHeight * heightPercentage * 0.5))
      });
    }

    // Render each color group in a batch
    colorGroups.forEach(group => {
      ctx.fillStyle = group.fill;

      // Draw all fills for this color at once
      for (const segment of group.segments) {
        ctx.fillRect(segment.x, segment.y, segment.width, segment.actualHeight);
      }

      // Only draw strokes if not actively panning (for better performance)
      if (!isActivePanning) {
        ctx.strokeStyle = group.stroke;
        for (const segment of group.segments) {
          ctx.strokeRect(segment.x, segment.y, segment.width, segment.actualHeight);
        }
      }
    });
  }
};

/**
 * Draw the playhead (current time indicator) on the timeline
 */
const drawPlayhead = (
  ctx,
  currentTime,
  visibleStart,
  visibleEnd,
  visibleDuration,
  displayWidth,
  displayHeight,
  primaryColor
) => {
  if (currentTime >= visibleStart && currentTime <= visibleEnd) {
    const currentX = timeToX(currentTime, visibleStart, visibleDuration, displayWidth);

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
};
