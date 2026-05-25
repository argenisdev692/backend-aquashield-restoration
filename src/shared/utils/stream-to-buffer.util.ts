/**
 * Converts a Node Readable / web ReadableStream into a Buffer.
 * Used by ElevenLabs audio adapter (stream → Buffer for ZIP packaging).
 *
 * Safe for small-to-medium audio payloads. For very large streams
 * consider streaming directly to R2 instead of buffering in memory.
 */
export async function streamToBuffer(
  stream: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  if (stream instanceof ReadableStream) {
    const reader = stream.getReader();
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    // NodeJS.ReadableStream path
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
  }

  return Buffer.concat(chunks);
}
