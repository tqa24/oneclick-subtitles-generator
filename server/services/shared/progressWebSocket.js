/**
 * WebSocket-based real-time progress tracking system
 */

const WebSocket = require('ws');
const { getDownloadProgress } = require('./progressTracker');

// Store WebSocket connections by video ID
const progressConnections = new Map();

// WebSocket server instance
let wss = null;

/**
 * Initialize WebSocket server for progress tracking
 * @param {Object} server - HTTP server instance
 */
function initializeProgressWebSocket(server) {
  wss = new WebSocket.Server({
    port: 3009,
    perMessageDeflate: false
  });

  wss.on('connection', (ws, req) => {
    console.log('Progress WebSocket client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'subscribe' && data.videoId) {
          // Subscribe to progress updates for a specific video
          if (!progressConnections.has(data.videoId)) {
            progressConnections.set(data.videoId, new Set());
          }
          progressConnections.get(data.videoId).add(ws);

          // Send current progress immediately
          const currentProgress = getDownloadProgress(data.videoId);
          ws.send(JSON.stringify({
            type: 'progress',
            videoId: data.videoId,
            progress: currentProgress.progress,
            status: currentProgress.status,
            timestamp: currentProgress.timestamp
          }));

          console.log(`Client subscribed to progress for video: ${data.videoId}`);
        } else if (data.type === 'unsubscribe' && data.videoId) {
          // Unsubscribe from progress updates
          if (progressConnections.has(data.videoId)) {
            progressConnections.get(data.videoId).delete(ws);
            if (progressConnections.get(data.videoId).size === 0) {
              progressConnections.delete(data.videoId);
            }
          }
          console.log(`Client unsubscribed from progress for video: ${data.videoId}`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      // Remove this connection from all video subscriptions
      for (const [videoId, connections] of progressConnections.entries()) {
        connections.delete(ws);
        if (connections.size === 0) {
          progressConnections.delete(videoId);
        }
      }
      console.log('Progress WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('Progress WebSocket error:', error);
    });
  });

  console.log('Progress WebSocket server started on port 3009');
}

/**
 * Broadcast progress update to all subscribed clients
 * @param {string} videoId - Video ID
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} status - Download status
 * @param {string} phase - Download phase (video, audio, merge)
 */
function broadcastProgress(videoId, progress, status, phase = null) {
  if (!progressConnections.has(videoId)) {
    return;
  }

  const message = JSON.stringify({
    type: 'progress',
    videoId: videoId,
    progress: progress,
    status: status,
    phase: phase,
    timestamp: Date.now()
  });

  const connections = progressConnections.get(videoId);
  const deadConnections = new Set();

  for (const ws of connections) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      } else {
        deadConnections.add(ws);
      }
    } catch (error) {
      console.error('Error sending progress update:', error);
      deadConnections.add(ws);
    }
  }

  // Clean up dead connections
  for (const deadWs of deadConnections) {
    connections.delete(deadWs);
  }

  if (connections.size === 0) {
    progressConnections.delete(videoId);
  }
}

/**
 * Broadcast completion status
 * @param {string} videoId - Video ID
 */
function broadcastCompletion(videoId) {
  broadcastProgress(videoId, 100, 'completed');
}

/**
 * Broadcast error status
 * @param {string} videoId - Video ID
 * @param {string} error - Error message
 */
function broadcastError(videoId, error) {
  if (!progressConnections.has(videoId)) {
    return;
  }

  const message = JSON.stringify({
    type: 'error',
    videoId: videoId,
    error: error,
    timestamp: Date.now()
  });

  const connections = progressConnections.get(videoId);
  for (const ws of connections) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    } catch (error) {
      console.error('Error sending error update:', error);
    }
  }
}

module.exports = {
  initializeProgressWebSocket,
  broadcastProgress,
  broadcastCompletion,
  broadcastError
};
