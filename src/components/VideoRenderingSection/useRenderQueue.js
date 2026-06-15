import { useState, useEffect } from 'react';
import { RENDERER_BASE_URL } from '../../utils/videoRendererClient';
import { consumeRenderStream } from './renderStreamHandlers';

// Gated debug logging (enable in the browser console: localStorage.debug_logs = 'true')
const DEBUG_LOGS = (typeof window !== 'undefined') && (localStorage.getItem('debug_logs') === 'true');
const dbg = (...args) => { if (DEBUG_LOGS) console.log(...args); };

/**
 * Render-queue state + localStorage persistence + SSE reconnection.
 *
 * The complex per-render async (handleStartRender) stays in the parent component;
 * it is threaded in via `startRenderRef` so startNextPendingRender / checkRenderStatus
 * can drive it without a circular import or stale closure.
 *
 * @param {object} ctx parent-owned state and setters this hook closes over
 * @param {boolean} ctx.isRendering
 * @param {Function} ctx.setIsRendering
 * @param {Function} ctx.setRenderProgress
 * @param {Function} ctx.setRenderStatus
 * @param {Function} ctx.setRenderedVideoUrl
 * @param {Function} ctx.setError
 * @param {Function} ctx.setCurrentRenderId
 * @param {Function} ctx.setAbortController
 * @param {Function} ctx.t i18n translate
 * @param {React.MutableRefObject<Function>} ctx.startRenderRef ref to parent handleStartRender
 */
