import { useEffect, useLayoutEffect } from 'react';

import { clearUnusedChunks } from '../../utils/optimizedVideoStreaming';

// Render-coordination side effects for the timeline. Every effect here exists
// to (re)draw the canvas in response to some change — new-segment pop-in
// animation, waveform setting toggles, programmatic zoom, container resize,
// lyric/time/drag updates — plus the playhead auto-scroll and unmount cleanup.
// All of these depend on the memoized renderTimeline from the host, so they're
// grouped together and fed the refs/state/props they read.
export const useTimelineRenderEffects = ({
    renderTimeline,
    timelineRef,
    animationFrameRef,
    newSegments,
    setNewSegments,
    newSegmentAnimationRef,
    zoom,
    currentZoomRef,
    duration,
    panOffset,
    setPanOffset,
    currentTime,
    lyrics,
    selectedSegment,
    onSegmentSelect,
    videoSource,
    isDraggingSegment,
    dragStartTime,
    dragCurrentTime,
    lastTimeRef,
    lastManualPanTime,
    disableAutoScroll,
    getTimeRange,
    isScrollingRef,
    debugCounter,
    autoScrollRef
}) => {
    // Animate new segments - must be after renderTimeline definition
    useEffect(() => {
        if (newSegments.size > 0) {
            const animate = () => {
                const now = performance.now();
                let hasActiveAnimations = false;

                // Check if any animations are still active (800ms duration)
                newSegments.forEach((value) => {
                    if (now - value.startTime < 800) {
                        hasActiveAnimations = true;
                    }
                });

                if (hasActiveAnimations) {
                    // Trigger re-render to update animations
                    renderTimeline();
                    newSegmentAnimationRef.current = requestAnimationFrame(animate);
                } else {
                    // Clean up finished animations
                    setNewSegments(prevMap => {
                        const cleanedMap = new Map();
                        const now = performance.now();
                        prevMap.forEach((value, key) => {
                            if (now - value.startTime < 800) {
                                cleanedMap.set(key, value);
                            }
                        });
                        return cleanedMap;
                    });
                }
            };

            newSegmentAnimationRef.current = requestAnimationFrame(animate);

            return () => {
                if (newSegmentAnimationRef.current) {
                    cancelAnimationFrame(newSegmentAnimationRef.current);
                }
            };
        }
    }, [newSegments, renderTimeline, newSegmentAnimationRef, setNewSegments]);

    // Listen for immediate waveform setting changes - must be after renderTimeline definition
    useEffect(() => {
        const handleWaveformLongVideosChange = () => {
            // Force re-render when the setting changes
            if (timelineRef.current) {
                renderTimeline();
            }
        };

        window.addEventListener('waveformLongVideosChanged', handleWaveformLongVideosChange);
        return () => {
            window.removeEventListener('waveformLongVideosChanged', handleWaveformLongVideosChange);
        };
    }, [renderTimeline, timelineRef]);

    // Simple zoom update for programmatic changes (non-user initiated)
    useEffect(() => {
        if (zoom !== currentZoomRef.current) {
            // Just update zoom without centering for programmatic changes
            // User-initiated zoom centering is handled directly in the mouse move handler
            currentZoomRef.current = zoom;
            renderTimeline();
        }
    }, [zoom, renderTimeline, currentZoomRef]);


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
    }, [animationFrameRef]);

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
    }, [renderTimeline, timelineRef]);

    // Handle timeline updates
    useLayoutEffect(() => {
        if (timelineRef.current && (lyrics.length > 0 || onSegmentSelect)) {
            lastTimeRef.current = currentTime;
            renderTimeline();

            // For long videos, optimize memory usage by clearing unused chunks
            if (duration > 1800 && videoSource) { // 30 minutes
                // Clear unused video chunks to free up memory
                clearUnusedChunks(videoSource, currentTime, duration);
            }
        }
    }, [lyrics, currentTime, duration, zoom, panOffset, renderTimeline, videoSource, onSegmentSelect, selectedSegment, timelineRef, lastTimeRef]);

    // Initial render when component mounts or when segment selection is enabled
    useEffect(() => {
        if (timelineRef.current && onSegmentSelect) {
            renderTimeline();
        }
    }, [onSegmentSelect, renderTimeline, timelineRef]);

    // Re-render when drag state changes to show visual feedback
    useEffect(() => {
        if (timelineRef.current && (isDraggingSegment || dragStartTime !== null || dragCurrentTime !== null)) {
            renderTimeline();
        }
    }, [isDraggingSegment, dragStartTime, dragCurrentTime, renderTimeline, timelineRef]);



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


            // Use current zoom directly without minimum restriction
            const effectiveZoom = currentZoomRef.current;

            // Calculate visible duration based on zoom
            const totalVisibleDuration = timelineEnd / effectiveZoom;
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
    }, [currentTime, duration, getTimeRange, panOffset, setPanOffset, lastManualPanTime, disableAutoScroll, isScrollingRef, debugCounter, currentZoomRef, autoScrollRef]);
};
