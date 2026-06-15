/**
 * Classify and report a known Gemini subtitle-generation error.
 *
 * Recognises quota/rate-limit (429 / RESOURCE_EXHAUSTED), service overload (503 / "model is
 * overloaded"), token-limit, and file-size errors, reporting each via the provided callbacks.
 *
 * Extracted from useSubtitles.js, where this exact cascade was duplicated verbatim between a
 * try block and its catch fallback. Kept dependency-free (everything passed in) so it stays a
 * pure, easily-tested function.
 *
 * @param {Error} error
 * @param {object} ctx
 * @param {Function} ctx.t - i18n translate (key, defaultText, params?)
 * @param {Function} ctx.setStatus - ({ message, type }) => void
 * @param {Function} ctx.startQuotaCountdown - (seconds, isFreeTier) => void
 * @returns {boolean} true if the error matched a known type (and was reported), false otherwise.
 */
export const reportKnownGeminiSubtitleError = (error, { t, setStatus, startQuotaCountdown }) => {
  const message = error && error.message;
  if (!message) return false;

  // Quota / rate limit (429 RESOURCE_EXHAUSTED)
  if (message.includes('429') || /RESOURCE_EXHAUSTED/i.test(message) || /quota/i.test(message)) {
    const retryMatch = message.match(/Please retry in\s*([\d.]+)s/i);
    const seconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
    const isFreeTier = /free_tier/i.test(message) || /generate_content_free_tier_requests/i.test(message);
    if (seconds !== null) {
      startQuotaCountdown(seconds, isFreeTier);
    } else {
      const msg = isFreeTier
        ? t('errors.geminiQuotaExceeded', 'Gemini free-tier quota exceeded. Please try again later or use a different API key/add billing.')
        : t('errors.geminiQuotaExceeded', 'Gemini quota exceeded. Please try again later or use a different API key/add billing.');
      setStatus({ message: msg, type: 'error' });
    }
    return true;
  }

  // Service overload / 503
  if ((message.includes('503') && message.includes('Service Unavailable')) || message.includes('The model is overloaded')) {
    const is503Error = message.includes('503');
    const errorMessage = is503Error
      ? t('errors.geminiServiceUnavailable', 'Gemini is currently overloaded, please wait and try again later (error code 503)')
      : t('errors.geminiOverloaded', 'Strong model tends to get overloaded, please consider using other model and try again, or try lower the segment duration. Or create a new Google Cloud Project and get an API Key.');
    setStatus({ message: errorMessage, type: 'error' });
    return true;
  }

  // Token-count limit
  if (message.toLowerCase().includes('token') && message.toLowerCase().includes('exceeds the maximum')) {
    const tokenMatch = message.match(/input token count\s*\((\d+)\)\s*exceeds the maximum number of tokens allowed\s*\((\d+)\)/i);
    if (tokenMatch) {
      setStatus({ message: t('errors.tokenLimitExceededCounts', 'The video segment is too large for Gemini to process (required {{required}} tokens, limit {{limit}} tokens). Please reduce FPS/quality or shorten each request and try again.', { required: tokenMatch[1], limit: tokenMatch[2] }), type: 'error' });
    } else {
      setStatus({ message: t('errors.tokenLimitExceeded'), type: 'error' });
    }
    return true;
  }

  // File-size limit
  if (message.includes('File size') && message.includes('exceeds the recommended maximum')) {
    const sizeMatch = message.match(/(\d+)MB\) exceeds the recommended maximum of (\d+)MB/);
    if (sizeMatch && sizeMatch.length >= 3) {
      setStatus({ message: t('errors.fileSizeTooLarge', 'File size ({{size}}MB) exceeds the recommended maximum of {{maxSize}}MB. Please use a smaller file or lower quality video.', { size: sizeMatch[1], maxSize: sizeMatch[2] }), type: 'error' });
    } else {
      setStatus({ message, type: 'error' });
    }
    return true;
  }

  return false;
};
