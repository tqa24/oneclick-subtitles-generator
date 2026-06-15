import { uploadFileToRenderer, downloadVideoFromUrl, RENDERER_BASE_URL } from './videoRendererClient';

describe('videoRendererClient', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('uploadFileToRenderer POSTs to /upload/<type> and returns the filename', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ filename: 'stored.mp4' }) }));
    const name = await uploadFileToRenderer(new File(['x'], 'a.mp4'), 'audio');
    expect(name).toBe('stored.mp4');
    expect(global.fetch).toHaveBeenCalledWith(
      `${RENDERER_BASE_URL}/upload/audio`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('uploadFileToRenderer throws when the server responds non-ok', async () => {
    global.fetch = jest.fn(async () => ({ ok: false }));
    await expect(uploadFileToRenderer(new File(['x'], 'a'), 'video')).rejects.toThrow('Failed to upload video');
  });

  test('downloadVideoFromUrl rejects blob: URLs without fetching', async () => {
    global.fetch = jest.fn();
    await expect(downloadVideoFromUrl('blob:whatever')).rejects.toThrow('Blob URLs cannot be downloaded');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
