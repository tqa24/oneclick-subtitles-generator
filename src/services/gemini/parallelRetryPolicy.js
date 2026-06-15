/**
 * Shared retry policy helpers for the parallel streaming coordinators.
 *
 * Both the Files-API offsets coordinator and the INLINE coordinator use the
 * same notion of "retryable" Gemini errors (503 overload / 429 rate limit) and
 * the same progressive backoff schedule. Keep this logic here so there is a
 * single source of truth rather than parallel copies.
 */

/** Maximum number of retries attempted per segment before giving up. */
export const MAX_RETRIES = 5;

/** Progressive retry delays in seconds, indexed by attempt number. */
export const RETRY_DELAYS = [5, 10, 15, 20, 25];

/**
 * Whether an error is a 503 (overloaded / unavailable) error.
 * @param {Error} error
 * @returns {boolean}
 */
export const is503Error = (error) => !!(error && error.message && (
    error.message.includes('503') ||
    error.message.includes('overloaded') ||
    error.message.includes('UNAVAILABLE')
));

/**
 * Whether an error is a 429 (rate limit / quota exhausted) error.
 * @param {Error} error
 * @returns {boolean}
 */
export const is429Error = (error) => !!(error && error.message && (
    error.message.includes('429') ||
    error.message.includes('RESOURCE_EXHAUSTED') ||
    error.message.includes('quota') ||
    error.message.includes('rate limit')
));

/**
 * Resolve the backoff delay (in seconds) for a given zero-based attempt number,
 * clamped to the last entry of the schedule.
 * @param {number} attempt - Zero-based attempt index.
 * @returns {number} Delay in seconds.
 */
export const getRetryDelaySeconds = (attempt) =>
    RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
