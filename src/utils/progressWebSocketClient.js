/**
 * WebSocket client for real-time download progress updates
 */

import { SERVER_URL } from '../config';

class ProgressWebSocketClient {
  constructor() {
    this.ws = null;
    this.subscriptions = new Map(); // videoId -> callback function
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isConnecting = false;
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        // Import centralized React configuration
        const { API_URLS } = require('../config/appConfig');

        // Use centralized WebSocket URL
        const wsUrl = API_URLS.WEBSOCKET;

        console.log('Connecting to progress WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Progress WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.isConnecting = false;

          // Re-subscribe to all active subscriptions
          for (const videoId of this.subscriptions.keys()) {
            this.sendSubscribe(videoId);
          }

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('Progress WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;

          // Attempt to reconnect if we have active subscriptions
          if (this.subscriptions.size > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('Progress WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        console.error('Error creating WebSocket connection:', error);
        reject(error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      if (this.subscriptions.size > 0) {
        this.connect().catch(error => {
          console.error('WebSocket reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    if (data.type === 'progress' && data.videoId) {
      const callback = this.subscriptions.get(data.videoId);
      if (callback) {
        callback({
          progress: data.progress,
          status: data.status,
          phase: data.phase,
          timestamp: data.timestamp
        });
      }
    } else if (data.type === 'error' && data.videoId) {
      const callback = this.subscriptions.get(data.videoId);
      if (callback) {
        callback({
          progress: 0,
          status: 'error',
          error: data.error,
          timestamp: data.timestamp
        });
      }
    }
  }

  /**
   * Subscribe to progress updates for a video
   */
  async subscribe(videoId, callback) {
    if (!videoId || typeof callback !== 'function') {
      throw new Error('Invalid videoId or callback');
    }

    this.subscriptions.set(videoId, callback);

    // Connect if not already connected
    try {
      await this.connect();
      this.sendSubscribe(videoId);
    } catch (error) {
      console.error('Failed to connect for subscription:', error);
      // Continue anyway, will retry on reconnect
    }
  }

  /**
   * Send subscribe message to server
   */
  sendSubscribe(videoId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        videoId: videoId
      }));
    }
  }

  /**
   * Unsubscribe from progress updates for a video
   */
  unsubscribe(videoId) {
    if (!videoId) return;

    this.subscriptions.delete(videoId);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        videoId: videoId
      }));
    }

    // Close connection if no more subscriptions
    if (this.subscriptions.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Create a singleton instance
const progressWebSocketClient = new ProgressWebSocketClient();

export default progressWebSocketClient;
