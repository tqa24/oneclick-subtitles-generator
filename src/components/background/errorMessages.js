// Helper: map raw error to friendly, localized message.
// `t` is the i18next translate function, passed in to keep this module pure.
export const getFriendlyErrorMessage = (t, raw = '') => {
  const msg = String(raw || '').trim();
  const statusMatch = msg.match(/HTTP\s+(\d{3})/i);
  if (statusMatch) {
    const code = parseInt(statusMatch[1], 10);
    switch (code) {
      case 429:
        return t('backgroundGenerator.error.quotaExceeded', 'Quota exceeded. Check your plan and billing.');
      case 401:
        return t('backgroundGenerator.error.unauthorized', 'Unauthorized: API key invalid or missing.');
      case 403:
        return t('backgroundGenerator.error.forbidden', 'Access forbidden. Check billing/quota or model access.');
      case 400:
        return t('backgroundGenerator.error.badRequest', 'Invalid request. Adjust prompt or album art and try again.');
      case 413:
        return t('backgroundGenerator.error.payloadTooLarge', 'Request too large. Try a smaller album image.');
      case 415:
        return t('backgroundGenerator.error.unsupportedMediaType', 'Unsupported image type. Please upload PNG or JPEG.');
      case 500:
      case 502:
      case 503:
      case 504:
        return t('backgroundGenerator.error.serverError', 'Service is temporarily unavailable. Please try again later.');
      default:
        return t('backgroundGenerator.error.generic', 'Generation failed');
    }
  }
  if (/exceeded\s+your\s+current\s+quota/i.test(msg) || /quota/i.test(msg)) {
    return t('backgroundGenerator.error.quotaExceeded', 'Quota exceeded. Check your plan and billing.');
  }
  if (/api key not set/i.test(msg) || /api\s*key.*(invalid|missing)/i.test(msg)) {
    return t('backgroundGenerator.error.apiKeyMissing', 'Gemini API key not set. Please set it in settings.');
  }
  if (/billing/i.test(msg)) {
    return t('backgroundGenerator.error.quotaExceeded', 'Quota exceeded. Check your plan and billing.');
  }
  if (/cors|cross-origin/i.test(msg)) {
    return t('backgroundGenerator.error.cors', 'Could not load album art due to CORS. Upload the image instead.');
  }
  if (/no image returned/i.test(msg)) {
    return t('backgroundGenerator.error.noImageReturned', 'No image was returned. Try again or simplify the prompt.');
  }
  if (/no prompt returned/i.test(msg)) {
    return t('backgroundGenerator.error.noPromptReturned', 'No prompt was returned. Try again later.');
  }
  if (/network/i.test(msg)) {
    return t('backgroundGenerator.error.network', 'Network error. Check your connection and try again.');
  }
  return t('backgroundGenerator.error.generic', 'Generation failed');
};
