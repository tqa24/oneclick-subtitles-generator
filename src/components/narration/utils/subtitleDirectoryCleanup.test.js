jest.mock('../../../config', () => ({ SERVER_URL: 'http://test.local' }));

import { cleanupOldSubtitleDirectories } from './subtitleDirectoryCleanup';

describe('cleanupOldSubtitleDirectories', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('POSTs the grouped subtitles to the cleanup endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const grouped = [{ id: 1 }, { id: 2 }];
    await cleanupOldSubtitleDirectories(grouped);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://test.local/api/narration/cleanup-old-directories');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ groupedSubtitles: grouped });
  });

  test('never throws when the request rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(cleanupOldSubtitleDirectories([])).resolves.toBeUndefined();
  });

  test('logs (but does not throw) on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await cleanupOldSubtitleDirectories([]);
    expect(errSpy).toHaveBeenCalled();
  });
});
