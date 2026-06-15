import { generateSubtitleHash } from './subtitleHash';

describe('generateSubtitleHash', () => {
  test('returns empty string for empty/nullish input', () => {
    expect(generateSubtitleHash([])).toBe('');
    expect(generateSubtitleHash(null)).toBe('');
    expect(generateSubtitleHash(undefined)).toBe('');
  });

  test('is deterministic and order-sensitive', () => {
    const a = [{ subtitle_id: 1, text: 'hi' }, { subtitle_id: 2, text: 'yo' }];
    expect(generateSubtitleHash(a)).toBe(generateSubtitleHash([...a]));
    expect(generateSubtitleHash(a)).not.toBe(generateSubtitleHash([a[1], a[0]]));
  });

  test('keys on subtitle_id when there is no id (matches the old narration behaviour)', () => {
    expect(generateSubtitleHash([{ subtitle_id: 7, text: 't' }]))
      .toBe(generateSubtitleHash([{ id: undefined, subtitle_id: 7, text: 't' }]));
  });

  test('prefers id over subtitle_id (superset key)', () => {
    expect(generateSubtitleHash([{ id: 'x', subtitle_id: 1, text: 't' }]))
      .not.toBe(generateSubtitleHash([{ subtitle_id: 1, text: 't' }]));
  });
});
