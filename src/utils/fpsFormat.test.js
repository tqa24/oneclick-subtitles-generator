import { getFpsValue, getFpsInterval } from './fpsFormat';

// Minimal i18n stub: substitutes the {{interval}} param into the default string.
const t = (key, def, params) =>
  params ? def.replace('{{interval}}', params.interval) : def;

describe('fpsFormat', () => {
  test('getFpsValue appends the FPS suffix', () => {
    expect(getFpsValue(2)).toBe('2 FPS');
    expect(getFpsValue(0.5)).toBe('0.5 FPS');
  });

  test('getFpsInterval formats whole-second intervals without decimals', () => {
    expect(getFpsInterval(0.5, t)).toBe('2s intervals'); // 1/0.5 = 2
    expect(getFpsInterval(0.25, t)).toBe('4s intervals'); // 1/0.25 = 4
  });

  test('getFpsInterval shows one decimal for sub-second intervals >= 0.1s', () => {
    expect(getFpsInterval(2, t)).toBe('0.5s intervals'); // 1/2 = 0.5
  });

  test('getFpsInterval shows two decimals for tiny intervals < 0.1s', () => {
    expect(getFpsInterval(25, t)).toBe('0.04s intervals'); // 1/25 = 0.04
  });
});
