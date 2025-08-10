export function createChunkedState(): ChunkedState {
  return {
    done: false,
    awaitingSize: true,
    nextChunkSize: 0,
    collected: [],
    trailerMode: false,
    trailerBuf: Buffer.alloc(0),
    partialLine: Buffer.alloc(0),
    bytesSoFar: 0,
  };
}

/**
 * Feed bytes into the chunked decoder.
 * Returns number of bytes consumed from `buf`.
 */
export function feedChunked(
  state: ChunkedState,
  buf: Buffer,
  maxBytes?: number
): number {
  let offset = 0;

  while (offset < buf.length && !state.done) {
    // 1) Trailers: read header lines until an empty line
    if (state.trailerMode) {
      offset = parseTrailers(state, buf, offset);
      break; // exit main loop so caller can slice consumed bytes
    }

    // 2) Need a chunk-size line
    if (state.awaitingSize) {
      const next = parseChunkSize(state, buf, offset);
      if (next === null) return buf.length; // incomplete size line; consumed all available bytes
      offset = next;

      // Terminal chunk => switch to trailer mode (may be empty: single CRLF)
      if (state.trailerMode) continue;

      // Otherwise proceed to read chunk data
      continue;
    }

    // 3) Read chunk data + trailing CRLF
    const next = parseChunkData(state, buf, offset, maxBytes);
    if (next === null) return offset; // need more data for full chunk
    offset = next;
  }

  return offset;
}

function parseTrailers(
  state: ChunkedState,
  buf: Buffer,
  offset: number
): number {
  while (offset < buf.length) {
    const lineResult = readLine(state, buf, offset);
    if (!lineResult) {
      // Incomplete line collected into partialLine; consume all we have
      return buf.length;
    }

    const { line, newOffset } = lineResult;
    offset = newOffset;

    if (line.length === 0) {
      // Empty line => end of trailers => body complete
      state.done = true;
      break;
    }

    // Preserve trailer bytes (line + CRLF)
    state.trailerBuf = Buffer.concat([
      state.trailerBuf,
      line,
      Buffer.from("\r\n"),
    ]);
  }
  return offset;
}

function parseChunkSize(
  state: ChunkedState,
  buf: Buffer,
  offset: number
): number | null {
  const lineResult = readLine(state, buf, offset);
  if (!lineResult) {
    // Not enough data to finish the size line
    return null;
  }

  const { line, newOffset } = lineResult;

  const raw = line.toString("utf8");
  const semi = raw.indexOf(";");
  const hexStr = (semi === -1 ? raw : raw.slice(0, semi)).trim();

  if (!/^[0-9a-fA-F]+$/.test(hexStr)) {
    throw new Error(`Invalid chunk size: ${hexStr}`);
  }

  const size = parseInt(hexStr, 16);
  state.nextChunkSize = size;
  state.awaitingSize = false;

  if (size === 0) {
    // After last-chunk size line, trailers follow (possibly just an empty line)
    state.trailerMode = true;
  }

  return newOffset;
}

function parseChunkData(
  state: ChunkedState,
  buf: Buffer,
  offset: number,
  maxBytes?: number
): number | null {
  const dataSize = state.nextChunkSize;
  const totalNeeded = dataSize + 2; // data + CRLF

  if (buf.length - offset < totalNeeded) {
    // Not enough bytes for full data + CRLF yet
    return null;
  }

  // Extract payload
  const data = buf.subarray(offset, offset + dataSize);

  // Limit check before storing
  const projected = state.bytesSoFar + data.length;
  if (maxBytes !== undefined && projected > maxBytes) {
    throw new Error("payload too large");
  }

  state.collected.push(data);
  state.bytesSoFar = projected;
  offset += dataSize;

  // Validate trailing CRLF
  if (!startsWithCrlf(buf, offset)) {
    throw new Error("Missing CRLF after chunk data");
  }
  offset += 2;

  // Next: another size line
  state.awaitingSize = true;
  state.nextChunkSize = 0;

  return offset;
}

/**
 * Read a CRLF-terminated line starting at `offset`.
 * Returns { line, newOffset }, where `line` excludes the CRLF.
 * If not enough bytes for a full line, returns null and appends the tail into state.partialLine.
 */
function readLine(
  state: ChunkedState,
  buf: Buffer,
  offset: number
): { line: Buffer; newOffset: number } | null {
  const eol = indexOfCrlf(buf, offset);
  if (eol === -1) {
    // Keep partial bytes for next feed
    state.partialLine = Buffer.concat([
      state.partialLine,
      buf.subarray(offset),
    ]);
    return null;
  }

  // We have a full CRLF-terminated line [offset, eol)
  let line: Buffer;
  if (state.partialLine.length > 0) {
    line = Buffer.concat([state.partialLine, buf.subarray(offset, eol)]);
    state.partialLine = Buffer.alloc(0);
  } else {
    line = buf.subarray(offset, eol);
  }

  return { line, newOffset: eol + 2 }; // skip CRLF
}

export function getChunkedBody(state: ChunkedState): Buffer | null {
  if (!state.done) return null;
  return Buffer.concat(state.collected);
}

function indexOfCrlf(buf: Buffer, from: number): number {
  for (let i = from; i + 1 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10) return i; // \r\n
  }
  return -1;
}

function startsWithCrlf(buf: Buffer, at: number): boolean {
  return at + 1 < buf.length && buf[at] === 13 && buf[at + 1] === 10;
}
