import { toBase64, fileToBase64 } from './fileUtils';

describe('toBase64', () => {
  test('encodes a Blob to base64 without the data: prefix (round-trip)', async () => {
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    const b64 = await toBase64(blob);
    expect(b64).toBe(Buffer.from('hello world').toString('base64'));
    expect(Buffer.from(b64, 'base64').toString()).toBe('hello world');
  });

  test('encodes a File the same way (File extends Blob)', async () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    expect(await toBase64(file)).toBe(Buffer.from('abc').toString('base64'));
  });

  test('rejects empty or invalid input', async () => {
    await expect(toBase64(null)).rejects.toThrow();
    await expect(toBase64(new Blob([]))).rejects.toThrow();
  });

  test('fileToBase64 is an alias of toBase64', () => {
    expect(fileToBase64).toBe(toBase64);
  });
});
