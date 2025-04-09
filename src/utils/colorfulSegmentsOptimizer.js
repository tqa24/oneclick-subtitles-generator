/**
 * Utility functions for optimizing colorful segments handling
 * with better memory management for long videos
 */

// LRU (Least Recently Used) cache for colorful segments
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.usage = [];
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    
    // Update usage
    this.usage = this.usage.filter(k => k !== key);
    this.usage.push(key);
    
    return this.cache.get(key);
  }

  set(key, value) {
    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.usage.shift();
      this.cache.delete(lruKey);
    }
    
    // Add new item
    this.cache.set(key, value);
    
    // Update usage
    this.usage = this.usage.filter(k => k !== key);
    this.usage.push(key);
  }

  clear() {
    this.cache.clear();
    this.usage = [];
  }
}

// Create a global cache for colorful segments
const segmentsCache = new LRUCache(200);

/**
 * Optimize colorful segments for better performance with long videos
 * @param {Array} segments - Array of colorful segments
 * @param {number} duration - Video duration in seconds
 * @param {Object} visibleTimeRange - Visible time range object
 * @returns {Array} - Optimized segments for rendering
 */
export const optimizeSegments = (segments, duration, visibleTimeRange) => {
  if (!segments || segments.length === 0) return [];
  
  // For short videos, return all segments
  if (duration <= 1800) return segments; // 30 minutes
  
  // For long videos, only return segments in the visible range
  // with some padding for smoother scrolling
  const { start, end } = visibleTimeRange;
  const padding = (end - start) * 0.5; // 50% padding on each side
  
  const visibleStart = Math.max(0, start - padding);
  const visibleEnd = Math.min(duration, end + padding);
  
  // Check if we have this range in cache
  const cacheKey = `${visibleStart.toFixed(1)}_${visibleEnd.toFixed(1)}`;
  const cachedSegments = segmentsCache.get(cacheKey);
  
  if (cachedSegments) {
    return cachedSegments;
  }
  
  // Filter segments to only include those in the visible range
  const visibleSegments = segments.filter(segment => {
    return segment.end >= visibleStart && segment.start <= visibleEnd;
  });
  
  // For very long videos, limit the number of segments
  if (duration > 7200) { // 2 hours
    const maxSegments = 500;
    if (visibleSegments.length > maxSegments) {
      // Sample segments evenly
      const step = Math.ceil(visibleSegments.length / maxSegments);
      const sampledSegments = [];
      
      for (let i = 0; i < visibleSegments.length; i += step) {
        sampledSegments.push(visibleSegments[i]);
      }
      
      // Cache the result
      segmentsCache.set(cacheKey, sampledSegments);
      
      return sampledSegments;
    }
  }
  
  // Cache the result
  segmentsCache.set(cacheKey, visibleSegments);
  
  return visibleSegments;
};

/**
 * Clear memory for segments that are no longer needed
 * @param {number} currentTime - Current video time in seconds
 * @param {number} duration - Video duration in seconds
 */
export const clearUnusedSegments = (currentTime, duration) => {
  // For short videos, do nothing
  if (duration <= 1800) return; // 30 minutes
  
  // For long videos, clear segments that are far from current time
  const clearDistance = duration > 7200 ? 600 : 300; // 10 minutes for very long videos, 5 minutes otherwise
  
  // Clear all cached segments that are far from current time
  for (const key of segmentsCache.usage) {
    const [start, end] = key.split('_').map(parseFloat);
    
    // If this segment range is far from current time, remove it
    if (start < currentTime - clearDistance || end > currentTime + clearDistance) {
      segmentsCache.cache.delete(key);
      segmentsCache.usage = segmentsCache.usage.filter(k => k !== key);
    }
  }
};

export default {
  optimizeSegments,
  clearUnusedSegments,
  segmentsCache
};
