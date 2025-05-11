/**
 * Request management for Gemini API
 * Handles abort controllers and request tracking
 */

// Map to store multiple AbortControllers for parallel requests
const activeAbortControllers = new Map();

// Global flag to indicate when processing should be completely stopped
let _processingForceStopped = false;

/**
 * Get the current state of the processing force stopped flag
 * @returns {boolean} - Whether processing has been force stopped
 */
export const getProcessingForceStopped = () => _processingForceStopped;

/**
 * Set the processing force stopped flag
 * @param {boolean} value - New value for the flag
 */
export const setProcessingForceStopped = (value) => {
    _processingForceStopped = value;

};

/**
 * Create a new request ID and abort controller
 * @returns {Object} - Object containing requestId and signal
 */
export const createRequestController = () => {
    const requestId = `request_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const controller = new AbortController();
    activeAbortControllers.set(requestId, controller);
    return { requestId, signal: controller.signal };
};

/**
 * Remove a request controller from the active map
 * @param {string} requestId - ID of the request to remove
 */
export const removeRequestController = (requestId) => {
    if (requestId && activeAbortControllers.has(requestId)) {
        activeAbortControllers.delete(requestId);
    }
};

/**
 * Abort all ongoing Gemini API requests
 * @returns {boolean} - Whether any requests were aborted
 */
export const abortAllRequests = () => {
    if (activeAbortControllers.size > 0) {


        // Set the global flag to indicate processing should be completely stopped
        setProcessingForceStopped(true);

        // Abort all controllers in the map
        for (const [, controller] of activeAbortControllers.entries()) {
            controller.abort();
        }

        // Clear the map
        activeAbortControllers.clear();

        // Dispatch an event to notify components that requests have been aborted
        window.dispatchEvent(new CustomEvent('gemini-requests-aborted'));

        return true;
    }
    return false;
};
