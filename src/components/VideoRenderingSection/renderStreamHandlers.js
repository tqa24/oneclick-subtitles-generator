// Shared Server-Sent-Events handling for video renders.
//
// Both the initial render (handleStartRender, in the parent) and the reconnection
// path (reconnectToRender, in useRenderQueue) consume the same SSE stream and ran
// near-identical ~250-line parsing loops. This module centralizes that logic so the
// two stay in sync.

// Gated debug logging (enable in the browser console: localStorage.debug_logs = 'true')
const DEBUG_LOGS = (typeof window !== 'undefined') && (localStorage.getItem('debug_logs') === 'true');
const dbg = (...args) => { if (DEBUG_LOGS) console.log(...args); };

/**
 * Handle a single parsed SSE `data` payload, updating progress/status/queue state.
 *
 * @param {object} data parsed JSON from one `data: ` line
 * @param {object} ctx
 * @param {Function} ctx.t i18n translate
 * @param {Function} ctx.setRenderProgress
 * @param {Function} ctx.setRenderStatus
 * @param {Function} ctx.setRenderedVideoUrl
 * @param {Function} ctx.setRenderQueue
 * @param {Function} ctx.setCurrentQueueItem
 * @param {Function} ctx.startNextPendingRender
 * @param {Function} ctx.resolveTarget returns the queue item to update (or null)
 * @param {boolean} [ctx.includePhaseEvents] whether to handle bundling/composition phases
 * @param {string} ctx.debugTag label used in debug logs ('' for initial, ' - Reconnection')
 * @returns {boolean} true when the stream loop should break (complete/cancelled)
 */
