jest.mock('./keyManager', () => ({
  getAllKeys: jest.fn(() => ['k1', 'k2', 'k3']),
  getNextAvailableKey: jest.fn(),
  blacklistKey: jest.fn(),
}));

import { getAllKeys, getNextAvailableKey, blacklistKey } from './keyManager';
import { fetchWithKeyRotation, NO_KEY_MESSAGE } from './withKeyRotation';

const resp = (status) => ({ status, ok: status < 400 });

beforeEach(() => {
  jest.clearAllMocks();
  // CRA's jest auto-resets mock implementations between tests, so (re)set them here.
  getAllKeys.mockReturnValue(['k1', 'k2', 'k3']);
  // Default: rotate through k1 -> k2 -> k3 on successive calls.
  getNextAvailableKey
    .mockReturnValueOnce('k1')
    .mockReturnValueOnce('k2')
    .mockReturnValueOnce('k3');
});

describe('fetchWithKeyRotation', () => {
  test('returns the result and does not blacklist when the call succeeds', async () => {
    const fn = jest.fn(async () => resp(200));
    const out = await fetchWithKeyRotation(fn);
    expect(out).toEqual(resp(200));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('k1');
    expect(blacklistKey).not.toHaveBeenCalled();
  });

  test('blacklists and retries the next key on a 429 response', async () => {
    const fn = jest.fn()
      .mockResolvedValueOnce(resp(429))
      .mockResolvedValueOnce(resp(200));
    const out = await fetchWithKeyRotation(fn);
    expect(out).toEqual(resp(200));
    expect(blacklistKey).toHaveBeenCalledWith('k1');
    expect(fn).toHaveBeenNthCalledWith(2, 'k2');
  });

  test('retries on a thrown rate-limit error too', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('You exceeded your quota'))
      .mockResolvedValueOnce(resp(200));
    const out = await fetchWithKeyRotation(fn);
    expect(out).toEqual(resp(200));
    expect(blacklistKey).toHaveBeenCalledWith('k1');
  });

  test('after every key is exhausted, returns the last 429 response', async () => {
    const fn = jest.fn(async () => resp(429));
    const out = await fetchWithKeyRotation(fn);
    expect(out).toEqual(resp(429));
    expect(fn).toHaveBeenCalledTimes(3); // 3 keys -> 3 attempts
    expect(blacklistKey).toHaveBeenCalledTimes(3);
  });

  test('propagates a non-rate-limit error immediately without switching', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('invalid argument'));
    await expect(fetchWithKeyRotation(fn)).rejects.toThrow('invalid argument');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(blacklistKey).not.toHaveBeenCalled();
  });

  test('throws a clear message when there is no key', async () => {
    getNextAvailableKey.mockReset().mockReturnValue(null);
    await expect(fetchWithKeyRotation(jest.fn())).rejects.toThrow(NO_KEY_MESSAGE);
  });
});
