/**
 * Consume a Server-Sent-Events response body, invoking `onData` with each parsed `data:` JSON
 * object.
 *
 * Shared reader/decoder/line-split loop that the streaming narration hooks (gTTS, Edge, …) each
 * inline. Malformed `data:` lines are skipped (matching the original per-line try/catch). The
 * per-event handling (the `switch (data.status)` and cache persistence) stays in the caller's
 * `onData` callback, which closes over the hook's own state setters.
 *
 * @param {Response} response - a fetch Response with a readable body
 * @param {(data: any) => void} onData - called for each parsed SSE data object
 */
export const consumeNarrationSSE = async (response, onData) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          onData(JSON.parse(line.slice(6)));
        } catch (error) {
          // Ignore malformed SSE lines.
        }
      }
    }
  }
};