export const useRenderQueue = ({
  isRendering,
  setIsRendering,
  setRenderProgress,
  setRenderStatus,
  setRenderedVideoUrl,
  setError,
  currentRenderId,
  setCurrentRenderId,
  setAbortController,
  t,
  startRenderRef,
}) => {
  const [renderQueue, setRenderQueue] = useState([]);
  const [currentQueueItem, setCurrentQueueItem] = useState(null);

  // Check if a render is still active on the server and reconnect
  const checkRenderStatus = async (renderId, queueItem) => {
    try {
      const response = await fetch(`${RENDERER_BASE_URL}/render-status/${renderId}`);

      if (response.ok) {
        const data = await response.json();

        if (data.status === 'active') {
          // Render is still active, reconnect to it
          dbg('Reconnecting to active render:', renderId);
          setIsRendering(true);

          // Update queue item status to processing
          setRenderQueue(prev => prev.map(item =>
            item.id === queueItem.id ? { ...item, status: 'processing', progress: data.progress || 0 } : item
          ));

          // Reconnect to the render stream
          reconnectToRender(renderId, queueItem);
        } else if (data.status === 'completed') {
          // Render completed while user was away
          dbg('Render completed while away:', renderId);
          setRenderQueue(prev => prev.map(item =>
            item.id === queueItem.id
              ? { ...item, status: 'completed', progress: 100, outputPath: data.outputPath }
              : item
          ));
          setCurrentQueueItem(null);
          setCurrentRenderId(null);

          // Start next pending render if any
          setTimeout(() => startNextPendingRender(), 1000);
        } else {
          // Render failed or was cancelled
          dbg('Render failed or cancelled while away:', renderId);
          setRenderQueue(prev => prev.map(item =>
            item.id === queueItem.id
              ? { ...item, status: 'failed', error: data.error || t('videoRendering.renderFailedBrowserClosed', 'Render failed while browser was closed') }
              : item
          ));
          setCurrentQueueItem(null);
          setCurrentRenderId(null);

          // Start next pending render if any
          setTimeout(() => startNextPendingRender(), 1000);
        }
      } else {
        // Server doesn't know about this render, mark as failed
        dbg('Server does not know about render:', renderId);
        setRenderQueue(prev => prev.map(item =>
          item.id === queueItem.id
            ? { ...item, status: 'failed', error: 'Render not found on server' }
            : item
        ));
        setCurrentQueueItem(null);
        setCurrentRenderId(null);
      }
    } catch (error) {
      console.error('Failed to check render status:', error);
      // Mark as failed if we can't check status
      setRenderQueue(prev => prev.map(item =>
        item.id === queueItem.id
          ? { ...item, status: 'failed', error: 'Could not reconnect to render' }
          : item
      ));
      setCurrentQueueItem(null);
      setCurrentRenderId(null);
    }
  };

  // Reconnect to an ongoing render stream
  const reconnectToRender = async (renderId, queueItem) => {
    try {
      // Create new abort controller for this reconnection
      const controller = new AbortController();
      setAbortController(controller);

      setRenderStatus(t('videoRendering.reconnecting', 'Reconnecting to render...'));

      // Connect to the render stream
      const response = await fetch(`${RENDERER_BASE_URL}/render-stream/${renderId}`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to reconnect to render stream: ${response.status}`);
      }

      // Handle Server-Sent Events (shared with handleStartRender)
      await consumeRenderStream(response, controller, {
        t,
        setRenderProgress,
        setRenderStatus,
        setRenderedVideoUrl,
        setRenderQueue,
        setCurrentQueueItem,
        startNextPendingRender,
        resolveTarget: () => queueItem,
        includePhaseEvents: false,
        debugTag: ' - Reconnection',
        parseErrorLabel: 'Failed to parse SSE data during reconnection:',
      });

    } catch (error) {
      console.error('Reconnection error:', error);

      if (error.name === 'AbortError') {
        dbg('Reconnection was aborted');
        setRenderStatus(t('videoRendering.cancelled', 'Render cancelled'));
        setRenderProgress(0);

        setRenderQueue(prev => prev.map(item =>
          item.id === queueItem.id
            ? { ...item, status: 'failed', progress: 0, error: t('videoRendering.renderCancelled', 'Render was cancelled') }
            : item
        ));
      } else {
        setError(error.message);
        setRenderStatus(t('videoRendering.failed', 'Render failed'));

        setRenderQueue(prev => prev.map(item =>
          item.id === queueItem.id
            ? { ...item, status: 'failed', error: error.message }
            : item
        ));
      }
    } finally {
      setIsRendering(false);
      setCurrentRenderId(null);
      setAbortController(null);
      setCurrentQueueItem(null);
      setTimeout(() => startNextPendingRender(), 1000);
    }
  };

  // Simple function to start next pending render
  const startNextPendingRender = async () => {
    // Find the next pending item
    const nextItem = renderQueue.find(item => item.status === 'pending');
    if (!nextItem || isRendering) return;

    // Mark as processing and stamp start time
    const startedAt = Date.now();
    setRenderQueue(prev => prev.map(item =>
      item.id === nextItem.id ? { ...item, status: 'processing', startedAt } : item
    ));
    setCurrentQueueItem({ ...nextItem, startedAt });
    await startRenderRef.current(nextItem);
  };

  // Simple queue management functions
  const removeFromQueue = (id) => {
    setRenderQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    setRenderQueue(prev => prev.filter(item => item.status === 'processing'));
  };

  // Restore render state from localStorage on component mount
  useEffect(() => {
    const restoreRenderState = () => {
      try {
        const savedQueue = localStorage.getItem('videoRenderQueue');
        const savedCurrentItem = localStorage.getItem('currentRenderItem');
        const savedRenderId = localStorage.getItem('currentRenderId');

        if (savedQueue) {
          const parsedQueue = JSON.parse(savedQueue);
          setRenderQueue(parsedQueue);
        }

        if (savedCurrentItem && savedRenderId) {
          const parsedCurrentItem = JSON.parse(savedCurrentItem);
          setCurrentQueueItem(parsedCurrentItem);
          setCurrentRenderId(savedRenderId);

          // Check if the render is still active on the server
          checkRenderStatus(savedRenderId, parsedCurrentItem);
        }
      } catch (error) {
        console.error('Failed to restore render state:', error);
        // Clear corrupted data
        localStorage.removeItem('videoRenderQueue');
        localStorage.removeItem('currentRenderItem');
        localStorage.removeItem('currentRenderId');
      }
    };

    restoreRenderState();
  }, []);

  // Save render state to localStorage whenever it changes
  useEffect(() => {
    if (renderQueue.length > 0) {
      localStorage.setItem('videoRenderQueue', JSON.stringify(renderQueue));
    } else {
      localStorage.removeItem('videoRenderQueue');
    }
  }, [renderQueue]);

  useEffect(() => {
    if (currentQueueItem && currentRenderId) {
      localStorage.setItem('currentRenderItem', JSON.stringify(currentQueueItem));
      localStorage.setItem('currentRenderId', currentRenderId);
    } else {
      localStorage.removeItem('currentRenderItem');
      localStorage.removeItem('currentRenderId');
    }
  }, [currentQueueItem, currentRenderId]);

  return {
    renderQueue,
    setRenderQueue,
    currentQueueItem,
    setCurrentQueueItem,
    checkRenderStatus,
    reconnectToRender,
    startNextPendingRender,
    removeFromQueue,
    clearQueue,
  };
};

export default useRenderQueue;
