import { formatSecondsToTimecode } from './timecode';

describe('formatSecondsToTimecode', () => {
  test('formats with a dot separator (WebVTT) by default', () => {
    expect(formatSecondsToTimecode(3661.5)).toBe('01:01:01.500');
    expect(formatSecondsToTimecode(0)).toBe('00:00:00.000');
  });

  test('formats with a comma separator (SRT) when requested', () => {
    expect(formatSecondsToTimecode(3661.5, ',')).toBe('01:01:01,500');
  });

  test('zero-pads hours, minutes, seconds and milliseconds', () => {
    expect(formatSecondsToTimecode(5.07)).toBe('00:00:05.070');
    expect(formatSecondsToTimecode(75)).toBe('00:01:15.000');
  });

  test('returns the zero timecode for null/undefined, honouring the separator', () => {
    expect(formatSecondsToTimecode(null)).toBe('00:00:00.000');
    expect(formatSecondsToTimecode(undefined, ',')).toBe('00:00:00,000');
  });
});
