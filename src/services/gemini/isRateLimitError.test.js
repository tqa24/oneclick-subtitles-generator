import { isRateLimitError } from './isRateLimitError';

describe('isRateLimitError', () => {
  test('flags a 429 fetch Response', () => {
    expect(isRateLimitError({ status: 429, ok: false })).toBe(true);
  });
  test('flags a parsed Gemini quota error body', () => {
    expect(isRateLimitError({ error: { code: 429, message: 'Quota exceeded' } })).toBe(true);
    expect(isRateLimitError({ error: { status: 'RESOURCE_EXHAUSTED' } })).toBe(true);
  });
  test('flags thrown errors / strings by message', () => {
    expect(isRateLimitError(new Error('You exceeded your current quota'))).toBe(true);
    expect(isRateLimitError(new Error('rate limit reached'))).toBe(true);
    expect(isRateLimitError('RESOURCE_EXHAUSTED')).toBe(true);
  });
  test('does NOT flag 503/overload or other errors (so a good key is not sidelined)', () => {
    expect(isRateLimitError({ status: 503, ok: false })).toBe(false);
    expect(isRateLimitError({ error: { code: 503, status: 'UNAVAILABLE', message: 'overloaded' } })).toBe(false);
    expect(isRateLimitError(new Error('invalid argument'))).toBe(false);
    expect(isRateLimitError(new Error('network error'))).toBe(false);
  });
  test('is false for nullish input', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
