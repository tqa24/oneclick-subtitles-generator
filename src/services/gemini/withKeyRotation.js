import { getAllKeys, getNextAvailableKey, blacklistKey } from './keyManager';
import { isRateLimitError } from './isRateLimitError';

export const NO_KEY_MESSAGE = 'No valid Gemini API key available. Add one in Settings > API Keys.';

/**
 * Run a Gemini API call with STICKY FAILOVER across the saved keys:
 *   1. pick the active (non-blacklisted) key via the key manager,
 *   2. run `fn(key)`,
 *   3. if the result is a rate-limit / quota (a 429 Response OR a thrown 429/RESOURCE_EXHAUSTED),
 *      blacklist that key (which cools it for 5 min and rotates the active index) and retry with
 *      the next key — bounded to (number of keys) attempts so N keys = at most N tries.
 *
 * `fn(key)` should return the fetch Response (preferred) or throw. NON-rate-limit failures (network,
 * 4xx, 5xx/overload) propagate immediately and do NOT switch keys. When every key is exhausted the
 * last 429 Response is returned (or the last error re-thrown) so the caller's existing error
 * handling still runs unchanged.
 *
 * @param {(key: string) => Promise<any>} fn
 * @param {{ maxAttempts?: number }} [opts]
 */
export const fetchWithKeyRotation = async (fn, { maxAttempts } = {}) => {
  const attempts = Math.max(1, maxAttempts || getAllKeys().length || 1);
  let lastResult;
  let lastError;

  for (let i = 0; i < attempts; i += 1) {
    const key = getNextAvailableKey();
    if (!key) throw new Error(NO_KEY_MESSAGE);

    try {
      const result = await fn(key);
      if (result && isRateLimitError(result)) {
        blacklistKey(key);
        lastResult = result;
        continue;
      }
      return result;
    } catch (err) {
      lastError = err;
      if (isRateLimitError(err)) {
        blacklistKey(key);
        continue;
      }
      throw err; // not a rate-limit — surface immediately
    }
  }

  // Every key was rate-limited: hand back the last 429 response (so the caller surfaces its own
  // error), or re-throw the last error.
  if (lastResult !== undefined) return lastResult;
  throw lastError || new Error(NO_KEY_MESSAGE);
};

export default fetchWithKeyRotation;
