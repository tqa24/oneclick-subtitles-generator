import { saveBase64AudioToServer } from './narrationService';

describe('saveBase64AudioToServer', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('POSTs base64-encoded audio and returns the filename on success', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, filename: 'out.wav' }) }));
    const blob = new Blob(['audiobytes'], { type: 'audio/wav' });

    const name = await saveBase64AudioToServer({
      audioBlob: blob,
      subtitleId: 7,
      endpoint: '/api/narration/save-chatterbox-audio',
      sampleRate: 24000,
    });

    expect(name).toBe('out.wav');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/narration/save-chatterbox-audio');
    const body = JSON.parse(opts.body);
    expect(body.subtitle_id).toBe(7);
    expect(body.sampleRate).toBe(24000);
    expect(body.mimeType).toBe('audio/wav');
    expect(body.audioData).toBe(Buffer.from('audiobytes').toString('base64'));
  });

  test('throws on a non-ok response', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
    await expect(
      saveBase64AudioToServer({ audioBlob: new Blob(['x']), subtitleId: 1, endpoint: '/e' }),
    ).rejects.toThrow('Server responded with 500');
  });

  test('throws when the server reports success: false', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: false, error: 'nope' }) }));
    await expect(
      saveBase64AudioToServer({ audioBlob: new Blob(['x']), subtitleId: 1, endpoint: '/e' }),
    ).rejects.toThrow('nope');
  });
});
