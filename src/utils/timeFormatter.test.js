import { formatTime } from './timeFormatter';

describe('formatTime', () => {
  test("hms renders M:SS below one hour", () => {
    expect(formatTime(5, 'hms')).toBe('0:05');
    expect(formatTime(75, 'hms')).toBe('1:15');
    expect(formatTime(330, 'hms')).toBe('5:30');
  });

  test('hms renders H:MM:SS at one hour or more (not minutes > 59)', () => {
    expect(formatTime(3600, 'hms')).toBe('1:00:00');
    expect(formatTime(3675, 'hms')).toBe('1:01:15');
  });

  test('seconds format strips a redundant .00', () => {
    expect(formatTime(2)).toBe('2s');
    expect(formatTime(1.5)).toBe('1.50s');
  });

  test('null/undefined render as an empty string', () => {
    expect(formatTime(null, 'hms')).toBe('');
    expect(formatTime(undefined)).toBe('');
  });
});
