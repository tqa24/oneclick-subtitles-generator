jest.mock('../../services/subtitleCache', () => ({ generateUrlBasedCacheId: async () => 'HASH123' }));

import { resolveGeminiFileCache } from './fileCache';

describe('resolveGeminiFileCache', () => {
  afterEach(() => localStorage.clear());

  test('uses a file-based key when no current video URL is set', async () => {
    const file = { name: 'a.mp4', size: 100, lastModified: 5, type: 'video/mp4' };
    const r = await resolveGeminiFileCache(file);
    expect(r.fileKey).toBe('gemini_file_a.mp4_100_5');
    expect(r.uploadedFile).toBe(null);
    expect(r.isYouTube).toBe(false);
  });

  test('uses a URL-based key and reuses the cached file when a video URL is set', async () => {
    localStorage.setItem('current_video_url', 'https://example.com/v.mp4');
    localStorage.setItem('gemini_file_url_HASH123', JSON.stringify({ uri: 'gs://x' }));
    const r = await resolveGeminiFileCache({ name: 'a', size: 1, type: 't' });
    expect(r.fileKey).toBe('gemini_file_url_HASH123');
    expect(r.uploadedFile).toEqual({ uri: 'gs://x' });
    expect(r.isYouTube).toBe(false);
  });

  test('reuses a YouTube URL directly instead of uploading', async () => {
    localStorage.setItem('current_video_url', 'https://youtu.be/abc');
    const r = await resolveGeminiFileCache({ type: 'video/mp4' });
    expect(r.isYouTube).toBe(true);
    expect(r.uploadedFile).toEqual({ uri: 'https://youtu.be/abc', mimeType: 'video/mp4' });
  });
});