export const handleRenderStreamEvent = (data, ctx) => {
  const {
    t,
    setRenderProgress,
    setRenderStatus,
    setRenderedVideoUrl,
    setRenderQueue,
    setCurrentQueueItem,
    startNextPendingRender,
    resolveTarget,
    includePhaseEvents = false,
    debugTag = '',
  } = ctx;

  // Debug logging to understand what the server is sending
  if (data.message && data.message.includes('Chrome')) {
    dbg(`[Chrome Download Debug${debugTag}] Server message:`, data);
  }

  // Also log any data with progress-related info
  if (data.message && (data.message.includes('Mb/') || data.message.includes('download'))) {
    dbg(`[Progress Debug${debugTag}] Server message with download info:`, data);
  }

  // IMPORTANT: Check Chrome download FIRST before other phases
  // Chrome download happens during selectComposition after bundling
  if (data.chromeDownload) {
    // This is the actual format from server: { chromeDownload: { downloaded: X, total: Y } }
    const { downloaded, total } = data.chromeDownload;
    const downloadProgress = Math.round((downloaded / total) * 100);
    dbg(`[Chrome Download Progress${debugTag}] ${downloaded}MB / ${total}MB = ${downloadProgress}%`);

    const chromeDownloadStatus = t('videoRendering.downloadingChrome', 'Downloading Chrome for Testing (first time only)');

    // Use real download progress (0-100%)
    setRenderProgress(downloadProgress);
    setRenderStatus(chromeDownloadStatus);

    // Update the queue item's progress and phase description
    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? {
              ...item,
              progress: downloadProgress,
              phase: 'chrome-download',
              phaseDescription: chromeDownloadStatus
            }
          : item
      ));
    }
  }
  // Handle Chrome download from other possible formats (fallback)
  else if ((data.type === 'browser-download') ||
      (data.message && (data.message.includes('Chrome Headless Shell') || data.message.includes('Chrome for Testing'))) ||
      (data.message && data.message.includes('Downloading Chrome'))) {
    let downloadProgress = 0;
    let chromeDownloadStatus = '';

    if (data.type === 'browser-download' && data.downloaded && data.total) {
      // Format 2: { type: 'browser-download', downloaded: X, total: Y }
      downloadProgress = Math.round((data.downloaded / data.total) * 100);
    } else if (data.message && (data.message.includes('Chrome Headless Shell') || data.message.includes('Chrome for Testing') || data.message.includes('Downloading Chrome'))) {
      // Format 3: Parse from message like:
      // "Downloading Chrome Headless Shell - 9.5 Mb/102.3 Mb"
      // "Downloading Chrome for Testing - 9.5 Mb/158.8 Mb"
      // "[RENDERER] Downloading Chrome for Testing - 9.5 Mb/158.8 Mb"
      const match = data.message.match(/([0-9.]+)\s*Mb\/([0-9.]+)\s*Mb/);
      if (match) {
        const downloaded = parseFloat(match[1]);
        const total = parseFloat(match[2]);
        downloadProgress = Math.round((downloaded / total) * 100);
        dbg(`[Chrome Download${debugTag}] Parsed progress: ${downloaded}/${total} MB = ${downloadProgress}%`);
      } else {
        dbg(`[Chrome Download${debugTag}] Could not parse progress from message: "${data.message}"`);
      }
    }

    chromeDownloadStatus = t('videoRendering.downloadingChrome', 'Downloading Chrome for Testing (first time only)');

    // Use real download progress (0-100%) instead of mapping to render progress
    setRenderProgress(downloadProgress);
    setRenderStatus(chromeDownloadStatus);

    // Update the queue item's progress and phase description
    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? {
              ...item,
              progress: downloadProgress, // Real 0-100% progress for Chrome download
              phase: 'chrome-download',
              phaseDescription: chromeDownloadStatus
            }
          : item
      ));
    }
  }
  // Handle bundling progress (initial render only)
  else if (includePhaseEvents && data.bundling) {
    const bundlingStatus = t('videoRendering.bundling', 'Preparing video components...');
    // Reset progress to 0 after Chrome download completes and rendering begins
    setRenderProgress(0);
    setRenderStatus(bundlingStatus);

    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? {
              ...item,
              progress: 0, // Reset to 0% for new render phase after Chrome download
              phase: 'bundling',
              phaseDescription: bundlingStatus
            }
          : item
      ));
    }
  }
  // Handle composition selection (initial render only)
  else if (includePhaseEvents && data.composition) {
    const compositionStatus = t('videoRendering.selectingComposition', 'Setting up video composition...');
    // Reset to 0% for composition phase after bundling, let server control the progress
    setRenderProgress(0);
    setRenderStatus(compositionStatus);

    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? {
              ...item,
              progress: 0, // Start at 0%, let server drive progress
              phase: 'composition',
              phaseDescription: compositionStatus
            }
          : item
      ));
    }
  }
  // Handle regular render progress - update queue item instead of global state
  else if (data.progress !== undefined) {
    const progressPercent = Math.round(data.progress * 100);

    // Simple debug to see if frame data is received
    if (data.renderedFrames && data.durationInFrames) {

    }

    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? {
              ...item,
              progress: progressPercent,
              renderedFrames: data.renderedFrames,
              durationInFrames: data.durationInFrames,
              phase: data.phase,
              phaseDescription: data.phaseDescription
            }
          : item
      ));
    }

    // Keep legacy progress for any remaining external displays
    setRenderProgress(progressPercent);

    // Use more detailed status messages based on phase
    if (data.phase === 'encoding' || data.phaseDescription) {
      setRenderStatus(data.phaseDescription || t('videoRendering.encodingFrames', 'Encoding and stitching frames...'));
    } else if (data.renderedFrames && data.durationInFrames) {
      setRenderStatus(t('videoRendering.renderingFramesDetailed', 'Rendering frames: {{rendered}}/{{total}}', {
        rendered: data.renderedFrames,
        total: data.durationInFrames
      }));
    } else {
      setRenderStatus(t('videoRendering.renderingFrames', 'Processing video frames...'));
    }
  }

  if (data.status === 'complete' && data.videoUrl) {
    setRenderedVideoUrl(data.videoUrl);
    setRenderStatus(t('videoRendering.complete', 'Render complete!'));
    setRenderProgress(100);

    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      const completedAt = Date.now();
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? { ...item, status: 'completed', progress: 100, outputPath: data.videoUrl, completedAt }
          : item
      ));
    }

    // Render complete - reset state and start next
    setCurrentQueueItem(null);
    setTimeout(() => startNextPendingRender(), 1000);
    return true;
  }

  if (data.status === 'cancelled') {
    setRenderStatus(t('videoRendering.cancelled', 'Render cancelled'));
    setRenderProgress(0);

    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? { ...item, status: 'failed', progress: 0, error: 'Render was cancelled' }
          : item
      ));
    }
    return true;
  }

  if (data.status === 'error') {
    const errorMessage = data.error || t('videoRendering.unknownError', 'Unknown error occurred');

    const targetQueueItem = resolveTarget();
    if (targetQueueItem) {
      setRenderQueue(prev => prev.map(item =>
        item.id === targetQueueItem.id
          ? { ...item, status: 'failed', error: errorMessage }
          : item
      ));
    }

    throw new Error(errorMessage);
  }

  return false;
};

/**
 * Read an SSE response body to completion, dispatching each `data:` line through
 * handleRenderStreamEvent. Aborts cleanly when the controller signal fires.
 *
 * @param {Response} response fetch response with an SSE body
 * @param {AbortController} controller controls cancellation
 * @param {object} eventCtx context forwarded to handleRenderStreamEvent
 * @param {string} eventCtx.parseErrorLabel console.warn label for parse failures
 */
export const consumeRenderStream = async (response, controller, eventCtx) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const { parseErrorLabel, ...ctx } = eventCtx;

  while (true) {
    // Check if the request was aborted
    if (controller.signal.aborted) {
      dbg('Stream reading aborted');
      break;
    }

    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    let shouldBreak = false;
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (handleRenderStreamEvent(data, ctx)) {
            shouldBreak = true;
            break;
          }
        } catch (parseError) {
          console.warn(parseErrorLabel, parseError);
        }
      }
    }
    if (shouldBreak) break;
  }
};
