import { getCurrentMediaId, CURRENT_VIDEO_ID_KEY, CURRENT_FILE_ID_KEY } from './mediaId';

describe('getCurrentMediaId', () => {
  afterEach(() => localStorage.clear());

  test('extracts the 11-char YouTube id from a watch URL', () => {
    localStorage.setItem(CURRENT_VIDEO_ID_KEY, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(getCurrentMediaId()).toBe('dQw4w9WgXcQ');
  });

  test('extracts the id from a youtu.be short URL', () => {
    localStorage.setItem(CURRENT_VIDEO_ID_KEY, 'https://youtu.be/dQw4w9WgXcQ');
    expect(getCurrentMediaId()).toBe('dQw4w9WgXcQ');
  });

  test('falls back to the file cache id when no video URL is set', () => {
    localStorage.setItem(CURRENT_FILE_ID_KEY, 'file-abc');
    expect(getCurrentMediaId()).toBe('file-abc');
  });

  test('returns null when nothing is set', () => {
    expect(getCurrentMediaId()).toBe(null);
  });
});
