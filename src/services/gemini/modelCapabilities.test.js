import { supportsMediaResolution } from './modelCapabilities';

describe('supportsMediaResolution', () => {
  test('returns true for models that support media resolution', () => {
    expect(supportsMediaResolution('gemini-2.5-flash')).toBe(true);
    expect(supportsMediaResolution('gemini-2.0-flash')).toBe(true);
    expect(supportsMediaResolution('gemini-1.5-pro')).toBe(true);
  });

  test('returns false for the unsupported learnlm models', () => {
    expect(supportsMediaResolution('learnlm-2.0-flash-experimental')).toBe(false);
    expect(supportsMediaResolution('learnlm-2.0-flash')).toBe(false);
    expect(supportsMediaResolution('learnlm-1.5-flash')).toBe(false);
  });

  test('matches by substring so provider-prefixed ids are still detected', () => {
    expect(supportsMediaResolution('models/learnlm-2.0-flash')).toBe(false);
    expect(supportsMediaResolution('models/gemini-2.5-flash')).toBe(true);
  });
});
