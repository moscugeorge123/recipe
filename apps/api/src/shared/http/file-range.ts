import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parses a single `bytes=` range against a file of `size` bytes. Returns null when there is no
 * usable header (serve the whole file) and 'unsatisfiable' when it points past the end.
 * Multi-range requests are answered with the first range only.
 */
export function parseByteRange(
  header: string | undefined,
  size: number,
): ByteRange | null | 'unsatisfiable' {
  const match = /^bytes=(\d*)-(\d*)/.exec(header?.trim() ?? '');
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    // "bytes=-500": the last 500 bytes.
    const suffix = Number(match[2]);
    if (suffix === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || end < start) return 'unsatisfiable';
  return { start, end };
}

/**
 * Streams a local file with HTTP range support, which video players need to seek. Resolves once
 * the response has been sent, so async handlers don't finish before the stream does.
 */
export async function sendFileWithRanges(
  request: FastifyRequest,
  reply: FastifyReply,
  filePath: string,
  contentType: string,
): Promise<void> {
  const { size } = await stat(filePath);
  const range = parseByteRange(request.headers.range, size);
  reply.header('Accept-Ranges', 'bytes').header('Content-Type', contentType);

  if (range === 'unsatisfiable') {
    await reply.code(416).header('Content-Range', `bytes */${String(size)}`).send();
    return;
  }
  if (range === null) {
    await reply.code(200).header('Content-Length', String(size)).send(createReadStream(filePath));
    return;
  }
  await reply
    .code(206)
    .header('Content-Range', `bytes ${String(range.start)}-${String(range.end)}/${String(size)}`)
    .header('Content-Length', String(range.end - range.start + 1))
    .send(createReadStream(filePath, { start: range.start, end: range.end }));
}
