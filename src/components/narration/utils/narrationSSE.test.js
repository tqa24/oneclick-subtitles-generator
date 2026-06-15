import { consumeNarrationSSE } from './narrationSSE';

// Build a minimal SSE-like Response whose reader yields the given string chunks in order.
const sseResponse = (chunks) => {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length
          ? { done: false, value: encoder.encode(chunks[i++]) }
          : { done: true, value: undefined }),
      }),
    },
  };
};

describe('consumeNarrationSSE', () => {
  test('parses every data: line and invokes onData in order', async () => {
    const got = [];
    await consumeNarrationSSE(
      sseResponse(['data: {"status":"started","total":2}\n', 'data: {"status":"progress","current":1}\n']),
      (d) => got.push(d),
    );
    expect(got).toEqual([{ status: 'started', total: 2 }, { status: 'progress', current: 1 }]);
  });

  test('ignores comment lines, non-data lines and malformed JSON', async () => {
    const got = [];
    await consumeNarrationSSE(
      sseResponse([': keep-alive\n', 'event: ping\n', 'data: not-json\n', 'data: {"ok":true}\n']),
      (d) => got.push(d),
    );
    expect(got).toEqual([{ ok: true }]);
  });

  test('stops when the reader reports done', async () => {
    const got = [];
    await consumeNarrationSSE(sseResponse(['data: {"a":1}\n']), (d) => got.push(d));
    expect(got).toEqual([{ a: 1 }]);
  });
});
