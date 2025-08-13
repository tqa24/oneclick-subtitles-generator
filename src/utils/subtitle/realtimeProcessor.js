/**
 * Real-time subtitle processing for streaming responses
 * Handles incremental parsing and timeline updates
 */

import { parseGeminiResponse } from './index';

/**
 * Real-time subtitle processor class
 * Manages streaming subtitle updates and timeline visualization
 */
export class RealtimeSubtitleProcessor {
  constructor(options = {}) {
    this.onSubtitleUpdate = options.onSubtitleUpdate || (() => {});
    this.onStatusUpdate = options.onStatusUpdate || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
    
    // Processing state
    this.accumulatedText = '';
    this.currentSubtitles = [];
    this.lastValidSubtitles = [];
    this.chunkCount = 0;
    this.isProcessing = false;
    
    // Parsing options
    this.parseAttemptInterval = 3; // Try to parse every 3 chunks
    this.minTextLength = 100; // Minimum text length before attempting parse
    
    console.log('[RealtimeProcessor] Initialized');
  }

  /**
   * Process a streaming chunk
   * @param {Object} chunk - Chunk data from streaming service
   */
  processChunk(chunk) {
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.onStatusUpdate({
        message: 'Processing streaming response...',
        type: 'loading'
      });
    }

    this.chunkCount++;
    this.accumulatedText = chunk.accumulatedText || '';
    
    console.log(`[RealtimeProcessor] Processing chunk ${this.chunkCount}, text length: ${this.accumulatedText.length}`);

    // Try to parse subtitles periodically or if we have enough text
    const shouldAttemptParse = 
      this.chunkCount % this.parseAttemptInterval === 0 || 
      this.accumulatedText.length >= this.minTextLength;

    if (shouldAttemptParse) {
      this.attemptSubtitleParsing();
    }

    // Update status with progress
    this.onStatusUpdate({
      message: `Processing... (${this.chunkCount} chunks, ${this.currentSubtitles.length} subtitles found)`,
      type: 'loading'
    });
  }

  /**
   * Attempt to parse subtitles from accumulated text
   */
  attemptSubtitleParsing() {
    try {
      console.log('[RealtimeProcessor] Attempting to parse subtitles...');

      // Create a mock response object for the parser
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: this.accumulatedText
            }]
          }
        }]
      };

      // Try to parse the accumulated text
      const parsedSubtitles = parseGeminiResponse(mockResponse);

      if (parsedSubtitles && parsedSubtitles.length > 0) {
        // Check if we have new subtitles
        if (parsedSubtitles.length > this.currentSubtitles.length) {
          console.log(`[RealtimeProcessor] Found ${parsedSubtitles.length} subtitles (was ${this.currentSubtitles.length})`);

          this.currentSubtitles = parsedSubtitles;
          this.lastValidSubtitles = [...parsedSubtitles]; // Keep a backup

          // Notify about subtitle updates
          this.onSubtitleUpdate({
            subtitles: parsedSubtitles,
            isStreaming: true,
            chunkCount: this.chunkCount,
            textLength: this.accumulatedText.length
          });
        }
      } else {
        console.log('[RealtimeProcessor] No valid subtitles parsed yet');
      }
    } catch (error) {
      console.warn('[RealtimeProcessor] Parsing attempt failed:', error.message);
      // Don't throw - parsing failures are expected during streaming
    }
  }

  /**
   * Handle completion of streaming
   * @param {string} finalText - Final accumulated text
   */
  complete(finalText) {
    console.log('[RealtimeProcessor] Stream completed, final processing...');
    
    this.accumulatedText = finalText;
    this.isProcessing = false;

    // Final parsing attempt
    try {
      // Create a mock response object for the parser
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: finalText
            }]
          }
        }]
      };

      const finalSubtitles = parseGeminiResponse(mockResponse);

      if (finalSubtitles && finalSubtitles.length > 0) {
        this.currentSubtitles = finalSubtitles;

        console.log(`[RealtimeProcessor] Final result: ${finalSubtitles.length} subtitles`);

        this.onSubtitleUpdate({
          subtitles: finalSubtitles,
          isStreaming: false,
          isComplete: true,
          chunkCount: this.chunkCount,
          textLength: finalText.length
        });

        this.onStatusUpdate({
          message: `Processing complete! Generated ${finalSubtitles.length} subtitles.`,
          type: 'success'
        });

        this.onComplete(finalSubtitles);
      } else {
        throw new Error('No valid subtitles found in final response');
      }
    } catch (error) {
      console.error('[RealtimeProcessor] Final parsing failed:', error);

      // Fall back to last valid subtitles if available
      if (this.lastValidSubtitles.length > 0) {
        console.log('[RealtimeProcessor] Using last valid subtitles as fallback');
        this.onComplete(this.lastValidSubtitles);
        this.onStatusUpdate({
          message: `Processing complete! Generated ${this.lastValidSubtitles.length} subtitles.`,
          type: 'success'
        });
      } else {
        this.onError(error);
      }
    }
  }

  /**
   * Handle streaming error
   * @param {Error} error - The error that occurred
   */
  error(error) {
    console.error('[RealtimeProcessor] Stream error:', error);
    this.isProcessing = false;
    
    // Try to salvage any subtitles we've parsed so far
    if (this.lastValidSubtitles.length > 0) {
      console.log('[RealtimeProcessor] Attempting to salvage partial results...');
      this.onStatusUpdate({
        message: `Processing interrupted. Saved ${this.lastValidSubtitles.length} subtitles.`,
        type: 'warning'
      });
      this.onComplete(this.lastValidSubtitles);
    } else {
      this.onError(error);
    }
  }

  /**
   * Reset the processor state
   */
  reset() {
    this.accumulatedText = '';
    this.currentSubtitles = [];
    this.lastValidSubtitles = [];
    this.chunkCount = 0;
    this.isProcessing = false;
    console.log('[RealtimeProcessor] Reset');
  }

  /**
   * Get current processing statistics
   * @returns {Object} - Processing stats
   */
  getStats() {
    return {
      chunkCount: this.chunkCount,
      textLength: this.accumulatedText.length,
      subtitleCount: this.currentSubtitles.length,
      isProcessing: this.isProcessing
    };
  }
}

/**
 * Create a new realtime subtitle processor
 * @param {Object} options - Processor options
 * @returns {RealtimeSubtitleProcessor} - New processor instance
 */
export const createRealtimeProcessor = (options) => {
  return new RealtimeSubtitleProcessor(options);
};
