// Single source of truth for "is this a Gemini rate-limit / quota exhaustion?" — the only thing
// that should trigger an API-key switch. Deliberately NOT triggered by transient 5xx/overload or
// bad-request errors, so a healthy key isn't sidelined on a one-off blip.
//
// Accepts anything: a fetch Response (checks .status), a parsed Gemini error body
// ({ error: { code, status, message } }), an axios-style error (.response.status), a thrown Error,
// or a plain string.

const RATE_LIMIT_TEXT = /(rate[\s_-]?limit|resource[\s_-]?exhausted|quota|too many requests)/i;

export const isRateLimitError = (x) => {
  if (!x) return false;

  // Numeric / string status across the shapes we see (Response, Gemini body, axios).
  const status = x.status ?? x.code ?? x.error?.code ?? x.error?.status ?? x.response?.status;
  if (status === 429 || status === '429' || status === 'RESOURCE_EXHAUSTED') return true;

  // Fall back to the message text (covers thrown Errors / strings without a status field).
  const message = typeof x === 'string'
    ? x
    : (x.message || x.error?.message || x.statusText || '');
  return RATE_LIMIT_TEXT.test(String(message));
};

export default isRateLimitError;
